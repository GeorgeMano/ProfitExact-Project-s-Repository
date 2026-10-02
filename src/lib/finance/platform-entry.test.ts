import { describe, expect, it } from "vitest";
import { calculateDailyResult, roundMoney, type FleetCommission } from "./daily-result";
import {
  calculatePlatformBreakdown,
  combinePlatformEntries,
  distributeAmount,
  emptyPlatformEntry,
  hasRequiredEarnings,
  platformEntryTotals,
  type PlatformEntryInput,
} from "./platform-entry";

const bolt: PlatformEntryInput = {
  ...emptyPlatformEntry("bolt"),
  appRidePayments: 320.45,
  campaigns: 15.5,
  appTips: 12,
  cashRidePayments: 180.2,
  applicationCommission: 128.33,
  cashTips: 8,
  kilometers: 121.4,
};

const uber: PlatformEntryInput = {
  ...emptyPlatformEntry("uber"),
  appRidePayments: 210.15,
  campaigns: 4.5,
  appTips: 6,
  cashRidePayments: 95.8,
  applicationCommission: 79.61,
  cashTips: 3,
  kilometers: 63.7,
};

const energy = { type: "calculated" as const, consumptionPer100Km: 8.5, unitPrice: 7.24 };

/** Suma rezultatelor pe platformă plus cursele private, minus costurile comune. */
function dayResultFromPlatforms(
  entries: PlatformEntryInput[],
  fleetCommission: FleetCommission,
  common: { privateEarnings: number; cimCost: number; recurring: number; oneOff: number },
) {
  const breakdown = calculatePlatformBreakdown({ entries, energy, fleetCommission });
  const fixedFleetCost = fleetCommission.type === "fixed" ? fleetCommission.value : 0;

  return roundMoney(
    breakdown.reduce((sum, item) => sum + item.resultBeforeCommonCosts, 0) +
      common.privateEarnings -
      fixedFleetCost -
      common.cimCost -
      common.recurring -
      common.oneOff,
  );
}

/** Același calcul, pe totalurile zilei, exact ca în modul „împreună”. */
function dayResultCombined(
  entries: PlatformEntryInput[],
  fleetCommission: FleetCommission,
  common: { privateEarnings: number; cimCost: number; recurring: number; oneOff: number },
) {
  const combined = combinePlatformEntries(entries);

  return calculateDailyResult({
    ...combined,
    privateEarnings: common.privateEarnings,
    energy,
    fleetCommission,
    weeklyCimCost: common.cimCost * 7,
    recurringDailyCosts: common.recurring,
    recurringFleetCosts: 0,
    oneOffDailyCosts: common.oneOff,
  }).result;
}

describe("invariantul dintre „împreună” și „separat”", () => {
  const common = { privateEarnings: 40, cimCost: 128.57, recurring: 114.29, oneOff: 20 };

  it("dă același profit al zilei cu comision procentual din brut", () => {
    const commission: FleetCommission = { type: "percentage", value: 10, base: "gross" };

    expect(dayResultFromPlatforms([bolt, uber], commission, common)).toBe(
      dayResultCombined([bolt, uber], commission, common),
    );
  });

  it("dă același profit al zilei cu comision procentual din net", () => {
    const commission: FleetCommission = { type: "percentage", value: 12.5, base: "net" };

    expect(dayResultFromPlatforms([bolt, uber], commission, common)).toBe(
      dayResultCombined([bolt, uber], commission, common),
    );
  });

  it("dă același profit al zilei cu comision fix, care rămâne cost comun", () => {
    const commission: FleetCommission = { type: "fixed", value: 75 };
    const breakdown = calculatePlatformBreakdown({
      entries: [bolt, uber],
      energy,
      fleetCommission: commission,
    });

    // Un comision fix este o sumă unică a zilei, nu un procent din încasări,
    // deci nu se repartizează pe platforme.
    expect(breakdown.map((item) => item.fleetCommission)).toEqual([0, 0]);
    expect(dayResultFromPlatforms([bolt, uber], commission, common)).toBe(
      dayResultCombined([bolt, uber], commission, common),
    );
  });

  it("rămâne valabil și cu o singură platformă", () => {
    const commission: FleetCommission = { type: "percentage", value: 10, base: "gross" };

    expect(dayResultFromPlatforms([bolt], commission, common)).toBe(
      dayResultCombined([bolt], commission, common),
    );
  });
});

describe("repartizarea sumelor derivate", () => {
  it("suma părților este exact totalul, fără un ban în plus sau în minus", () => {
    const parts = distributeAmount(110.01, [1, 1]);

    // 110,01 împărțit în două dă 55,005: o parte ia 55,01, cealaltă 55,00.
    expect(parts).toEqual([55, 55.01]);
    expect(roundMoney(parts.reduce((sum, part) => sum + part, 0))).toBe(110.01);
  });

  it("respectă proporția kilometrilor", () => {
    const [primul, aldoilea] = distributeAmount(300, [120, 60]);

    expect(primul).toBe(200);
    expect(aldoilea).toBe(100);
  });

  it("împarte egal când nu există nicio bază de repartizare", () => {
    // Zero kilometri pe ambele platforme: suma nu are voie să dispară din total.
    expect(distributeAmount(50, [0, 0])).toEqual([25, 25]);
  });

  it("nu pierde nimic la trei părți inegale", () => {
    const parts = distributeAmount(100, [1, 1, 1]);

    expect(roundMoney(parts.reduce((sum, part) => sum + part, 0))).toBe(100);
  });
});

describe("defalcarea pe platformă", () => {
  const breakdown = calculatePlatformBreakdown({
    entries: [bolt, uber],
    energy,
    fleetCommission: { type: "percentage", value: 10, base: "gross" },
  });

  it("separă combustibilul după kilometrii fiecărei platforme", () => {
    const total = roundMoney(((121.4 + 63.7) * 8.5 * 7.24) / 100);

    expect(
      roundMoney(breakdown.reduce((sum, item) => sum + item.energyCost, 0)),
    ).toBe(total);
    expect(breakdown[0].energyCost).toBeGreaterThan(breakdown[1].energyCost);
  });

  it("păstrează comisionul exact introdus pentru fiecare aplicație", () => {
    expect(breakdown[0].applicationCommission).toBe(128.33);
    expect(breakdown[1].applicationCommission).toBe(79.61);
  });

  it("calculează câștigul pe kilometru al fiecărei platforme", () => {
    expect(breakdown[0].resultPerKm).toBeCloseTo(
      breakdown[0].resultBeforeCommonCosts / 121.4,
      6,
    );
  });
});

describe("modul „kilometri în comun”", () => {
  const commission: FleetCommission = { type: "percentage", value: 10, base: "gross" };

  it("repartizează kilometrii proporțional cu încasările", () => {
    const breakdown = calculatePlatformBreakdown({
      entries: [bolt, uber],
      energy,
      fleetCommission: commission,
      sharedKilometers: 200,
    });

    const total = breakdown.reduce((sum, item) => sum + item.kilometers, 0);
    expect(roundMoney(total)).toBe(200);
    expect(breakdown[0].kilometers).toBeGreaterThan(breakdown[1].kilometers);
    expect(breakdown[0].kilometers / 200).toBeCloseTo(
      breakdown[0].totalEarnings /
        (breakdown[0].totalEarnings + breakdown[1].totalEarnings),
      4,
    );
  });

  it("folosește totalul introdus, nu suma kilometrilor din aplicații", () => {
    // Cei 185,1 km din aplicații ignoră mersul în gol; totalul real este 200.
    const combined = combinePlatformEntries([bolt, uber], 200);

    expect(combined.kilometers).toBe(200);
  });

  it("dă un combustibil mai mare, fiindcă include mersul în gol", () => {
    const perPlatform = calculatePlatformBreakdown({
      entries: [bolt, uber],
      energy,
      fleetCommission: commission,
    });
    const shared = calculatePlatformBreakdown({
      entries: [bolt, uber],
      energy,
      fleetCommission: commission,
      sharedKilometers: 200,
    });

    const sum = (items: typeof perPlatform) =>
      roundMoney(items.reduce((total, item) => total + item.energyCost, 0));

    expect(sum(shared)).toBeGreaterThan(sum(perPlatform));
  });

  it("păstrează invariantul: același profit al zilei în ambele moduri de vizualizare", () => {
    const common = { privateEarnings: 40, cimCost: 128.57, recurring: 114.29, oneOff: 20 };
    const breakdown = calculatePlatformBreakdown({
      entries: [bolt, uber],
      energy,
      fleetCommission: commission,
      sharedKilometers: 200,
    });
    const separat = roundMoney(
      breakdown.reduce((sum, item) => sum + item.resultBeforeCommonCosts, 0) +
        common.privateEarnings -
        common.cimCost -
        common.recurring -
        common.oneOff,
    );

    const impreuna = calculateDailyResult({
      ...combinePlatformEntries([bolt, uber], 200),
      privateEarnings: common.privateEarnings,
      energy,
      fleetCommission: commission,
      weeklyCimCost: common.cimCost * 7,
      recurringDailyCosts: common.recurring,
      recurringFleetCosts: 0,
      oneOffDailyCosts: common.oneOff,
    }).result;

    expect(separat).toBe(impreuna);
  });
});

describe("totalurile zilei din intrările pe platformă", () => {
  it("adună încasările și kilometrii", () => {
    const combined = combinePlatformEntries([bolt, uber]);

    expect(combined.netEarnings).toBe(636.66);
    expect(combined.cashInHand).toBe(276);
    expect(combined.kilometers).toBe(185.1);
    expect(combined.applicationCommission).toBe(207.94);
  });

  it("lasă comisionul nul cât timp nicio platformă nu l-a primit", () => {
    const combined = combinePlatformEntries([
      { ...bolt, applicationCommission: null },
      { ...uber, applicationCommission: null },
    ]);

    expect(combined.applicationCommission).toBeNull();
  });

  it("cere comisionul exact pentru fiecare platformă înainte de calcul", () => {
    expect(hasRequiredEarnings([bolt, uber])).toBe(true);
    expect(hasRequiredEarnings([bolt, { ...uber, applicationCommission: null }])).toBe(false);
    // Zero este o valoare confirmată, nu o lipsă.
    expect(hasRequiredEarnings([{ ...bolt, applicationCommission: 0 }])).toBe(true);
    expect(hasRequiredEarnings([])).toBe(false);
  });
});

describe("ecranul Bolt „Defalcarea câștigurilor”, rând cu rând", () => {
  // Săptămâna 31 aug. – 6 sept., exact cum apare în aplicație.
  const saptamana: PlatformEntryInput = {
    ...emptyPlatformEntry("bolt"),
    appRidePayments: 803.9,
    campaigns: 9,
    cancellationFees: 24,
    appTips: 20,
    cashRidePayments: 566.3,
    userCredits: 198.3,
    platformCosts: 0,
    applicationCommission: 395.72,
  };

  it("reface totalurile din aplicație", () => {
    const totals = platformEntryTotals(saptamana);

    expect(totals.appRevenue).toBe(856.9);
    expect(totals.cashRevenue).toBe(764.6);
    expect(totals.netEarnings).toBe(1225.78);
    // Numerarul în mână sunt doar plățile cash, fără creditele și promoțiile.
    expect(totals.cashInHand).toBe(566.3);
  });

  it("banii pe card ajunși la flotă includ creditele și promoțiile", () => {
    const [rezultat] = calculatePlatformBreakdown({
      entries: [saptamana],
      energy,
      fleetCommission: { type: "percentage", value: 10, base: "net" },
    });

    // 856,90 + 198,30 − 395,72 = 659,48 = 1.225,78 − 566,30
    expect(rezultat.amountManagedByFleet).toBe(659.48);
    expect(rezultat.fleetCommission).toBe(122.58);
  });
});
