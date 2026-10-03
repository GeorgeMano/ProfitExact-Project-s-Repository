-- Jurnalul vehiculului: kilometrajul, reviziile și reparațiile.
-- La bicicletă nu se țin kilometri: coloanele rămân goale.

alter table public.vehicles
  add column odometer_km numeric(12, 2) check (odometer_km > 0),
  add column odometer_date date,
  add column last_service_km numeric(12, 2) check (last_service_km > 0),
  add column last_service_date date,
  add column service_interval_km integer check (service_interval_km > 0),
  add column service_interval_months smallint check (service_interval_months between 1 and 120),
  add constraint vehicles_odometer_complete check ((odometer_km is null) = (odometer_date is null));

-- Kilometrajul de la bord trecut într-o zi (opțional): corectează estimarea.
alter table public.work_entries
  add column odometer_km numeric(12, 2) check (odometer_km > 0);

-- Ce fel de intervenție a fost. Descrierea și kilometrajul existau deja.
alter table public.expenses
  add column service_kind text
    check (service_kind in ('revizie', 'reparatie', 'anvelope', 'frane', 'altele')),
  add constraint expenses_service_kind_only_for_service
    check (service_kind is null or category = 'service');
