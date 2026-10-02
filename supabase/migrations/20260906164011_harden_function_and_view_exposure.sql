-- Functiile de trigger erau expuse ca endpointuri REST (/rest/v1/rpc/...).
-- Le mutam intr-o schema neexpusa de PostgREST.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.create_profile_after_contact_verification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email_confirmed_at is not null
    and new.phone_confirmed_at is not null
    and new.phone is not null then
    insert into public.profiles (user_id, phone_number)
    values (new.id, new.phone)
    on conflict (user_id) do update set phone_number = excluded.phone_number;
  end if;
  return new;
end;
$$;

create or replace function private.start_trial_for_new_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  settings public.app_settings%rowtype;
begin
  select * into settings from public.app_settings where id = true;
  insert into public.subscriptions (
    user_id, status, trial_started_at, trial_ends_at, monthly_price_ron, currency
  )
  values (
    new.user_id, 'trialing', now(),
    now() + make_interval(days => coalesce(settings.trial_days, 14)),
    coalesce(settings.monthly_price_ron, 24.99),
    coalesce(settings.currency, 'RON')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace function private.protect_profile_role()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger auth_user_create_verified_profile on auth.users;
create trigger auth_user_create_verified_profile
after insert or update of email_confirmed_at, phone_confirmed_at, phone on auth.users
for each row execute function private.create_profile_after_contact_verification();

drop trigger profiles_start_trial on public.profiles;
create trigger profiles_start_trial
after insert on public.profiles
for each row execute function private.start_trial_for_new_profile();

drop trigger profiles_protect_role on public.profiles;
create trigger profiles_protect_role
before update on public.profiles
for each row execute function private.protect_profile_role();

drop trigger profiles_set_updated_at on public.profiles;
drop trigger work_contexts_set_updated_at on public.work_contexts;
drop trigger vehicles_set_updated_at on public.vehicles;
drop trigger recurring_costs_set_updated_at on public.recurring_costs;
drop trigger work_entries_set_updated_at on public.work_entries;
drop trigger platform_earnings_set_updated_at on public.platform_earnings;
drop trigger energy_entries_set_updated_at on public.energy_entries;
drop trigger expenses_set_updated_at on public.expenses;
drop trigger app_settings_set_updated_at on public.app_settings;
drop trigger subscriptions_set_updated_at on public.subscriptions;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger work_contexts_set_updated_at before update on public.work_contexts
for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function private.set_updated_at();
create trigger recurring_costs_set_updated_at before update on public.recurring_costs
for each row execute function private.set_updated_at();
create trigger work_entries_set_updated_at before update on public.work_entries
for each row execute function private.set_updated_at();
create trigger platform_earnings_set_updated_at before update on public.platform_earnings
for each row execute function private.set_updated_at();
create trigger energy_entries_set_updated_at before update on public.energy_entries
for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
for each row execute function private.set_updated_at();
create trigger app_settings_set_updated_at before update on public.app_settings
for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions
for each row execute function private.set_updated_at();

drop function public.create_profile_after_contact_verification();
drop function public.start_trial_for_new_profile();
drop function public.protect_profile_role();
drop function public.set_updated_at();

-- Statisticile pe oras: functie explicita in loc de vedere SECURITY DEFINER,
-- ca intentia sa fie vizibila si auditabila. Pragul de 10 soferi ramane.
drop view public.city_statistics;

create or replace function public.get_city_statistics()
returns table (
  city_key text,
  city_name text,
  driver_count bigint,
  entry_count bigint,
  result_per_km numeric,
  earnings_per_km numeric,
  avg_kilometers_per_day numeric,
  last_entry_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.city_key,
    min(w.city_name) as city_name,
    count(distinct w.user_id) as driver_count,
    count(*) as entry_count,
    round(sum(w.computed_result) / nullif(sum(w.total_kilometers), 0), 2),
    round(sum(w.computed_total_earnings) / nullif(sum(w.total_kilometers), 0), 2),
    round(avg(w.total_kilometers), 1),
    max(w.period_start)
  from public.work_entries w
  where w.confirmation_status = 'confirmed'
    and w.period_type = 'day'
    and w.computed_result is not null
    and w.period_start >= current_date - 90
  group by w.city_key
  having count(distinct w.user_id) >= 10;
$$;

comment on function public.get_city_statistics() is
  'Statistici agregate pe oras din ultimele 90 de zile, expuse numai pentru orasele cu cel putin 10 soferi distincti.';

revoke execute on function public.get_city_statistics() from public, anon;
grant execute on function public.get_city_statistics() to authenticated;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
