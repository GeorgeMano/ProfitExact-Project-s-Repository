import { describe, expect, it } from "vitest";
import type { OnboardingConfig } from "@/domain/onboarding";
import { emptyPlatformEntry } from "./platform-entry";
import { calculateWorkDay } from "./work-day";

const both: OnboardingConfig = {
  activity: "both",
  workMode: "employee",
  legalForm: null,
  taxRegime: null,
  platform: "bolt",
  deliveryPlatforms: ["glovo"],
  cityName: "Pitesti",
  cityKey: "pitesti",
  profitView: "separate",
  kilometerEntry: "per_platform",
  vehicleOwnership: "owned",
  vehicleType: "car",
  fuelType: "gasoline",
  hybridType: null,
  primaryFuel: null,
  consumptionPer100Km: 0,
  fleetCommission: { type: "percentage", value: 10, base: "net" },
  deliveryFleetCommission: { type: "percentage", value: 20, base: "net" },
  weeklyCimCost: 0,
  effectiveFrom: "2026-09-01",
  recurringCosts: [],
};

const input = {
  date: "2026-10-01",
  platforms: [
    { ...emptyPlatformEntry("bolt"), appRidePayments: 120, applicationCommission: 20 },
    { ...emptyPlatformEntry("glovo"), appRidePayments: 50 },
  ],
  privateEarnings: 0,
  hoursWorked: 8,
  inputs: { sharedKilometers: 0, unitPrice: 0, gasolineCost: 0, electricCost: 0, washingCost: 0, parkingCost: 0, roadTollCost: 0, serviceCost: 0, otherCost: 0 },
};

describe("„Ambele”: comision diferit la livrări", () => {
  it("fiecare aplicație cu procentul ei", () => {
    const day = calculateWorkDay(both, input);

    // Bolt: 10% din 100 = 10. Glovo: 20% din 50 = 10.
    expect(day.breakdown.map((item) => item.fleetCommission)).toEqual([10, 10]);
    expect(day.result.fleetCommission).toBe(20);
    expect(day.result.result).toBe(130);
  });

  it("fără comision separat, se aplică același peste tot", () => {
    const { deliveryFleetCommission: _ignored, ...same } = both;
    const day = calculateWorkDay(same, input);

    expect(day.result.fleetCommission).toBe(15);
  });
});
