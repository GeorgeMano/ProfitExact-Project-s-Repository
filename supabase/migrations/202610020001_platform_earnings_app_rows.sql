-- Încasările se introduc rând cu rând, exact ca în ecranul „Defalcarea
-- câștigurilor” din Bolt/Uber:
--   Venituri în aplicație: plăți pentru curse (card_earnings), campanii,
--     taxe de anulare, bacșiș (app_tips)
--   Venituri în numerar: plăți pentru curse (cash_earnings), credite și
--     promoții pentru utilizatori
--   Costuri și taxe (platform_costs), comision (application_commission)
-- Câștigul net (reported_net_earnings) și numerarul în mână (cash_in_hand) se
-- calculează din ele. Creditele și promoțiile ajung la flotă, nu la șofer.

alter table public.platform_earnings
  add column if not exists campaigns numeric(14, 2) not null default 0,
  add column if not exists cancellation_fees numeric(14, 2) not null default 0,
  add column if not exists user_credits numeric(14, 2) not null default 0;

alter table public.platform_earnings
  drop constraint if exists platform_earnings_campaigns_check,
  drop constraint if exists platform_earnings_cancellation_fees_check,
  drop constraint if exists platform_earnings_user_credits_check;

alter table public.platform_earnings
  add constraint platform_earnings_campaigns_check check (campaigns >= 0),
  add constraint platform_earnings_cancellation_fees_check check (cancellation_fees >= 0),
  add constraint platform_earnings_user_credits_check check (user_credits >= 0);

comment on column public.platform_earnings.card_earnings is
  'Venituri în aplicație → plăți pentru curse.';
comment on column public.platform_earnings.cash_earnings is
  'Venituri în numerar → plăți pentru curse. Singurii bani rămași fizic la șofer.';
comment on column public.platform_earnings.campaigns is
  'Venituri în aplicație → campanii.';
comment on column public.platform_earnings.cancellation_fees is
  'Venituri în aplicație → taxe de anulare.';
comment on column public.platform_earnings.user_credits is
  'Venituri în numerar → credite și promoții pentru utilizatori; plătite de aplicație, ajung la flotă.';
comment on column public.platform_earnings.compensations is
  'Câmp vechi; înlocuit de campaigns, cancellation_fees și user_credits.';
