import { describe, expect, it } from "vitest";
import { getWeekBounds, summarizeWeek, upsertSavedWorkDay } from "./weekly-summary";

describe("weekly summary", () => {
  it("folosește săptămâna luni-duminică", () => {
    expect(getWeekBounds("2026-09-03")).toEqual({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
    });
  });

  it("adună numai zilele din săptămâna selectată", () => {
    const summary = summarizeWeek(
      [
        { date: "2026-09-01", result: 300, fleetBalance: -100, hoursWorked: 8, kilometers: 120 },
        { date: "2026-09-03", result: 250, fleetBalance: 40, hoursWorked: 6, kilometers: 90 },
        { date: "2026-09-10", result: 500, fleetBalance: -200, hoursWorked: 10, kilometers: 180 },
      ],
      "2026-09-03",
    );

    expect(summary.days).toHaveLength(2);
    expect(summary.totalResult).toBe(550);
    expect(summary.totalFleetBalance).toBe(-60);
    expect(summary.totalHours).toBe(14);
    expect(summary.totalKilometers).toBe(210);
  });

  it("actualizează ziua existentă fără să o dubleze", () => {
    const initial = [{ date: "2026-09-03", result: 100, fleetBalance: 20, hoursWorked: 5, kilometers: 80 }];
    const updated = upsertSavedWorkDay(initial, {
      date: "2026-09-03",
      result: 150,
      fleetBalance: -10,
      hoursWorked: 6,
      kilometers: 90,
    });

    expect(updated).toHaveLength(1);
    expect(updated[0].result).toBe(150);
  });
});
