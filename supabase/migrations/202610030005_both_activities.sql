-- „Ambele”: ridesharing și delivery în același cont, cu aceeași mașină.
alter table public.work_contexts
  drop constraint if exists work_contexts_activity_check;

alter table public.work_contexts
  add constraint work_contexts_activity_check
    check (activity in ('ridesharing', 'delivery', 'both'));

-- Comisionul oprit din încasările de delivery, când diferă de cel de la
-- ridesharing (altă flotă sau contractul de afiliere). Null = același.
alter table public.fleet_config_versions
  add column delivery_commission_type text
    check (delivery_commission_type in ('percentage', 'fixed')),
  add column delivery_commission_value numeric(14, 2)
    check (delivery_commission_value >= 0),
  add column delivery_commission_base text
    check (delivery_commission_base in ('gross', 'net')),
  add constraint fleet_config_versions_delivery_commission_complete check (
    (delivery_commission_type is null and delivery_commission_value is null and delivery_commission_base is null)
    or (delivery_commission_type = 'fixed' and delivery_commission_value is not null and delivery_commission_base is null)
    or (delivery_commission_type = 'percentage' and delivery_commission_value is not null and delivery_commission_base is not null)
  );
