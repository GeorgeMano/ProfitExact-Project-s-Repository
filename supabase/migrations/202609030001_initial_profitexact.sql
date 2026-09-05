create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_number text not null unique check (phone_number ~ '^\+407[0-9]{8}$'),
  interface_language text not null default 'ro' check (interface_language in ('ro', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (activity in ('ridesharing', 'delivery')),
  work_mode text not null check (work_mode in ('employee', 'own_business')),
  legal_form text check (legal_form in ('srl', 'pfa')),
  city_name text not null check (char_length(city_name) between 2 and 80),
  city_key text not null check (city_key ~ '^[a-z0-9]+([ -][a-z0-9]+)*$'),
  profit_view text not null default 'together' check (profit_view in ('together', 'separate')),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, activity),
  unique (id, user_id),
  check (
    (work_mode = 'employee' and legal_form is null)
    or (work_mode = 'own_business' and legal_form is not null)
  )
);

create table public.context_platforms (
  context_id uuid not null,
  user_id uuid not null,
  platform text not null check (platform in ('bolt', 'uber', 'glovo', 'wolt', 'bolt_food')),
  created_at timestamptz not null default now(),
  primary key (context_id, platform),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  ownership_type text not null check (ownership_type in ('owned', 'rented')),
  fuel_type text not null check (
    fuel_type in ('gasoline', 'diesel', 'electric', 'gasoline_lpg', 'hybrid_gasoline', 'hybrid_diesel')
  ),
  hybrid_type text check (hybrid_type in ('hev', 'phev')),
  primary_fuel text check (primary_fuel in ('gasoline', 'lpg')),
  consumption_per_100 numeric(8, 3) not null default 0 check (consumption_per_100 >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade,
  check (effective_to is null or effective_to >= effective_from)
);

create unique index one_current_vehicle_per_context
  on public.vehicles(context_id)
  where effective_to is null;

create table public.fleet_config_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  commission_type text not null check (commission_type in ('percentage', 'fixed')),
  commission_value numeric(14, 2) not null default 0 check (commission_value >= 0),
  commission_base text check (commission_base in ('gross', 'net')),
  weekly_cim_cost numeric(14, 2) not null default 0 check (weekly_cim_cost >= 0),
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (context_id, effective_from),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade,
  check (
    (commission_type = 'percentage' and commission_base is not null and commission_value <= 100)
    or (commission_type = 'fixed' and commission_base is null)
  ),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.recurring_costs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  vehicle_id uuid,
  category text not null check (
    category in (
      'accounting', 'cash_register', 'fleet_withholding', 'vehicle_rent',
      'rca', 'casco', 'itp', 'vignette', 'leasing', 'phone_internet'
    )
  ),
  label text not null,
  amount numeric(14, 2) not null check (amount >= 0),
  period text not null check (period in ('weekly', 'monthly', 'annual', 'validity')),
  validity_days integer check (validity_days > 0),
  paid_to_fleet boolean not null default false,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade,
  foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete cascade,
  check ((period = 'validity' and validity_days is not null) or period <> 'validity'),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.work_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  city_name text not null check (char_length(city_name) between 2 and 80),
  city_key text not null check (city_key ~ '^[a-z0-9]+([ -][a-z0-9]+)*$'),
  period_type text not null check (period_type in ('day', 'week')),
  period_start date not null,
  period_end date not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'screenshot', 'pdf')),
  confirmation_status text not null default 'confirmed' check (confirmation_status in ('draft', 'confirmed')),
  worked_days smallint check (worked_days between 0 and 7),
  worked_hours numeric(8, 2) check (worked_hours >= 0),
  total_kilometers numeric(12, 2) not null default 0 check (total_kilometers >= 0),
  private_earnings numeric(14, 2) not null default 0 check (private_earnings >= 0),
  private_kilometers numeric(12, 2) not null default 0 check (private_kilometers >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade,
  check (period_end >= period_start),
  check (
    (period_type = 'day' and period_start = period_end)
    or (period_type = 'week' and period_end = period_start + 6)
  )
);

create table public.platform_earnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_entry_id uuid not null,
  platform text not null check (platform in ('bolt', 'uber', 'glovo', 'wolt', 'bolt_food')),
  card_earnings numeric(14, 2) not null default 0 check (card_earnings >= 0),
  cash_earnings numeric(14, 2) not null default 0 check (cash_earnings >= 0),
  compensations numeric(14, 2) not null default 0 check (compensations >= 0),
  app_tips numeric(14, 2) not null default 0 check (app_tips >= 0),
  cash_tips numeric(14, 2) not null default 0 check (cash_tips >= 0),
  kilometers numeric(12, 2) check (kilometers >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_entry_id, platform),
  foreign key (work_entry_id, user_id)
    references public.work_entries(id, user_id) on delete cascade
);

create table public.energy_entries (
  work_entry_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  calculation_type text not null check (calculation_type in ('calculated', 'phev_direct')),
  consumption_per_100 numeric(8, 3) check (consumption_per_100 >= 0),
  unit_price numeric(14, 4) check (unit_price >= 0),
  gasoline_cost numeric(14, 2) not null default 0 check (gasoline_cost >= 0),
  electric_cost numeric(14, 2) not null default 0 check (electric_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (work_entry_id, user_id)
    references public.work_entries(id, user_id) on delete cascade,
  check (
    (calculation_type = 'calculated' and consumption_per_100 is not null and unit_price is not null)
    or calculation_type = 'phev_direct'
  )
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context_id uuid not null,
  work_entry_id uuid,
  vehicle_id uuid,
  category text not null check (category in ('washing', 'parking', 'road_toll', 'service', 'other', 'secondary_fuel')),
  expense_date date not null,
  period_type text not null default 'day' check (period_type in ('day', 'week', 'month')),
  amount numeric(14, 2) not null check (amount >= 0),
  description text,
  odometer_km numeric(12, 2) check (odometer_km >= 0),
  document_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (context_id, user_id)
    references public.work_contexts(id, user_id) on delete cascade,
  foreign key (work_entry_id, user_id)
    references public.work_entries(id, user_id) on delete cascade,
  foreign key (vehicle_id, user_id)
    references public.vehicles(id, user_id) on delete restrict
);

create index work_contexts_user_idx on public.work_contexts(user_id);
create index vehicles_context_idx on public.vehicles(context_id, effective_from desc);
create index fleet_config_context_idx on public.fleet_config_versions(context_id, effective_from desc);
create index recurring_costs_context_idx on public.recurring_costs(context_id, effective_from desc);
create index work_entries_context_period_idx on public.work_entries(context_id, period_start desc);
create index work_entries_city_period_idx
  on public.work_entries(city_key, period_start desc)
  where confirmation_status = 'confirmed';
create index expenses_context_date_idx on public.expenses(context_id, expense_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.create_profile_after_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
    and new.phone_confirmed_at is not null
    and new.phone is not null then
    insert into public.profiles (user_id, phone_number)
    values (new.id, new.phone)
    on conflict (user_id) do update
      set phone_number = excluded.phone_number;
  end if;

  return new;
end;
$$;

create trigger auth_user_create_verified_profile
after insert or update of email_confirmed_at, phone_confirmed_at, phone on auth.users
for each row execute function public.create_profile_after_contact_verification();

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger work_contexts_set_updated_at before update on public.work_contexts
for each row execute function public.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function public.set_updated_at();
create trigger recurring_costs_set_updated_at before update on public.recurring_costs
for each row execute function public.set_updated_at();
create trigger work_entries_set_updated_at before update on public.work_entries
for each row execute function public.set_updated_at();
create trigger platform_earnings_set_updated_at before update on public.platform_earnings
for each row execute function public.set_updated_at();
create trigger energy_entries_set_updated_at before update on public.energy_entries
for each row execute function public.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.work_contexts enable row level security;
alter table public.context_platforms enable row level security;
alter table public.vehicles enable row level security;
alter table public.fleet_config_versions enable row level security;
alter table public.recurring_costs enable row level security;
alter table public.work_entries enable row level security;
alter table public.platform_earnings enable row level security;
alter table public.energy_entries enable row level security;
alter table public.expenses enable row level security;

create policy profiles_owner_all on public.profiles
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy work_contexts_owner_all on public.work_contexts
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy context_platforms_owner_all on public.context_platforms
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy vehicles_owner_all on public.vehicles
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy fleet_config_owner_all on public.fleet_config_versions
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy recurring_costs_owner_all on public.recurring_costs
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy work_entries_owner_all on public.work_entries
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy platform_earnings_owner_all on public.platform_earnings
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy energy_entries_owner_all on public.energy_entries
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy expenses_owner_all on public.expenses
for all using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
