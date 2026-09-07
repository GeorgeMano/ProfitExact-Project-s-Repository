import { describe, expect, it } from "vitest";
import {
  calculateConsumptionCost,
  calculateFinancialResult,
  calculateDailyResult,
  formatFleetAlert,
  formatResultAlert,
  type DailyResultInput,
} from "./daily-result";

const baseInput: DailyResultInput = {
  cardEarnings: 500,
  cashEarnings: 300,
  applicationCommission: 200,
  compensations: 20,
  appTips: 25,
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

describe("calculateDailyResult", () => {
  it("calculează costul combustibilului din kilometri, consum și prețul unitar", () => {
    expect(calculateConsumptionCost(500, 7, 9.78)).toBe(342.3);
  });

  it("calculează rezultatul și regularizarea fără dublarea comisionului aplicației", () => {
    const result = calculateDailyResult(baseInput);

    expect(result.applicationCommission).toBe(200);
    expect(result.platformNetEarnings).toBe(600);
    expect(result.energyCost).toBeCloseTo(110.16);
    expect(result.fleetCommission).toBe(60);
    expect(result.dailyCimCost).toBeCloseTo(128.571428);
    expect(result.result).toBeCloseTo(331.268571);
    expect(result.amountManagedByFleet).toBe(345);
    expect(result.fleetBalance).toBeCloseTo(-156.428571);
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

  it("folosește exact comisionul oprit de aplicație din screenshot", () => {
    const result = calculateDailyResult({
      ...baseInput,
      applicationCommission: 128.99,
      fleetCommission: { type: "percentage", value: 11, base: "net" },
    });

    expect(result.applicationCommission).toBe(128.99);
    expect(result.fleetCommission).toBe(73.81);
  });

  it("reproduce exact câștigurile Bolt din exemplul real zilnic", () => {
    const result = calculateFinancialResult({
      cardEarnings: 278.3,
      cashEarnings: 178.1,
      applicationCommission: 128.99,
      compensations: 62.1,
      appTips: 10,
      cashTips: 0,
      privateEarnings: 0,
      kilometers: 0,
      energyCost: 0,
      fleetCommission: { type: "percentage", value: 0, base: "net" },
      cimCost: 0,
      recurringCosts: 0,
      recurringFleetCosts: 0,
      oneOffCosts: 0,
    });

    expect(result.grossPlatformEarnings).toBe(456.4);
    expect(result.totalEarnings).toBe(399.51);
    expect(result.result).toBe(399.51);
  });

  it("reproduce exact câștigurile Bolt din exemplul real săptămânal", () => {
    const result = calculateFinancialResult({
      cardEarnings: 803.9,
      cashEarnings: 566.3,
      applicationCommission: 395.72,
      compensations: 231.3,
      appTips: 20,
      cashTips: 0,
      privateEarnings: 0,
      kilometers: 0,
      energyCost: 0,
      fleetCommission: { type: "percentage", value: 0, base: "net" },
      cimCost: 0,
      recurringCosts: 0,
      recurringFleetCosts: 0,
      oneOffCosts: 0,
    });

    expect(result.grossPlatformEarnings).toBe(1370.2);
    expect(result.totalEarnings).toBe(1225.78);
    expect(result.result).toBe(1225.78);
  });

  it("afișează mesajul simplu aprobat când rezultatul este zero", () => {
    const result = calculateDailyResult({
      ...baseInput,
      cardEarnings: 0,
      cashEarnings: 0,
      compensations: 0,
      applicationCommission: 0,
      appTips: 0,
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
  });
});
