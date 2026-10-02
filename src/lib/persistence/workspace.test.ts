import { describe, expect, it } from "vitest";
import type { OnboardingConfig } from "@/domain/onboarding";
import {
  manualPeriodId,
  upsertManualPeriod,
  type SavedManualPeriod,
} from "@/lib/finance/manual-period";
import type { SavedWorkDay } from "@/lib/finance/weekly-summary";
import {
  createEmptyWorkspace,
  deserializeWorkspace,
  isEmptyWorkspace,
  parseOnboardingConfig,
  parseSavedWorkDay,
  parseWorkspace,
  serializeWorkspace,
  WORKSPACE_VERSION,
  type WorkspaceSnapshot,
} from "./workspace";

const config: OnboardingConfig = {
  activity: "ridesharing",
  workMode: "employee",
  platform: "bolt",
  cityName: "Cluj-Napoca",
  cityKey: "cluj-napoca",
  profitView: "together",
  kilometerEntry: "per_platform",
  vehicleOwnership: "rented",
  fuelType: "gasoline_lpg",
  hybridType: null,
  primaryFuel: "lpg",
  consumptionPer100Km: 9.4,
  fleetCommission: { type: "percentage", value: 10, base: "gross" },
  weeklyCimCost: 210,
  effectiveFrom: "2026-09-01",
  recurringCosts: [
    {
      id: "rc-1",
      category: "vehicle_rent",
      label: "Chirie mașină",
      amount: 700,
      period: "weekly",
      effectiveFrom: "2026-09-01",
      paidToFleet: true,
    },
  ],
};

const day: SavedWorkDay = {
  date: "2026-09-02",
  appRevenue: 445.0,
  cashRevenue: 80,
  netEarnings: 415,
  cashInHand: 80,
  applicationCommission: 110,
  platformCosts: 0,
  cashTips: 5,
  privateEarnings: 0,
  amountManagedByFleet: 335,
  result: 190.5,
  resultBeforeCalendarCosts: 320.5,
  fleetBalance: -45.25,
  fleetBalanceBeforeCalendarCosts: -175.25,
  totalEarnings: 420,
  energyCost: 88,
  fleetCommission: 50,
  oneOffCosts: 20,
  hoursWorked: 9.5,
  kilometers: 240,
};

function snapshotWith(overrides: Partial<WorkspaceSnapshot> = {}): WorkspaceSnapshot {
  return { ...createEmptyWorkspace(), config, savedDays: [day], ...overrides };
}

describe("instantaneul spațiului de lucru", () => {
  it("supraviețuiește unui ciclu complet de salvare și citire", () => {
    const restored = deserializeWorkspace(serializeWorkspace(snapshotWith()));

    expect(restored).not.toBeNull();
    expect(restored?.config).toEqual(config);
    expect(restored?.savedDays).toEqual([day]);
    expect(restored?.savedAt).toBeTypeOf("string");
  });

  it("pornește curat dacă versiunea salvată este alta", () => {
    const stale = JSON.stringify({ ...snapshotWith(), version: WORKSPACE_VERSION + 1 });
    expect(deserializeWorkspace(stale)).toBeNull();
  });

  it("nu aruncă la JSON stricat", () => {
    expect(deserializeWorkspace("{ nu este json")).toBeNull();
    expect(deserializeWorkspace(null)).toBeNull();
    expect(deserializeWorkspace("[]")).toBeNull();
  });

  it("consideră gol instantaneul fără cont, configurație și perioade", () => {
    expect(isEmptyWorkspace(createEmptyWorkspace())).toBe(true);
    expect(isEmptyWorkspace(snapshotWith())).toBe(false);
  });

  it("elimină zilele stricate, dar păstrează zilele valide", () => {
    const restored = parseWorkspace({
      ...snapshotWith(),
      savedDays: [day, { date: "nu-e-o-dată" }, null, { ...day, date: "2026-09-01" }],
    });

    expect(restored?.savedDays.map((entry) => entry.date)).toEqual([
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("validarea configurației de onboarding", () => {
  it("respinge un tip de combustibil necunoscut", () => {
    // Un `fuelType` invalid ar strica etichetele din interfață, deci
    // configurația întreagă este respinsă, nu corectată în tăcere.
    expect(parseOnboardingConfig({ ...config, fuelType: "hidrogen" })).toBeNull();
  });

  it("respinge un comision de flotă fără bază de calcul", () => {
    expect(
      parseOnboardingConfig({
        ...config,
        fleetCommission: { type: "percentage", value: 10 },
      }),
    ).toBeNull();
  });

  it("acceptă comisionul fix, care nu are bază de calcul", () => {
    const parsed = parseOnboardingConfig({
      ...config,
      fleetCommission: { type: "fixed", value: 150 },
    });

    expect(parsed?.fleetCommission).toEqual({ type: "fixed", value: 150 });
  });

  it("ignoră un cost recurent invalid fără să piardă restul configurației", () => {
    const parsed = parseOnboardingConfig({
      ...config,
      recurringCosts: [config.recurringCosts[0], { id: "x", category: "necunoscut" }],
    });

    expect(parsed?.recurringCosts).toHaveLength(1);
  });

  it("respinge o dată de intrare în vigoare care nu este ISO", () => {
    expect(parseOnboardingConfig({ ...config, effectiveFrom: "01.09.2026" })).toBeNull();
  });
});

describe("defalcarea pe platformă dintr-o zi salvată", () => {
  const platforms = [
    {
      platform: "bolt" as const,
      appRidePayments: 320,
      campaigns: 9,
      cancellationFees: 6.5,
      appTips: 12,
      cashRidePayments: 180,
      userCredits: 0,
      platformCosts: 0,
      applicationCommission: 128.33,
      cashTips: 8,
      appRevenue: 347.5,
      cashRevenue: 180,
      netEarnings: 399.17,
      cashInHand: 180,
      kilometers: 120,
      energyCost: 73.44,
      fleetCommission: 50,
      totalEarnings: 407.17,
      resultBeforeCommonCosts: 283.73,
    },
    {
      platform: "uber" as const,
      appRidePayments: 210,
      campaigns: 0,
      cancellationFees: 0,
      appTips: 6,
      cashRidePayments: 95,
      userCredits: 4.5,
      platformCosts: 0,
      applicationCommission: 79.61,
      cashTips: 3,
      appRevenue: 216,
      cashRevenue: 99.5,
      netEarnings: 235.89,
      cashInHand: 95,
      kilometers: 60,
      energyCost: 36.72,
      fleetCommission: 30.5,
      totalEarnings: 238.89,
      resultBeforeCommonCosts: 171.67,
    },
  ];

  it("supraviețuiește unui ciclu de salvare și citire", () => {
    const restored = deserializeWorkspace(
      serializeWorkspace(snapshotWith({ savedDays: [{ ...day, platforms }] })),
    );

    expect(restored?.savedDays[0].platforms).toEqual(platforms);
  });

  it("lipsește fără să strice ziua, pentru zilele salvate înainte de defalcare", () => {
    const restored = parseSavedWorkDay({ ...day });

    expect(restored).not.toBeNull();
    expect(restored?.platforms).toBeUndefined();
  });

  it("se ignoră în întregime dacă o platformă este stricată", () => {
    // O defalcare parțială ar da totaluri greșite pe platformă, deci este
    // preferabil să lipsească decât să fie incompletă.
    const restored = parseSavedWorkDay({
      ...day,
      platforms: [platforms[0], { platform: "glovo" }],
    });

    expect(restored?.platforms).toBeUndefined();
  });
});

describe("ce a introdus efectiv șoferul", () => {
  const inputs = {
    sharedKilometers: 200,
    unitPrice: 7.24,
    gasolineCost: 0,
    electricCost: 0,
    washingCost: 40,
    parkingCost: 12.5,
    roadTollCost: 0,
    serviceCost: 0,
    otherCost: 8,
  };

  it("supraviețuiește unui ciclu de salvare și citire", () => {
    // Fără aceste valori ziua nu poate fi corectată și nu poate fi scrisă în
    // `energy_entries` și `expenses`.
    const restored = deserializeWorkspace(
      serializeWorkspace(snapshotWith({ savedDays: [{ ...day, inputs }] })),
    );

    expect(restored?.savedDays[0].inputs).toEqual(inputs);
  });

  it("lipsește fără să strice ziua, pentru zilele salvate mai demult", () => {
    const restored = parseSavedWorkDay({ ...day });

    expect(restored).not.toBeNull();
    expect(restored?.inputs).toBeUndefined();
  });

  it("completează cu zero câmpurile lipsă, în loc să respingă ziua", () => {
    const restored = parseSavedWorkDay({ ...day, inputs: { unitPrice: 7.5 } });

    expect(restored?.inputs?.unitPrice).toBe(7.5);
    expect(restored?.inputs?.washingCost).toBe(0);
  });
});

describe("citirea unei zile salvate", () => {
  it("completează cu zero valorile numerice lipsă", () => {
    const parsed = parseSavedWorkDay({ date: "2026-09-03" });

    expect(parsed?.date).toBe("2026-09-03");
    expect(parsed?.netEarnings).toBe(0);
    expect(parsed?.kilometers).toBe(0);
  });

  it("respinge o zi fără dată validă", () => {
    expect(parseSavedWorkDay({ netEarnings: 100 })).toBeNull();
  });

  it("o zi salvată ieri, doar cu câștigul net, păstrează exact aceleași totaluri", () => {
    const parsed = parseSavedWorkDay({
      date: "2026-10-01",
      netEarnings: 1225.78,
      cashInHand: 566.3,
      applicationCommission: 395.72,
      platformCosts: 0,
      cashTips: 0,
      platforms: [
        {
          platform: "bolt",
          netEarnings: 1225.78,
          cashInHand: 566.3,
          applicationCommission: 395.72,
          platformCosts: 0,
          cashTips: 0,
          kilometers: 0,
        },
      ],
    });

    expect(parsed?.netEarnings).toBe(1225.78);
    expect(parsed?.amountManagedByFleet).toBeCloseTo(659.48, 2);
    expect(parsed?.platforms?.[0].netEarnings).toBeCloseTo(1225.78, 2);
    expect(parsed?.platforms?.[0].cashRidePayments).toBe(566.3);
  });

  it("traduce o zi salvată în modelul vechi card/cash în modelul net", () => {
    // Înainte se introduceau separat încasările card, cash, comisionul,
    // compensările și tips-ul din aplicație.
    const parsed = parseSavedWorkDay({
      date: "2026-09-01",
      cardEarnings: 803.9,
      cashEarnings: 566.3,
      applicationCommission: 395.72,
      compensations: 231.3,
      appTips: 20,
      cashTips: 0,
      platforms: [
        {
          platform: "bolt",
          cardEarnings: 803.9,
          cashEarnings: 566.3,
          applicationCommission: 395.72,
          compensations: 231.3,
          appTips: 20,
          cashTips: 0,
          kilometers: 500,
        },
      ],
    });

    expect(parsed?.netEarnings).toBeCloseTo(1225.78, 2);
    expect(parsed?.cashInHand).toBe(566.3);
    expect(parsed?.amountManagedByFleet).toBeCloseTo(659.48, 2);
    expect(parsed?.platforms?.[0].netEarnings).toBeCloseTo(1225.78, 2);
    expect(parsed?.platforms?.[0].cashInHand).toBe(566.3);
    expect(parsed?.platforms?.[0].appRidePayments).toBe(803.9);
    expect(parsed?.platforms?.[0].cashRidePayments).toBe(566.3);
  });
});

describe("perioadele introduse manual", () => {
  const base: SavedManualPeriod = {
    id: manualPeriodId("week", "2026-08-31", "2026-09-06"),
    periodType: "week",
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    values: {
      platforms: [
        {
          platform: "bolt" as const,
          appRidePayments: 1000,
          campaigns: 0,
          cancellationFees: 0,
          appTips: 0,
          cashRidePayments: 200,
          userCredits: 0,
          platformCosts: 0,
          applicationCommission: 260,
          cashTips: 0,
          kilometers: 1200,
        },
      ],
      sharedKilometers: 0,
      privateEarnings: 0,
      workedDays: 5,
      hoursWorked: 45,
      unitPrice: 7.4,
      gasolineCost: 0,
      electricCost: 0,
      washingCost: 40,
      parkingCost: 0,
      roadTollCost: 0,
      serviceCost: 0,
      otherCost: 0,
    },
    result: {
      grossPlatformEarnings: 1200,
      applicationCommission: 260,
      platformCosts: 0,
      platformNetEarnings: 940,
      cashInHand: 200,
      totalEarnings: 940,
      energyCost: 300,
      fleetCommission: 120,
      cimCost: 210,
      recurringCosts: 700,
      recurringFleetCosts: 700,
      oneOffCosts: 40,
      totalExpenses: 1370,
      result: -430,
      resultPerKm: -0.3583,
      amountManagedByFleet: 740,
      fleetBalance: 290,
    },
    contribution: {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      appRevenue: 1000.0,
      cashRevenue: 200,
      netEarnings: 940,
      cashInHand: 200,
      applicationCommission: 260,
      platformCosts: 0,
      cashTips: 0,
      privateEarnings: 0,
      amountManagedByFleet: 740,
      totalEarnings: 940,
      energyCost: 300,
      fleetCommission: 120,
      oneOffCosts: 40,
      resultBeforeCalendarCosts: 480,
      fleetBalanceBeforeCalendarCosts: -620,
      hoursWorked: 45,
      kilometers: 1200,
    },
  };

  it("actualizează aceeași perioadă în loc să o dubleze", () => {
    const updated = { ...base, values: { ...base.values, workedDays: 6 } };
    const list = upsertManualPeriod(upsertManualPeriod([], base), updated);

    expect(list).toHaveLength(1);
    expect(list[0].values.workedDays).toBe(6);
  });

  it("păstrează separat săptămâna și luna care încep în aceeași zi", () => {
    const month: SavedManualPeriod = {
      ...base,
      id: manualPeriodId("month", "2026-08-31", "2026-09-30"),
      periodType: "month",
      endDate: "2026-09-30",
    };

    expect(upsertManualPeriod([base], month)).toHaveLength(2);
  });

  it("trece printr-un ciclu de salvare și citire fără pierderi", () => {
    const restored = deserializeWorkspace(
      serializeWorkspace(snapshotWith({ manualPeriods: [base] })),
    );

    expect(restored?.manualPeriods).toEqual([base]);
  });
});
