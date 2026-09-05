export interface SavedWorkDay {
  date: string;
  result: number;
  fleetBalance: number;
  hoursWorked: number;
  kilometers: number;
}

export interface WeeklySummary {
  startDate: string;
  endDate: string;
  days: SavedWorkDay[];
  totalResult: number;
  totalFleetBalance: number;
  totalHours: number;
  totalKilometers: number;
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getWeekBounds(date: string) {
  const current = dateFromIso(date);
  const weekday = current.getUTCDay() || 7;
  const start = new Date(current);
  start.setUTCDate(current.getUTCDate() - weekday + 1);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return { startDate: isoFromDate(start), endDate: isoFromDate(end) };
}

export function upsertSavedWorkDay(
  days: SavedWorkDay[],
  nextDay: SavedWorkDay,
) {
  return [...days.filter((day) => day.date !== nextDay.date), nextDay].sort(
    (left, right) => left.date.localeCompare(right.date),
  );
}

export function summarizeWeek(days: SavedWorkDay[], anchorDate: string): WeeklySummary {
  const { startDate, endDate } = getWeekBounds(anchorDate);
  const selectedDays = days.filter(
    (day) => day.date >= startDate && day.date <= endDate,
  );

  return selectedDays.reduce<WeeklySummary>(
    (summary, day) => ({
      ...summary,
      days: [...summary.days, day],
      totalResult: summary.totalResult + day.result,
      totalFleetBalance: summary.totalFleetBalance + day.fleetBalance,
      totalHours: summary.totalHours + Math.max(0, day.hoursWorked),
      totalKilometers: summary.totalKilometers + Math.max(0, day.kilometers),
    }),
    {
      startDate,
      endDate,
      days: [],
      totalResult: 0,
      totalFleetBalance: 0,
      totalHours: 0,
      totalKilometers: 0,
    },
  );
}
