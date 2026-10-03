-- Modul de impozitare acoperă acum ambele forme de firmă:
--   SRL: microîntreprindere sau impozit pe profit;
--   PFA: sistem real sau normă de venit.
-- Null = utilizatorul nu știe încă.
alter table public.work_contexts
  drop constraint work_contexts_srl_tax_regime_check,
  drop constraint work_contexts_srl_tax_regime_only_srl;

alter table public.work_contexts
  rename column srl_tax_regime to tax_regime;

alter table public.work_contexts
  add constraint work_contexts_tax_regime_matches_legal_form check (
    tax_regime is null
    or (legal_form = 'srl' and tax_regime in ('micro', 'profit'))
    or (legal_form = 'pfa' and tax_regime in ('real', 'norm'))
  );
