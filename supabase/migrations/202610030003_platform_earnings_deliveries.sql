-- Numărul de livrări finalizate, ca pe ecranele Wolt și Bolt Food.
-- Este informativ: nu intră în calculul banilor.
alter table public.platform_earnings
  add column deliveries integer check (deliveries >= 0);
