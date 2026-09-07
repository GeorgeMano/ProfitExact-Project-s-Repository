import { describe, expect, it } from "vitest";
import {
  getMonthBounds,
  getWeekBounds,
  summarizePeriod,
  summarizeWeek,
  upsertSavedWorkDay,
  type SavedWorkDay,
} from "./weekly-summary";

const savedDay = (
  overrides: Partial<SavedWorkDay> & Pick<SavedWorkDay, "date">,
): SavedWorkDay => ({
  cardEarnings: 0,
  cashEarnings: 0,
  applicationCommission: 0,
  compensations: 0,
  appTips: 0,
  cashTips: 0,
  privateEarnings: 0,
  result: 0,
  resultBeforeCalendarCosts: 0,
  fleetBalance: 0,
  fleetBalanceBeforeCalendarCosts: 0,
  totalEarnings: 0,
  energyCost: 0,
  fleetCommission: 0,
  oneOffCosts: 0,
  hoursWorked: 0,
  kilometers: 0,
  ...overrides,
});

describe("weekly summary", () => {
  it("folosește săptămâna luni-duminică", () => {
    expect(getWeekBounds("2026-09-03")).toEqual({
      startDate: "2026-08-31",
      endDate: "2026-09-06",
    });
  });

  it("folosește luna calendaristică între prima și ultima zi", () => {
    expect(getMonthBounds("2026-09-15")).toEqual({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    expect(getMonthBounds("2024-02-15")).toEqual({
      startDate: "2024-02-01",
      endDate: "2024-02-29",
    });
  });

  it("adună numai zilele din săptămâna selectată", () => {
    const summary = summarizeWeek(
      [
        savedDay({ date: "2026-09-01", result: 300, resultBeforeCalendarCosts: 300, fleetBalance: -100, fleetBalanceBeforeCalendarCosts: -100, hoursWorked: 8, kilometers: 120 }),
        savedDay({ date: "2026-09-03", result: 250, resultBeforeCalendarCosts: 250, fleetBalance: 40, fleetBalanceBeforeCalendarCosts: 40, hoursWorked: 6, kilometers: 90 }),
        savedDay({ date: "2026-09-10", result: 500, resultBeforeCalendarCosts: 500, fleetBalance: -200, fleetBalanceBeforeCalendarCosts: -200, hoursWorked: 10, kilometers: 180 }),
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
    const initial = [savedDay({ date: "2026-09-03", result: 100, resultBeforeCalendarCosts: 100, fleetBalance: 20, fleetBalanceBeforeCalendarCosts: 20, hoursWorked: 5, kilometers: 80 })];
    const updated = upsertSavedWorkDay(initial, savedDay({
      date: "2026-09-03",
      result: 150,
      resultBeforeCalendarCosts: 150,
      fleetBalance: -10,
      fleetBalanceBeforeCalendarCosts: -10,
      hoursWorked: 6,
      kilometers: 90,
    }));

    expect(updated).toHaveLength(1);
    expect(updated[0].result).toBe(150);
  });

  it("aplică o singură dată costurile calendaristice întregii perioade", () => {
    const summary = summarizePeriod(
      [
        savedDay({ date: "2026-09-01", totalEarnings: 500, resultBeforeCalendarCosts: 400, fleetBalanceBeforeCalendarCosts: -100 }),
        savedDay({ date: "2026-09-03", totalEarnings: 400, resultBeforeCalendarCosts: 300, fleetBalanceBeforeCalendarCosts: -80 }),
      ],
      "2026-09-03",
      "week",
      { cimCost: 140, recurringCosts: 70, recurringFleetCosts: 20 },
    );

    expect(summary.totalEarnings).toBe(900);
    expect(summary.totalResult).toBe(490);
    expect(summary.totalExpenses).toBe(410);
    expect(summary.totalFleetBalance).toBe(-20);
  });
});
