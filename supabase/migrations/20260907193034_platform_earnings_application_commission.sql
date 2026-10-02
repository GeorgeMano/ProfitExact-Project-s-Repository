-- Comisionul oprit de aplicație, salvat pe fiecare platformă.
--
-- Motivul: este singurul câmp obligatoriu din calculul zilnic și se introduce
-- exact, din ecranul fiecărei aplicații — procentul calculat automat nu se
-- potrivește cu ce afișează Bolt, iar la Uber comisionul este variabil.
-- Până acum nu exista nicio coloană pentru el, nici în `work_entries`, nici în
-- `platform_earnings`, deci valoarea introdusă supraviețuia numai scăzută în
-- `computed_total_earnings` și nu putea fi verificată sau reafișată.

alter table public.platform_earnings
  add column if not exists application_commission numeric not null default 0;

alter table public.platform_earnings
  drop constraint if exists platform_earnings_application_commission_check;

alter table public.platform_earnings
  add constraint platform_earnings_application_commission_check
  check (application_commission >= 0);

comment on column public.platform_earnings.application_commission is
  'Suma exactă oprită de aplicație pentru această platformă, introdusă manual sau citită din screenshot. Nu se estimează procentual.';
