-- Perioada lunară în work_entries + cheia de upsert pentru resalvare.
--
-- Motivul: interfața oferă deja tab-ul "Lunar" și salvarea manuală a lunii, dar
-- baza accepta numai 'day' și 'week', deci orice lună introdusă manual ar fi fost
-- respinsă la scriere. În plus, nu exista nicio cheie unică pe perioadă, deci
-- resalvarea aceleiași zile ar fi creat un rând nou în loc să îl actualizeze.

-- 1. Perioada "lună" devine validă, aliniată cu public.expenses.period_type.
alter table public.work_entries
  drop constraint if exists work_entries_period_type_check;

alter table public.work_entries
  add constraint work_entries_period_type_check
  check (period_type = any (array['day'::text, 'week'::text, 'month'::text]));

-- 2. Forma intervalului: ziua = o zi, săptămâna = 7 zile, luna = luna calendaristică întreagă.
alter table public.work_entries
  drop constraint if exists work_entries_check1;

alter table public.work_entries
  add constraint work_entries_period_shape_check
  check (
    (period_type = 'day' and period_start = period_end)
    or (period_type = 'week' and period_end = period_start + 6)
    or (
      period_type = 'month'
      and period_start = date_trunc('month', period_start::timestamp)::date
      and period_end = (date_trunc('month', period_start::timestamp) + interval '1 month - 1 day')::date
    )
  );

-- 3. O lună poate avea până la 31 de zile lucrate, nu 7.
alter table public.work_entries
  drop constraint if exists work_entries_worked_days_check;

alter table public.work_entries
  add constraint work_entries_worked_days_check
  check (worked_days is null or (worked_days >= 0 and worked_days <= 31));

-- 4. Cheie de upsert: resalvarea aceleiași perioade actualizează rândul, nu îl dublează.
create unique index if not exists work_entries_context_period_key
  on public.work_entries (context_id, period_type, period_start);
