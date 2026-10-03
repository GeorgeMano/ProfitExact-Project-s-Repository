-- Delivery: Glovo, Wolt și Bolt Food, livrate cu mașina, scuterul sau bicicleta.

-- Cu ce se lucrează. La ridesharing este întotdeauna mașina.
alter table public.vehicles
  add column vehicle_type text not null default 'car'
    check (vehicle_type in ('car', 'moto', 'e_bike', 'bicycle'));

-- Costuri noi: contractul de afiliere (sumă fixă) și întreținerea bicicletei
-- sau a scuterului.
alter table public.recurring_costs
  drop constraint recurring_costs_category_check;

alter table public.recurring_costs
  add constraint recurring_costs_category_check check (
    category in (
      'accounting', 'cash_register', 'fleet_withholding', 'vehicle_rent',
      'rca', 'casco', 'itp', 'vignette', 'leasing', 'phone_internet',
      'arr_authorization', 'employee_salary', 'bank_fees', 'business_other',
      'transport_license', 'certified_copy', 'vehicle_badges',
      'affiliation_fee', 'vehicle_maintenance'
    )
  );
