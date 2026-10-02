import type { FinancialResult } from "./daily-result";
import {
  emptyPlatformEntry,
  type PlatformEntryInput,
  type PlatformKey,
} from "./platform-entry";
import type { PeriodContribution, SummaryPeriod } from "./weekly-summary";

/**
 * Totalurile introduse manual pentru o săptămână sau o lună, atunci când nu
 * există zile salvate care să acopere perioada.
 *
 * Încasările se introduc pe platformă, la fel ca la zi, ca să funcționeze și
 * aici vizualizarea separată și ca `platform_earnings` să primească date fidele.
 *
 * Tipurile stau în `lib` (nu în componentă) pentru ca stratul de persistență să
 * le poată folosi fără să importe cod de interfață.
 */
export interface ManualPeriodValues {
  platforms: PlatformEntryInput[];
  /** Folosit numai în modul „kilometri în comun”, pe două platforme. */
  sharedKilometers: number;
  privateEarnings: number;
  workedDays: number;
  hoursWorked: number;
  unitPrice: number;
  gasolineCost: number;
  electricCost: number;
  washingCost: number;
  parkingCost: number;
  roadTollCost: number;
  serviceCost: number;
  otherCost: number;
}

export interface SavedManualPeriod {
  id: string;
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  values: ManualPeriodValues;
  result: FinancialResult;
  contribution: PeriodContribution;
}

export function createEmptyManualPeriodValues(
  platforms: PlatformKey[],
): ManualPeriodValues {
  return {
    platforms: platforms.map(emptyPlatformEntry),
    sharedKilometers: 0,
    privateEarnings: 0,
    workedDays: 0,
    hoursWorked: 0,
    unitPrice: 0,
    gasolineCost: 0,
    electricCost: 0,
    washingCost: 0,
    parkingCost: 0,
    roadTollCost: 0,
    serviceCost: 0,
    otherCost: 0,
  };
}

/** Identificatorul stabil al unei perioade introduse manual. */
export function manualPeriodId(
  periodType: SummaryPeriod,
  startDate: string,
  endDate: string,
) {
  return `${periodType}:${startDate}:${endDate}`;
}

/**
 * Înlocuiește perioada cu același identificator, în loc să o dubleze, și
 * păstrează lista ordonată după data de început.
 */
export function upsertManualPeriod(
  periods: SavedManualPeriod[],
  next: SavedManualPeriod,
) {
  return [...periods.filter((entry) => entry.id !== next.id), next].sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.periodType.localeCompare(right.periodType),
  );
}
