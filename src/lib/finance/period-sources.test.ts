import { describe, expect, it } from "vitest";
import type { OnboardingConfig } from "@/domain/onboarding";
import { createEmptyManualPeriodValues } from "./manual-period";
import { emptyPlatformEntry } from "./platform-entry";
import { resolvePeriod } from "./period-sources";
import { summarizeContributions } from "./weekly-summary";
import { buildManualPeriod, buildSavedWorkDay } from "./work-day";

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
  weeklyCimCost: 0,
  effectiveFrom: "2026-08-01",
  recurringCosts: [],
};

const noInputs = {
  sharedKilometers: 0,
  unitPrice: 0,
  gasolineCost: 0,
  electricCost: 0,
  washingCost: 0,
  parkingCost: 0,
  roadTollCost: 0,
  serviceCost: 0,
  otherCost: 0,
};

function day(date: string, rides: number) {
  return buildSavedWorkDay(config, {
    date,
    platforms: [{ ...emptyPlatformEntry("bolt"), appRidePayments: rides, applicationCommission: 0 }],
    privateEarnings: 0,
    hoursWorked: 8,
    inputs: noInputs,
  })!;
}

function total(periodType: "week" | "month", startDate: string, endDate: string, rides: number, workedDays: number) {
  const values = createEmptyManualPeriodValues(["bolt"]);
  values.platforms = [{ ...emptyPlatformEntry("bolt"), appRidePayments: rides, applicationCommission: 0, kilometers: 900 }];
  values.workedDays = workedDays;
  return buildManualPeriod(config, periodType, startDate, endDate, values)!;
}

const net = (resolved: ReturnType<typeof resolvePeriod>) =>
  summarizeContributions(resolved.contributions, resolved.periodType, resolved.startDate, resolved.endDate).totalNetEarnings;

// Săptămâna 31 aug. – 6 sept. 2026 și luna septembrie 2026.
const monday = day("2026-08-31", 100);
const tuesday = day("2026-09-01", 200);
const weekTotal = total("week", "2026-08-31", "2026-09-06", 1000, 5);
const nextWeekDay = day("2026-09-08", 50);

describe("ce intră în calculul săptămânii", () => {
  it("fără total, se adună zilele salvate", () => {
    const resolved = resolvePeriod("week", "2026-09-02", [monday, tuesday], []);

    expect(resolved.source).toBe("automatic");
    expect(net(resolved)).toBe(300);
    expect(resolved.workedDays).toBe(2);
    expect(resolved.estimatedKilometers).toBe(false);
  });

  it("totalul săptămânii înlocuiește zilele, fără să le adune de două ori", () => {
    const resolved = resolvePeriod("week", "2026-09-02", [monday, tuesday], [weekTotal]);

    expect(resolved.source).toBe("manual");
    expect(net(resolved)).toBe(1000);
    expect(resolved.replacedDays.map((item) => item.date)).toEqual(["2026-08-31", "2026-09-01"]);
    expect(resolved.workedDays).toBe(5);
    expect(resolved.estimatedKilometers).toBe(true);
  });

  it("fără date, nu există nicio sursă", () => {
    expect(resolvePeriod("week", "2026-09-02", [], []).source).toBe("none");
  });
});

describe("ce intră în calculul lunii", () => {
  const firstWeekOfSeptember = total("week", "2026-09-07", "2026-09-13", 700, 4);

  it("adună zilele și săptămânile introduse ca total, fără suprapuneri", () => {
    const withDayInsideWeek = day("2026-09-09", 999);
    const resolved = resolvePeriod(
      "month",
      "2026-09-15",
      [tuesday, withDayInsideWeek, day("2026-09-20", 80)],
      [firstWeekOfSeptember],
    );

    // 200 (1 sept.) + 700 (săptămâna 7–13) + 80 (20 sept.). Ziua de 9 sept.
    // este cuprinsă în totalul săptămânii, deci nu se adună.
    expect(net(resolved)).toBe(980);
    expect(resolved.replacedDays.map((item) => item.date)).toEqual(["2026-09-09"]);
    expect(resolved.workedDays).toBe(2 + 4);
    expect(resolved.estimatedKilometers).toBe(true);
  });

  it("totalul lunii înlocuiește tot ce e în lună", () => {
    const monthTotal = total("month", "2026-09-01", "2026-09-30", 4000, 22);
    const resolved = resolvePeriod("month", "2026-09-15", [tuesday, nextWeekDay], [firstWeekOfSeptember, monthTotal]);

    expect(resolved.source).toBe("manual");
    expect(net(resolved)).toBe(4000);
    expect(resolved.replacedDays).toHaveLength(2);
    expect(resolved.replacedWeeks).toEqual([firstWeekOfSeptember]);
  });

  it("o săptămână care trece peste granița lunii intră proporțional, ca estimare", () => {
    // 31 aug. – 6 sept.: 1 zi în august, 6 zile în septembrie.
    const september = resolvePeriod("month", "2026-09-15", [], [weekTotal]);
    const august = resolvePeriod("month", "2026-08-15", [], [weekTotal]);

    expect(september.partialWeeks[0].daysInPeriod).toBe(6);
    expect(net(september)).toBeCloseTo((1000 * 6) / 7, 1);
    expect(net(august)).toBeCloseTo(1000 / 7, 1);
    // Nimic nu se pierde și nimic nu se dublează între cele două luni.
    expect(net(september) + net(august)).toBeCloseTo(1000, 1);
    expect(september.estimatedKilometers).toBe(true);
  });

  it("zilele salvate din săptămâna care trece peste lună nu se adună peste ea", () => {
    const resolved = resolvePeriod("month", "2026-09-15", [tuesday], [weekTotal]);

    expect(resolved.replacedDays.map((item) => item.date)).toEqual(["2026-09-01"]);
    expect(net(resolved)).toBeCloseTo((1000 * 6) / 7, 1);
  });
});
