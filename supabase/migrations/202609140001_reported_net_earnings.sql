-- Modelul curent Bolt/Uber pornește de la câștigul net raportat de aplicație.
-- Comisionul și costurile platformei rămân vizibile pentru transparență, dar
-- sunt deja incluse în net și nu trebuie scăzute încă o dată din rezultat.

alter table public.platform_earnings
  add column if not exists reported_net_earnings numeric(14, 2),
  add column if not exists cash_in_hand numeric(14, 2),
  add column if not exists platform_costs numeric(14, 2) not null default 0;

alter table public.work_entries
  add column if not exists reported_net_earnings numeric(14, 2),
  add column if not exists cash_in_hand numeric(14, 2),
  add column if not exists platform_costs numeric(14, 2) not null default 0;

-- Valoarea exactă a comisionului poate lipsi din raportul utilizatorului.
-- NULL înseamnă „necunoscut”; 0 rămâne o valoare confirmată distinctă.
alter table public.platform_earnings
  alter column application_commission drop not null,
  alter column application_commission drop default;

-- Câmpurile vechi împărțeau greșit venitul între card și numerar. Sunt păstrate
-- pentru istoricul existent, dar salvările din noul model le pot lăsa NULL.
alter table public.platform_earnings
  alter column card_earnings drop not null,
  alter column card_earnings drop default,
  alter column cash_earnings drop not null,
  alter column cash_earnings drop default;

alter table public.platform_earnings
  drop constraint if exists platform_earnings_reported_net_earnings_check,
  drop constraint if exists platform_earnings_cash_in_hand_check,
  drop constraint if exists platform_earnings_platform_costs_check;

alter table public.platform_earnings
  add constraint platform_earnings_reported_net_earnings_check
    check (reported_net_earnings >= 0),
  add constraint platform_earnings_cash_in_hand_check
    check (cash_in_hand >= 0),
  add constraint platform_earnings_platform_costs_check
    check (platform_costs >= 0);

alter table public.work_entries
  drop constraint if exists work_entries_reported_net_earnings_check,
  drop constraint if exists work_entries_cash_in_hand_check,
  drop constraint if exists work_entries_platform_costs_check;

alter table public.work_entries
  add constraint work_entries_reported_net_earnings_check
    check (reported_net_earnings >= 0),
  add constraint work_entries_cash_in_hand_check
    check (cash_in_hand >= 0),
  add constraint work_entries_platform_costs_check
    check (platform_costs >= 0);

comment on column public.platform_earnings.reported_net_earnings is
  'Câștigul net exact afișat de aplicație pentru platformă; NULL înseamnă că valoarea nu a fost confirmată.';
comment on column public.platform_earnings.cash_in_hand is
  'Numerarul rămas efectiv la șofer, inclus deja în câștigul net raportat; NULL înseamnă necunoscut.';
comment on column public.platform_earnings.platform_costs is
  'Costuri și taxe exacte afișate de platformă, deja reflectate în câștigul net și păstrate numai pentru transparență.';
comment on column public.platform_earnings.application_commission is
  'Comisionul exact afișat de platformă, deja reflectat în câștigul net; NULL înseamnă necunoscut.';
comment on column public.platform_earnings.card_earnings is
  'Câmp vechi, păstrat numai pentru compatibilitatea înregistrărilor anterioare modelului bazat pe net.';
comment on column public.platform_earnings.cash_earnings is
  'Câmp vechi, păstrat numai pentru compatibilitatea înregistrărilor anterioare modelului bazat pe net.';

comment on column public.work_entries.reported_net_earnings is
  'Suma câștigurilor nete confirmate pentru platformele acestei perioade.';
comment on column public.work_entries.cash_in_hand is
  'Suma numerarului rămas efectiv la șofer pentru platformele acestei perioade.';
comment on column public.work_entries.platform_costs is
  'Suma costurilor platformelor, deja reflectată în câștigul net raportat.';
