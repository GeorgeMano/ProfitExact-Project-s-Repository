import { describe, expect, it } from "vitest";
import { calculateDailyResult, type FleetCommission } from "./daily-result";
import {
  calculatePlatformBreakdown,
  emptyPlatformEntry,
  hasRequiredEarnings,
} from "./platform-entry";

/**
 * Baza comisionului flotei, în modelul bazat pe câștigul net.
 *
 * Regula: flota își ia procentul din „Câștigurile tale” — tot câștigul net
 * din aplicație, atât card cât și cash. Bacșișul cash primit în afara
 * aplicației și cursele private nu intră în bază.
 *
 * La „din brut”, brutul se reconstituie ca net + comision + costuri platformă.
 */

const zi = {
  netEarnings: 700,
  cashInHand: 400,
  applicationCommission: 200,
  platformCosts: 0,
  cashTips: 0,
  privateEarnings: 0,
  kilometers: 180,
  energy: { type: "calculated" as const, consumptionPer100Km: 8.5, unitPrice: 7.2 },
  weeklyCimCost: 0,
  recurringDailyCosts: 0,
  recurringFleetCosts: 0,
  oneOffDailyCosts: 0,
};

describe("comisionul flotei, procent din net", () => {
  const comision: FleetCommission = { type: "percentage", value: 11, base: "net" };

  it("ia 11% din câștigurile tale, card plus cash", () => {
    const rezultat = calculateDailyResult({ ...zi, fleetCommission: comision });

    expect(rezultat.platformNetEarnings).toBe(700);
    expect(rezultat.fleetCommission).toBe(77);
  });

  it("numerarul în mână nu schimbă comisionul, doar regularizarea", () => {
    const putinCash = calculateDailyResult({ ...zi, cashInHand: 0, fleetCommission: comision });
    const multCash = calculateDailyResult({ ...zi, cashInHand: 650, fleetCommission: comision });

    expect(putinCash.fleetCommission).toBe(multCash.fleetCommission);
    expect(putinCash.amountManagedByFleet).toBe(700);
    expect(multCash.amountManagedByFleet).toBe(50);
  });

  it("nu comisionează bacșișul cash din afara aplicației și cursele private", () => {
    const cuExtra = calculateDailyResult({
      ...zi,
      cashTips: 40,
      privateEarnings: 100,
      fleetCommission: comision,
    });

    expect(cuExtra.fleetCommission).toBe(77);
    expect(cuExtra.totalEarnings).toBe(840);
    // Bacșișul cash nu trece prin flotă.
    expect(cuExtra.amountManagedByFleet).toBe(300);
  });

  it("nu scade comisionul aplicației din câștigul net", () => {
    const fara = calculateDailyResult({ ...zi, applicationCommission: null, fleetCommission: comision });
    const cu = calculateDailyResult({ ...zi, fleetCommission: comision });

    expect(cu.totalEarnings).toBe(700);
    expect(cu.result).toBe(fara.result);
  });
});

describe("comisionul flotei, procent din brut", () => {
  it("reconstituie brutul din net + comision + costuri", () => {
    const rezultat = calculateDailyResult({
      ...zi,
      platformCosts: 100,
      fleetCommission: { type: "percentage", value: 11, base: "gross" },
    });

    // 700 + 200 + 100 = 1.000; 11% = 110
    expect(rezultat.grossPlatformEarnings).toBe(1000);
    expect(rezultat.fleetCommission).toBe(110);
  });
});

describe("comisionul fix", () => {
  it("nu depinde de încasări", () => {
    const rezultat = calculateDailyResult({
      ...zi,
      fleetCommission: { type: "fixed", value: 120 },
    });

    expect(rezultat.fleetCommission).toBe(120);
  });
});

describe("câmpurile obligatorii", () => {
  it("comisionul aplicației trebuie introdus, chiar dacă este 0", () => {
    const entry = { ...emptyPlatformEntry("bolt"), appRidePayments: 500 };

    expect(hasRequiredEarnings([entry])).toBe(false);
    expect(hasRequiredEarnings([{ ...entry, applicationCommission: 0 }])).toBe(true);
  });
});

describe("aceeași bază de calcul și pe două platforme", () => {
  const comision: FleetCommission = { type: "percentage", value: 11, base: "net" };

  it("suma comisioanelor pe platformă este comisionul zilei", () => {
    const defalcare = calculatePlatformBreakdown({
      entries: [
        {
          ...emptyPlatformEntry("bolt"),
          appRidePayments: 300,
          cashRidePayments: 250,
          applicationCommission: 130,
          kilometers: 120,
        },
        {
          ...emptyPlatformEntry("uber"),
          appRidePayments: 200,
          cashRidePayments: 150,
          applicationCommission: 70,
          kilometers: 60,
        },
      ],
      energy: zi.energy,
      fleetCommission: comision,
    });

    // 11% din 700 = 77, repartizat 46,20 la Bolt și 30,80 la Uber.
    expect(defalcare[0].fleetCommission).toBe(46.2);
    expect(defalcare[1].fleetCommission).toBe(30.8);
    expect(defalcare[0].amountManagedByFleet).toBe(170);
    expect(defalcare[1].amountManagedByFleet).toBe(130);

    const peTotal = calculateDailyResult({
      ...zi,
      netEarnings: 700,
      cashInHand: 400,
      fleetCommission: comision,
    });

    expect(defalcare[0].fleetCommission + defalcare[1].fleetCommission).toBe(
      peTotal.fleetCommission,
    );
    expect(defalcare[0].amountManagedByFleet + defalcare[1].amountManagedByFleet).toBe(
      peTotal.amountManagedByFleet,
    );
  });
});
