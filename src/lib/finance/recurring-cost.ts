import type { RecurringCostConfig } from "@/domain/onboarding";

export interface AllocatedRecurringCost extends RecurringCostConfig {
  dailyAmount: number;
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
