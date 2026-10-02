-- Rezultatul zilei se salveaza ca instantaneu, nu se recalculeaza din istoric.
-- Altfel, orice schimbare viitoare de comision sau de pret ar rescrie trecutul.
alter table public.work_entries
  add column computed_total_earnings numeric(14, 2) check (computed_total_earnings >= 0),
  add column computed_total_expenses numeric(14, 2) check (computed_total_expenses >= 0),
  add column computed_result numeric(14, 2),
  add column computed_at timestamptz;

-- Statistici publice pe oras, strict agregate.
-- Pragul de 10 soferi distincti este protectia de anonimizare: sub el,
-- "media pe Pitesti" poate deveni datele unei singure persoane.
-- Vederea ocoleste intentionat RLS (security_invoker = off) pentru a putea
-- agrega intre utilizatori; nicio coloana nu expune un rand individual.
create view public.city_statistics
with (security_invoker = off) as
select
  w.city_key,
  min(w.city_name) as city_name,
  count(distinct w.user_id) as driver_count,
  count(*) as entry_count,
  round(
    sum(w.computed_result) / nullif(sum(w.total_kilometers), 0), 2
  ) as result_per_km,
  round(
    sum(w.computed_total_earnings) / nullif(sum(w.total_kilometers), 0), 2
  ) as earnings_per_km,
  round(avg(w.total_kilometers), 1) as avg_kilometers_per_day,
  max(w.period_start) as last_entry_date
from public.work_entries w
where w.confirmation_status = 'confirmed'
  and w.period_type = 'day'
  and w.computed_result is not null
  and w.period_start >= current_date - 90
group by w.city_key
having count(distinct w.user_id) >= 10;

revoke all on public.city_statistics from anon;
grant select on public.city_statistics to authenticated;

comment on view public.city_statistics is
  'Statistici agregate pe oras din ultimele 90 de zile. Expuse numai pentru orasele cu cel putin 10 soferi distincti.';
