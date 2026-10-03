-- Costurile recurente ale propriei firme (SRL / PFA): autorizația de transport
-- alternativ (ARR), salariul unui angajat, comisioanele bancare și alte costuri.
alter table public.recurring_costs
  drop constraint recurring_costs_category_check;

alter table public.recurring_costs
  add constraint recurring_costs_category_check check (
    category in (
      'accounting', 'cash_register', 'fleet_withholding', 'vehicle_rent',
      'rca', 'casco', 'itp', 'vignette', 'leasing', 'phone_internet',
      'arr_authorization', 'employee_salary', 'bank_fees', 'business_other'
    )
  );

-- La propria firmă nu există flotă, deci niciun cost nu este plătit flotei.
create or replace function private.own_business_costs_not_paid_to_fleet()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.paid_to_fleet and exists (
    select 1 from public.work_contexts c
    where c.id = new.context_id and c.work_mode = 'own_business'
  ) then
    new.paid_to_fleet := false;
  end if;
  return new;
end;
$$;

create trigger recurring_costs_own_business_not_paid_to_fleet
  before insert or update on public.recurring_costs
  for each row execute function private.own_business_costs_not_paid_to_fleet();
