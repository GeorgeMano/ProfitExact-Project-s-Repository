import { describe, expect, it } from "vitest";
import {
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
    expect(result.fleetCommission).toBeCloseTo(73.8111);
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
