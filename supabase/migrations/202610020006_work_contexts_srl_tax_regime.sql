-- Cum este impozitat SRL-ul (microîntreprindere sau impozit pe profit),
-- folosit la estimarea taxelor. Null = utilizatorul nu știe încă.
alter table public.work_contexts
  add column srl_tax_regime text check (srl_tax_regime in ('micro', 'profit')),
  add constraint work_contexts_srl_tax_regime_only_srl
    check (srl_tax_regime is null or legal_form = 'srl');
