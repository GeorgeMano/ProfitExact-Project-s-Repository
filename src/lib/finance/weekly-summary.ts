import { roundMoney } from "./daily-result";

export type SummaryPeriod = "week" | "month";

export interface SavedWorkDay {
  date: string;
  cardEarnings: number;
  cashEarnings: number;
  applicationCommission: number;
  compensations: number;
  appTips: number;
  cashTips: number;
  privateEarnings: number;
  result: number;
  resultBeforeCalendarCosts: number;
  fleetBalance: number;
  fleetBalanceBeforeCalendarCosts: number;
  totalEarnings: number;
  energyCost: number;
  fleetCommission: number;
  oneOffCosts: number;
  hoursWorked: number;
  kilometers: number;
}

export interface PeriodContribution {
  startDate: string;
  endDate: string;
  cardEarnings: number;
  cashEarnings: number;
  applicationCommission: number;
  compensations: number;
  appTips: number;
  cashTips: number;
  privateEarnings: number;
  totalEarnings: number;
  energyCost: number;
  fleetCommission: number;
  oneOffCosts: number;
  resultBeforeCalendarCosts: number;
  fleetBalanceBeforeCalendarCosts: number;
  hoursWorked: number;
  kilometers: number;
}

export interface PeriodCalendarCosts {
  cimCost: number;
  recurringCosts: number;
  recurringFleetCosts: number;
}

export interface PeriodSummary {
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  days: SavedWorkDay[];
  totalCardEarnings: number;
  totalCashEarnings: number;
  totalApplicationCommission: number;
  totalCompensations: number;
  totalAppTips: number;
  totalCashTips: number;
  totalPrivateEarnings: number;
  totalEarnings: number;
  totalEnergyCost: number;
  totalFleetCommission: number;
  totalOneOffCosts: number;
  totalCimCost: number;
  totalRecurringCosts: number;
  totalExpenses: number;
  totalResult: number;
  totalFleetBalance: number;
  totalHours: number;
  totalKilometers: number;
}

export type WeeklySummary = PeriodSummary;

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

export function getMonthBounds(date: string) {
  const [year, month] = date.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { startDate: isoFromDate(start), endDate: isoFromDate(end) };
}

export function getPeriodBounds(date: string, periodType: SummaryPeriod) {
  return periodType === "week" ? getWeekBounds(date) : getMonthBounds(date);
}

export function upsertSavedWorkDay(
  days: SavedWorkDay[],
  nextDay: SavedWorkDay,
) {
  return [...days.filter((day) => day.date !== nextDay.date), nextDay].sort(
    (left, right) => left.date.localeCompare(right.date),
  );
}

const noCalendarCosts: PeriodCalendarCosts = {
  cimCost: 0,
  recurringCosts: 0,
  recurringFleetCosts: 0,
};

export function summarizePeriod(
  days: SavedWorkDay[],
  anchorDate: string,
  periodType: SummaryPeriod,
  calendarCosts: PeriodCalendarCosts = noCalendarCosts,
): PeriodSummary {
  const { startDate, endDate } = getPeriodBounds(anchorDate, periodType);
  const selectedDays = days.filter(
    (day) => day.date >= startDate && day.date <= endDate,
  );

  return summarizeContributions(
    selectedDays.map((day) => ({
      startDate: day.date,
      endDate: day.date,
      cardEarnings: day.cardEarnings,
      cashEarnings: day.cashEarnings,
      applicationCommission: day.applicationCommission,
      compensations: day.compensations,
      appTips: day.appTips,
      cashTips: day.cashTips,
      privateEarnings: day.privateEarnings,
      totalEarnings: day.totalEarnings,
      energyCost: day.energyCost,
      fleetCommission: day.fleetCommission,
      oneOffCosts: day.oneOffCosts,
      resultBeforeCalendarCosts: day.resultBeforeCalendarCosts,
      fleetBalanceBeforeCalendarCosts:
        day.fleetBalanceBeforeCalendarCosts,
      hoursWorked: day.hoursWorked,
      kilometers: day.kilometers,
    })),
    periodType,
    startDate,
    endDate,
    calendarCosts,
    selectedDays,
  );
}

export function summarizeContributions(
  contributions: PeriodContribution[],
  periodType: SummaryPeriod,
  startDate: string,
  endDate: string,
  calendarCosts: PeriodCalendarCosts = noCalendarCosts,
  days: SavedWorkDay[] = [],
): PeriodSummary {
  const relevantContributions = contributions.filter(
    (entry) => entry.startDate >= startDate && entry.endDate <= endDate,
  );

  const summary = relevantContributions.reduce<PeriodSummary>(
    (summary, entry) => ({
      ...summary,
      totalCardEarnings: summary.totalCardEarnings + entry.cardEarnings,
      totalCashEarnings: summary.totalCashEarnings + entry.cashEarnings,
      totalApplicationCommission:
        summary.totalApplicationCommission + entry.applicationCommission,
      totalCompensations:
        summary.totalCompensations + entry.compensations,
      totalAppTips: summary.totalAppTips + entry.appTips,
      totalCashTips: summary.totalCashTips + entry.cashTips,
      totalPrivateEarnings:
        summary.totalPrivateEarnings + entry.privateEarnings,
      totalEarnings: summary.totalEarnings + entry.totalEarnings,
      totalEnergyCost: summary.totalEnergyCost + entry.energyCost,
      totalFleetCommission:
        summary.totalFleetCommission + entry.fleetCommission,
      totalOneOffCosts: summary.totalOneOffCosts + entry.oneOffCosts,
      totalResult:
        summary.totalResult + entry.resultBeforeCalendarCosts,
      totalFleetBalance:
        summary.totalFleetBalance + entry.fleetBalanceBeforeCalendarCosts,
      totalHours: summary.totalHours + Math.max(0, entry.hoursWorked),
      totalKilometers: summary.totalKilometers + Math.max(0, entry.kilometers),
    }),
    {
      periodType,
      startDate,
      endDate,
      days,
      totalCardEarnings: 0,
      totalCashEarnings: 0,
      totalApplicationCommission: 0,
      totalCompensations: 0,
      totalAppTips: 0,
      totalCashTips: 0,
      totalPrivateEarnings: 0,
      totalEarnings: 0,
      totalEnergyCost: 0,
      totalFleetCommission: 0,
      totalOneOffCosts: 0,
      totalCimCost: calendarCosts.cimCost,
      totalRecurringCosts: calendarCosts.recurringCosts,
      totalExpenses: 0,
      totalResult: 0,
      totalFleetBalance: 0,
      totalHours: 0,
      totalKilometers: 0,
    },
  );

  const totalResult = roundMoney(
    summary.totalResult -
      calendarCosts.cimCost -
      calendarCosts.recurringCosts,
  );
  const totalFleetBalance = roundMoney(
    summary.totalFleetBalance +
      calendarCosts.cimCost +
      calendarCosts.recurringFleetCosts,
  );

  return {
    ...summary,
    totalCardEarnings: roundMoney(summary.totalCardEarnings),
    totalCashEarnings: roundMoney(summary.totalCashEarnings),
    totalApplicationCommission: roundMoney(
      summary.totalApplicationCommission,
    ),
    totalCompensations: roundMoney(summary.totalCompensations),
    totalAppTips: roundMoney(summary.totalAppTips),
    totalCashTips: roundMoney(summary.totalCashTips),
    totalPrivateEarnings: roundMoney(summary.totalPrivateEarnings),
    totalEarnings: roundMoney(summary.totalEarnings),
    totalEnergyCost: roundMoney(summary.totalEnergyCost),
    totalFleetCommission: roundMoney(summary.totalFleetCommission),
    totalOneOffCosts: roundMoney(summary.totalOneOffCosts),
    totalCimCost: roundMoney(calendarCosts.cimCost),
    totalRecurringCosts: roundMoney(calendarCosts.recurringCosts),
    totalExpenses: roundMoney(summary.totalEarnings - totalResult),
    totalResult,
    totalFleetBalance,
  };
}

export function summarizeWeek(
  days: SavedWorkDay[],
  anchorDate: string,
): WeeklySummary {
  return summarizePeriod(days, anchorDate, "week");
}
