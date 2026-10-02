-- Cum introduce șoferul kilometrii când lucrează pe două platforme.
--
--   'per_platform' — kilometrii fiecărei aplicații, luați din ecranul ei.
--                    Exacți pe platformă, dar nu cuprind mersul în gol:
--                    drumul până la client, între curse și spre casă.
--   'shared'       — un singur total real al zilei sau al perioadei, care
--                    include și mersul în gol. Kilometrii fiecărei platforme se
--                    deduc proporțional cu încasările, deci combustibilul este
--                    corect, iar repartizarea pe platformă este o aproximare
--                    asumată.
--
-- Alegerea contează numai pentru „Bolt + Uber”; pe o singură platformă
-- kilometrii sunt oricum ai ei.

alter table public.work_contexts
  add column if not exists kilometer_entry text not null default 'per_platform';

alter table public.work_contexts
  drop constraint if exists work_contexts_kilometer_entry_check;

alter table public.work_contexts
  add constraint work_contexts_kilometer_entry_check
  check (kilometer_entry = any (array['per_platform'::text, 'shared'::text]));

comment on column public.work_contexts.kilometer_entry is
  'per_platform = kilometri introduși pe fiecare aplicație; shared = un total al perioadei, repartizat pe platforme după încasări.';
