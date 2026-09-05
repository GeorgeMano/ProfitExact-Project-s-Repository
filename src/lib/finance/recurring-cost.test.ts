import { describe, expect, it } from "vitest";
import { allocateRecurringCost } from "./recurring-cost";
import type { RecurringCostConfig } from "@/domain/onboarding";

const cost = (overrides: Partial<RecurringCostConfig>): RecurringCostConfig => ({
  id: "test",
  category: "rca",
  label: "RCA",
  amount: 0,
  period: "annual",
  effectiveFrom: "2026-01-01",
  paidToFleet: false,
  ...overrides,
});

describe("allocateRecurringCost", () => {
  it("împarte costul anual la 365 sau 366 de zile", () => {
    expect(
      allocateRecurringCost(cost({ amount: 3650 }), "2026-08-30"),
    ).toBe(10);
    expect(
      allocateRecurringCost(
        cost({ amount: 3660, effectiveFrom: "2024-01-01" }),
        "2024-08-30",
      ),
    ).toBe(10);
  });

  it("împarte costul lunar la numărul real de zile al lunii", () => {
    expect(
      allocateRecurringCost(
        cost({ amount: 310, period: "monthly" }),
        "2026-08-30",
      ),
    ).toBe(10);
  });

  it("împarte costul săptămânal la șapte", () => {
    expect(
      allocateRecurringCost(
        cost({ amount: 700, period: "weekly" }),
        "2026-08-30",
      ),
    ).toBe(100);
  });

  it("respectă perioada de valabilitate și data efectivă", () => {
    expect(
      allocateRecurringCost(
        cost({ amount: 500, period: "validity", validityDays: 100 }),
        "2026-08-30",
      ),
    ).toBe(5);
    expect(
      allocateRecurringCost(
        cost({ amount: 3650, effectiveFrom: "2026-09-01" }),
        "2026-08-30",
      ),
    ).toBe(0);
  });
});
