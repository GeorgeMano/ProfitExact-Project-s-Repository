import { describe, expect, it } from "vitest";
import { daysOfActivity, splitByActivity } from "./activity";
import { upsertSavedWorkDay, type SavedWorkDay } from "./weekly-summary";

const day = (date: string, platform: "bolt" | "glovo" | null): SavedWorkDay =>
  ({
    date,
    ...(platform ? { platforms: [{ platform }] } : {}),
  }) as unknown as SavedWorkDay;

describe("datele fiecărei activități", () => {
  it("ridesharing și delivery nu se amestecă", () => {
    const days = [day("2026-09-30", "bolt"), day("2026-10-01", "glovo"), day("2026-08-01", null)];

    expect(daysOfActivity(days, "delivery").map((item) => item.date)).toEqual(["2026-10-01"]);
    // Zilele vechi, fără defalcare pe platformă, sunt de ridesharing.
    expect(daysOfActivity(days, "ridesharing").map((item) => item.date)).toEqual(["2026-09-30", "2026-08-01"]);
  });

  it("salvarea unei zile de delivery nu șterge ziua de ridesharing cu aceeași dată", () => {
    const days = upsertSavedWorkDay([day("2026-10-01", "bolt")], day("2026-10-01", "glovo"));

    expect(days).toHaveLength(2);
    expect(upsertSavedWorkDay(days, day("2026-10-01", "glovo"))).toHaveLength(2);
  });
});

describe("rezultatul pe activități, la „Ambele”", () => {
  it("împarte costurile comune după kilometri și păstrează totalul exact", () => {
    // Ridesharing: 300 înainte de costuri comune, 150 km. Delivery: 100, 50 km.
    // Costuri comune 80 → 60 la ridesharing (75%), 20 la delivery (25%).
    const split = splitByActivity(
      [
        { platform: "bolt", resultBeforeCommonCosts: 300, kilometers: 150, totalEarnings: 450 },
        { platform: "glovo", resultBeforeCommonCosts: 100, kilometers: 50, totalEarnings: 140 },
      ],
      340,
      20,
    );

    expect(split.basis).toBe("kilometers");
    expect(split.commonCosts).toBe(80);
    expect(split.ridesharing.result).toBe(240);
    expect(split.delivery.result).toBe(80);
    expect(split.ridesharing.result + split.delivery.result + 20).toBe(340);
  });

  it("fără kilometri, împarte după încasări", () => {
    const split = splitByActivity(
      [
        { platform: "uber", resultBeforeCommonCosts: 200, kilometers: 0, totalEarnings: 300 },
        { platform: "wolt", resultBeforeCommonCosts: 100, kilometers: 0, totalEarnings: 100 },
      ],
      260,
      0,
    );

    expect(split.basis).toBe("earnings");
    expect(split.ridesharing.result).toBe(170);
    expect(split.delivery.result).toBe(90);
  });
});
