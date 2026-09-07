import type { RecurringCostConfig } from "@/domain/onboarding";

export interface AllocatedRecurringCost extends RecurringCostConfig {
  dailyAmount: number;
}

export interface AllocatedRecurringPeriodCost extends RecurringCostConfig {
  periodAmount: number;
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function allocateRecurringCost(
  cost: RecurringCostConfig,
  date: string,
) {
  if (cost.amount <= 0 || date < cost.effectiveFrom) {
    return 0;
  }

  const [year, month] = date.split("-").map(Number);

  switch (cost.period) {
    case "weekly":
      return cost.amount / 7;
    case "monthly":
      return cost.amount / daysInMonth(year, month);
    case "annual":
      return cost.amount / (isLeapYear(year) ? 366 : 365);
    case "validity":
      return cost.amount / Math.max(1, cost.validityDays ?? 1);
  }
}

export function allocateRecurringCosts(
  costs: RecurringCostConfig[],
  date: string,
): AllocatedRecurringCost[] {
  return costs
    .map((cost) => ({
      ...cost,
      dailyAmount: allocateRecurringCost(cost, date),
    }))
    .filter((cost) => cost.dailyAmount > 0);
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function inclusiveDays(startDate: string, endDate: string) {
  const start = dateFromIso(startDate).getTime();
  const end = dateFromIso(endDate).getTime();
  return end < start ? 0 : Math.floor((end - start) / 86_400_000) + 1;
}

export function allocateRecurringCostForRange(
  cost: RecurringCostConfig,
  startDate: string,
  endDate: string,
) {
  const start = dateFromIso(startDate);
  const days = inclusiveDays(startDate, endDate);
  let total = 0;

  for (let offset = 0; offset < days; offset += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + offset);
    total += allocateRecurringCost(cost, current.toISOString().slice(0, 10));
  }

  return total;
}

export function allocateRecurringCostsForRange(
  costs: RecurringCostConfig[],
  startDate: string,
  endDate: string,
): AllocatedRecurringPeriodCost[] {
  return costs
    .map((cost) => ({
      ...cost,
      periodAmount: allocateRecurringCostForRange(
        cost,
        startDate,
        endDate,
      ),
    }))
    .filter((cost) => cost.periodAmount > 0);
}
