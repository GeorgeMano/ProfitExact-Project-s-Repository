-- Pragul de anonimizare devine setare, ca sa poata fi ajustat fara migrare.
alter table public.app_settings
  add column city_stats_min_drivers smallint not null default 5
    check (city_stats_min_drivers >= 3);

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
  having count(distinct w.user_id) >= (
    select s.city_stats_min_drivers from public.app_settings s where s.id = true
  );
$$;

comment on function public.get_city_statistics() is
  'Statistici agregate pe oras din ultimele 90 de zile. Pragul minim de soferi distincti se citeste din app_settings.city_stats_min_drivers.';

revoke execute on function public.get_city_statistics() from public, anon;
grant execute on function public.get_city_statistics() to authenticated;
