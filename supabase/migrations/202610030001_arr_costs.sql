-- Costurile ARR pentru transport alternativ, în ordinea obținerii:
-- licența de transport (o singură dată), copia conformă și ecusoanele.
alter table public.recurring_costs
  drop constraint recurring_costs_category_check;

alter table public.recurring_costs
  add constraint recurring_costs_category_check check (
    category in (
      'accounting', 'cash_register', 'fleet_withholding', 'vehicle_rent',
      'rca', 'casco', 'itp', 'vignette', 'leasing', 'phone_internet',
      'arr_authorization', 'employee_salary', 'bank_fees', 'business_other',
      'transport_license', 'certified_copy', 'vehicle_badges'
    )
  );

-- Un cost plătit o singură dată se împarte pe perioada de valabilitate și
-- apoi nu se mai adaugă (de exemplu licența de transport alternativ).
alter table public.recurring_costs
  add column one_time boolean not null default false,
  add constraint recurring_costs_one_time_has_validity
    check (not one_time or period = 'validity');
