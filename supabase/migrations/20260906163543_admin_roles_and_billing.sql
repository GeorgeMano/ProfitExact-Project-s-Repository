-- Rolul utilizatorului. Adminul administreaza platforma si facturarea,
-- dar NU are drept de citire pe datele financiare ale soferilor.
alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

create index profiles_role_idx on public.profiles(role) where role = 'admin';

-- security definer ca sa nu intre in recursiune cu politicile de pe profiles
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from anon;

-- Setari globale: un singur rand, garantat prin cheia primara booleana.
create table public.app_settings (
  id boolean primary key default true check (id),
  monthly_price_ron numeric(10, 2) not null default 24.99 check (monthly_price_ron >= 0),
  trial_days smallint not null default 14 check (trial_days between 0 and 365),
  currency text not null default 'RON' check (currency in ('RON', 'EUR')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.app_settings (id) values (true);

-- Abonamentul: pretul este blocat la inscriere, ca o crestere ulterioara
-- de pret sa fie o decizie explicita, nu un efect secundar.
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_price_ron numeric(10, 2) not null check (monthly_price_ron >= 0),
  currency text not null default 'RON',
  provider text check (provider in ('stripe', 'netopia', 'manual')),
  provider_customer_id text,
  provider_subscription_id text unique,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (trial_ends_at >= trial_started_at),
  check (current_period_end is null or current_period_start is null
         or current_period_end >= current_period_start)
);

create index subscriptions_status_idx on public.subscriptions(status, trial_ends_at);

-- Istoricul platilor: cine, cat si cand.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_ron numeric(10, 2) not null check (amount_ron >= 0),
  currency text not null default 'RON',
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at timestamptz,
  period_start date,
  period_end date,
  provider text check (provider in ('stripe', 'netopia', 'manual')),
  provider_payment_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  check (period_end is null or period_start is null or period_end >= period_start),
  check (status <> 'succeeded' or paid_at is not null)
);

create index payments_user_idx on public.payments(user_id, created_at desc);
create index payments_status_idx on public.payments(status, created_at desc);

create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

-- Proba porneste automat cand profilul este creat (email + telefon verificate).
create or replace function public.start_trial_for_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.app_settings%rowtype;
begin
  select * into settings from public.app_settings where id = true;

  insert into public.subscriptions (
    user_id, status, trial_started_at, trial_ends_at, monthly_price_ron, currency
  )
  values (
    new.user_id,
    'trialing',
    now(),
    now() + make_interval(days => coalesce(settings.trial_days, 14)),
    coalesce(settings.monthly_price_ron, 24.99),
    coalesce(settings.currency, 'RON')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger profiles_start_trial
after insert on public.profiles
for each row execute function public.start_trial_for_new_profile();

alter table public.app_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Pretul trebuie citit de orice utilizator autentificat (ecranul de checkout).
create policy app_settings_read on public.app_settings
for select to authenticated using (true);
create policy app_settings_admin_update on public.app_settings
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Abonamentul si platile: proprietarul citeste, adminul citeste tot.
-- Scrierea ramane exclusiv pe service_role (webhook de plata), nu pe client.
create policy subscriptions_owner_read on public.subscriptions
for select to authenticated using ((select auth.uid()) = user_id);
create policy subscriptions_admin_read on public.subscriptions
for select to authenticated using (public.is_admin());
create policy subscriptions_admin_update on public.subscriptions
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy payments_owner_read on public.payments
for select to authenticated using ((select auth.uid()) = user_id);
create policy payments_admin_read on public.payments
for select to authenticated using (public.is_admin());

-- Adminul vede lista de utilizatori si rolurile, nu si castigurile lor.
create policy profiles_admin_read on public.profiles
for select to authenticated using (public.is_admin());
