import { describe, expect, it } from "vitest";
import {
  calculateConsumptionCost,
  calculateFinancialResult,
  calculateDailyResult,
  formatFleetAlert,
  formatResultAlert,
  type DailyResultInput,
  type FinancialResultInput,
} from "./daily-result";

const baseInput: DailyResultInput = {
  netEarnings: 645,
  cashInHand: 300,
  applicationCommission: 200,
  platformCosts: 0,
  cashTips: 15,
  privateEarnings: 0,
  kilometers: 180,
  energy: {
    type: "calculated",
    consumptionPer100Km: 8.5,
    unitPrice: 7.2,
  },
  fleetCommission: {
    type: "percentage",
    value: 10,
    base: "net",
  },
  weeklyCimCost: 900,
  recurringDailyCosts: 10,
  recurringFleetCosts: 0,
  oneOffDailyCosts: 20,
};

/** Săptămâna 31 aug. – 6 sept. din ecranul Bolt „Defalcarea câștigurilor”. */
const boltWeek: FinancialResultInput = {
  netEarnings: 1225.78,
  cashInHand: 566.3,
  applicationCommission: 395.72,
  platformCosts: 0,
  cashTips: 0,
  privateEarnings: 0,
  kilometers: 0,
  energyCost: 0,
  fleetCommission: { type: "percentage", value: 10, base: "net" },
  cimCost: 50,
  recurringCosts: 0,
  recurringFleetCosts: 0,
  oneOffCosts: 0,
};

describe("calculateDailyResult", () => {
  it("calculează costul combustibilului din kilometri, consum și prețul unitar", () => {
    expect(calculateConsumptionCost(500, 7, 9.78)).toBe(342.3);
  });

  it("pornește de la câștigul net și nu mai scade încă o dată comisionul aplicației", () => {
    const result = calculateDailyResult(baseInput);

    expect(result.platformNetEarnings).toBe(645);
    // Netul + bacșișul cash; comisionul de 200 este doar informativ.
    expect(result.totalEarnings).toBe(660);
    expect(result.energyCost).toBeCloseTo(110.16);
    expect(result.fleetCommission).toBe(64.5);
    expect(result.dailyCimCost).toBeCloseTo(128.571428);
    expect(result.totalExpenses).toBeCloseTo(110.16 + 64.5 + 128.57 + 10 + 20, 1);
    expect(result.amountManagedByFleet).toBe(345);
    expect(result.fleetBalance).toBeCloseTo(64.5 + 128.571428 - 345);
  });

  it("adună separat costurile zilnice PHEV", () => {
    const result = calculateDailyResult({
      ...baseInput,
      energy: {
        type: "phev",
        gasolineCost: 70,
        electricCost: 12.5,
      },
    });

    expect(result.energyCost).toBe(82.5);
  });

  it("afișează mesajul simplu aprobat când rezultatul este zero", () => {
    const result = calculateDailyResult({
      ...baseInput,
      netEarnings: 0,
      cashInHand: 0,
      applicationCommission: 0,
      cashTips: 0,
      weeklyCimCost: 0,
      recurringDailyCosts: 0,
      oneOffDailyCosts: 0,
      energy: {
        type: "calculated",
        consumptionPer100Km: 0,
        unitPrice: 0,
      },
    });

    expect(formatResultAlert(result)).toBe("Ai câștigat 0 RON.");
  });

  it("folosește sensul aprobat pentru balanța cu flota", () => {
    expect(formatFleetAlert(45.2)).toBe("Datorezi flotei 45,20 RON.");
    expect(formatFleetAlert(-45.2)).toBe(
      "Flota îți datorează 45,20 RON.",
    );
    expect(formatFleetAlert(0)).toBe(
      "Nu datorezi nimic flotei și nici flota ție.",
    );
  });
});

describe("exemplul real Bolt, săptămâna 31 aug. – 6 sept.", () => {
  it("câștigurile tale sunt chiar venitul, fără altă scădere", () => {
    const result = calculateFinancialResult({
      ...boltWeek,
      fleetCommission: { type: "percentage", value: 0, base: "net" },
      cimCost: 0,
    });

    expect(result.totalEarnings).toBe(1225.78);
    expect(result.result).toBe(1225.78);
    // Brutul reconstituit: 1.225,78 + 395,72 = 1.621,50
    expect(result.grossPlatformEarnings).toBe(1621.5);
  });

  it("flota primește câștigurile minus numerarul în mână, inclusiv creditele", () => {
    const result = calculateFinancialResult(boltWeek);

    // 1.225,78 − 566,30 = 659,48. Aceeași sumă și pe calea lungă:
    // venituri în aplicație 856,90 + credite 198,30 − comision 395,72.
    expect(result.amountManagedByFleet).toBe(659.48);
    expect(result.amountManagedByFleet).toBe(
      Math.round((856.9 + 198.3 - 395.72) * 100) / 100,
    );
  });

  it("calculează regularizarea: flota datorează după comision și CIM", () => {
    const result = calculateFinancialResult(boltWeek);

    // 10% din 1.225,78 = 122,58
    expect(result.fleetCommission).toBe(122.58);
    // 659,48 − 122,58 − 50 = 486,90 de primit de la flotă
    expect(result.fleetBalance).toBe(-486.9);
    expect(formatFleetAlert(result.fleetBalance)).toBe(
      "Flota îți datorează 486,90 RON.",
    );
  });

  it("dacă reținerile depășesc banii de la flotă, șoferul datorează diferența", () => {
    const result = calculateFinancialResult({
      ...boltWeek,
      cashInHand: 1100,
      cimCost: 200,
    });

    // 1.225,78 − 1.100 = 125,78 la flotă; 122,58 + 200 − 125,78 = 196,80
    expect(result.fleetBalance).toBe(196.8);
    expect(formatFleetAlert(result.fleetBalance)).toBe("Datorezi flotei 196,80 RON.");
  });

  it("costurile recurente plătite flotei intră în regularizare", () => {
    const result = calculateFinancialResult({
      ...boltWeek,
      recurringCosts: 40,
      recurringFleetCosts: 40,
    });

    expect(result.recurringFleetCosts).toBe(40);
    expect(result.fleetBalance).toBe(-446.9);
  });
});
