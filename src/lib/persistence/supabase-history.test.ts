import { describe, expect, it } from "vitest";
import type { OnboardingConfig } from "@/domain/onboarding";
import { emptyPlatformEntry } from "@/lib/finance/platform-entry";
import { buildSavedWorkDay } from "@/lib/finance/work-day";
import { rebuildHistory, type HistoryRows } from "./supabase-history";

const config: OnboardingConfig = {
  activity: "ridesharing",
  workMode: "employee",
  legalForm: null,
  taxRegime: null,
  platform: "bolt",
  deliveryPlatforms: [],
  cityName: "Pitesti",
  cityKey: "pitesti",
  profitView: "together",
  kilometerEntry: "per_platform",
  vehicleOwnership: "owned",
  vehicleType: "car",
  fuelType: "gasoline",
  hybridType: null,
  primaryFuel: null,
  consumptionPer100Km: 7,
  fleetCommission: { type: "percentage", value: 10, base: "net" },
  weeklyCimCost: 50,
  effectiveFrom: "2026-08-01",
  recurringCosts: [],
};

/** Ziua așa cum ajunge în tabele: numerele vin ca text, ca din PostgREST. */
const rows: HistoryRows = {
  entries: [
    {
      id: "day-1",
      period_type: "day",
      period_start: "2026-09-01",
      period_end: "2026-09-01",
      worked_days: 1,
      worked_hours: "9.50",
      total_kilometers: "500.00",
      private_earnings: "40.00",
    },
    {
      id: "week-1",
      period_type: "week",
      period_start: "2026-09-07",
      period_end: "2026-09-13",
      worked_days: 5,
      worked_hours: "45",
      total_kilometers: "900",
      private_earnings: "0",
    },
  ],
  platforms: [
    {
      work_entry_id: "day-1",
      platform: "bolt",
      card_earnings: "803.90",
      campaigns: "9.00",
      cancellation_fees: "24.00",
      app_tips: "20.00",
      cash_earnings: "566.30",
      user_credits: "198.30",
      compensations: "0",
      platform_costs: "0",
      application_commission: "395.72",
      cash_tips: "15.00",
      kilometers: "500.00",
    },
    {
      work_entry_id: "week-1",
      platform: "bolt",
      card_earnings: 1200,
      campaigns: 0,
      cancellation_fees: 0,
      app_tips: 0,
      cash_earnings: 300,
      user_credits: 0,
      compensations: 0,
      platform_costs: 0,
      application_commission: null,
      cash_tips: 0,
      kilometers: 900,
    },
  ],
  energy: [
    { work_entry_id: "day-1", unit_price: "9.7800", gasoline_cost: 0, electric_cost: 0 },
  ],
  expenses: [
    { work_entry_id: "day-1", category: "washing", amount: "20.00" },
    { work_entry_id: "day-1", category: "parking", amount: "5.50" },
  ],
};

describe("istoricul citit din cont", () => {
  const history = rebuildHistory(config, rows);

  it("reface ziua exact ca la introducere", () => {
    const expected = buildSavedWorkDay(config, {
      date: "2026-09-01",
      platforms: [
        {
          ...emptyPlatformEntry("bolt"),
          appRidePayments: 803.9,
          campaigns: 9,
          cancellationFees: 24,
          appTips: 20,
          cashRidePayments: 566.3,
          userCredits: 198.3,
          applicationCommission: 395.72,
          cashTips: 15,
          kilometers: 500,
        },
      ],
      privateEarnings: 40,
      hoursWorked: 9.5,
      inputs: {
        sharedKilometers: 500,
        unitPrice: 9.78,
        gasolineCost: 0,
        electricCost: 0,
        washingCost: 20,
        parkingCost: 5.5,
        roadTollCost: 0,
        serviceCost: 0,
        otherCost: 0,
      },
    });

    expect(history.savedDays).toEqual([expected]);
  });

  it("păstrează cifrele din ecranul Bolt și banii la flotă", () => {
    const [day] = history.savedDays;

    expect(day.netEarnings).toBe(1225.78);
    expect(day.cashInHand).toBe(566.3);
    expect(day.amountManagedByFleet).toBe(659.48);
    // 500 km × 7 l/100 km × 9,78 RON
    expect(day.energyCost).toBe(342.3);
  });

  it("sare peste o perioadă fără comision și spune câte au fost sărite", () => {
    expect(history.manualPeriods).toHaveLength(0);
    expect(history.skipped).toBe(1);
  });

  it("reface o săptămână introdusă manual când comisionul există", () => {
    const withCommission = rebuildHistory(config, {
      ...rows,
      platforms: rows.platforms.map((row) =>
        row.work_entry_id === "week-1" ? { ...row, application_commission: 300 } : row,
      ),
    });
    const [week] = withCommission.manualPeriods;

    expect(week.periodType).toBe("week");
    expect(week.startDate).toBe("2026-09-07");
    expect(week.values.workedDays).toBe(5);
    // 1.200 + 300 − 300 = 1.200 net; la flotă 1.200 − 300 = 900
    expect(week.contribution.netEarnings).toBe(1200);
    expect(week.contribution.amountManagedByFleet).toBe(900);
  });
});
