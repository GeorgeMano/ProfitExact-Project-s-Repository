-- Ecranul Glovo „Payments”: livrări anulate și ore online. Informative.
alter table public.platform_earnings
  add column cancelled_deliveries integer check (cancelled_deliveries >= 0),
  add column hours_online numeric(8, 2) check (hours_online >= 0);
