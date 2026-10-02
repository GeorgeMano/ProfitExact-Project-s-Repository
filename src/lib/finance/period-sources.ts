import { roundMoney } from "./daily-result";
import type { SavedManualPeriod } from "./manual-period";
import { inclusiveDays } from "./recurring-cost";
import {
  contributionFromDay,
  getPeriodBounds,
  type PeriodContribution,
  type SavedWorkDay,
  type SummaryPeriod,
} from "./weekly-summary";

/**
 * Ce intră în calculul unei săptămâni sau al unei luni.
 *
 * Utilizatorul poate introduce o zi, o săptămână întreagă sau o lună întreagă.
 * O captură săptămânală din aplicație include deja zilele ei, deci cele două
 * nu se adună niciodată. Regula aleasă de George:
 *
 *   - un total introdus are prioritate față de detaliile din interiorul lui:
 *     totalul lunii înlocuiește săptămânile și zilele lunii, totalul unei
 *     săptămâni înlocuiește zilele acelei săptămâni;
 *   - detaliile înlocuite rămân salvate și revin în calcul dacă totalul este
 *     șters.
 *
 * Aceeași regulă o folosesc centralizarea săptămânii, a lunii și cardul de
 * regularizare de lângă formularul zilei, ca cifrele să fie peste tot aceleași.
 */

export type PeriodSource = "manual" | "automatic" | "none";

export interface ResolvedPeriod {
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  source: PeriodSource;
  /** Totalul introdus pentru exact această perioadă, dacă există. */
  manual: SavedManualPeriod | null;
  /** Zilele care intră efectiv în calcul. */
  days: SavedWorkDay[];
  /** Săptămânile introduse ca total care intră în calculul lunii. */
  weeks: SavedManualPeriod[];
  /**
   * Săptămânile care trec peste granița lunii intră proporțional cu zilele
   * lor din lună (de exemplu 6 din 7). Este o estimare, afișată ca atare.
   */
  partialWeeks: { week: SavedManualPeriod; daysInPeriod: number }[];
  /** Zilele salvate care nu se adună, fiind cuprinse într-un total. */
  replacedDays: SavedWorkDay[];
  /** Săptămânile care nu se adună, fiind cuprinse în totalul lunii. */
  replacedWeeks: SavedManualPeriod[];
  contributions: PeriodContribution[];
  /** Zile lucrate: zilele salvate plus zilele declarate în totaluri. */
  workedDays: number;
  /** Kilometrii vin, măcar în parte, dintr-un total introdus: sunt estimativi. */
  estimatedKilometers: boolean;
}

function inRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate;
}

const SCALED_KEYS = [
  "appRevenue",
  "cashRevenue",
  "netEarnings",
  "cashInHand",
  "applicationCommission",
  "platformCosts",
  "cashTips",
  "privateEarnings",
  "amountManagedByFleet",
  "totalEarnings",
  "energyCost",
  "fleetCommission",
  "oneOffCosts",
  "resultBeforeCalendarCosts",
  "fleetBalanceBeforeCalendarCosts",
  "hoursWorked",
  "kilometers",
] as const satisfies readonly (keyof PeriodContribution)[];

/** Partea unei săptămâni care cade în lună, proporțional cu zilele ei. */
function scaleContribution(
  contribution: PeriodContribution,
  fraction: number,
  startDate: string,
  endDate: string,
): PeriodContribution {
  const scaled: PeriodContribution = { ...contribution, startDate, endDate };
  for (const key of SCALED_KEYS) scaled[key] = roundMoney(contribution[key] * fraction);
  scaled.platforms = contribution.platforms?.map((entry) => {
    const next = { ...entry };
    for (const key of Object.keys(entry) as (keyof typeof entry)[]) {
      const value = entry[key];
      if (typeof value === "number") (next as Record<string, unknown>)[key] = roundMoney(value * fraction);
    }
    return next;
  });
  return scaled;
}

export function findManualPeriod(
  manualPeriods: SavedManualPeriod[],
  periodType: SummaryPeriod,
  startDate: string,
  endDate: string,
) {
  return (
    manualPeriods.find(
      (entry) =>
        entry.periodType === periodType &&
        entry.startDate === startDate &&
        entry.endDate === endDate,
    ) ?? null
  );
}

export function resolvePeriod(
  periodType: SummaryPeriod,
  anchorDate: string,
  savedDays: SavedWorkDay[],
  manualPeriods: SavedManualPeriod[],
): ResolvedPeriod {
  const { startDate, endDate } = getPeriodBounds(anchorDate, periodType);
  const daysInPeriod = savedDays.filter((day) => inRange(day.date, startDate, endDate));
  const monthWeeks =
    periodType === "month"
      ? manualPeriods.filter(
          (entry) =>
            entry.periodType === "week" &&
            entry.endDate >= startDate &&
            entry.startDate <= endDate,
        )
      : [];
  const weeksInPeriod = monthWeeks.filter(
    (entry) => entry.startDate >= startDate && entry.endDate <= endDate,
  );
  const crossingWeeks = monthWeeks.filter((entry) => !weeksInPeriod.includes(entry));
  const manual = findManualPeriod(manualPeriods, periodType, startDate, endDate);

  const base = { periodType, startDate, endDate, manual };

  if (manual) {
    return {
      ...base,
      source: "manual",
      days: [],
      weeks: [],
      partialWeeks: [],
      replacedDays: daysInPeriod,
      replacedWeeks: monthWeeks,
      contributions: [manual.contribution],
      workedDays: manual.values.workedDays,
      estimatedKilometers: true,
    };
  }

  // Zilele cuprinse într-o săptămână introdusă ca total sunt înlocuite de ea.
  const days = daysInPeriod.filter(
    (day) => !monthWeeks.some((week) => inRange(day.date, week.startDate, week.endDate)),
  );
  const replacedDays = daysInPeriod.filter((day) => !days.includes(day));
  const partialWeeks = crossingWeeks.map((week) => {
    const from = week.startDate > startDate ? week.startDate : startDate;
    const to = week.endDate < endDate ? week.endDate : endDate;
    return { week, from, to, daysInPeriod: inclusiveDays(from, to) };
  });
  const contributions = [
    ...days.map(contributionFromDay),
    ...weeksInPeriod.map((week) => week.contribution),
    ...partialWeeks.map(({ week, from, to, daysInPeriod: count }) =>
      scaleContribution(week.contribution, count / inclusiveDays(week.startDate, week.endDate), from, to),
    ),
  ];
  const partialWorkedDays = partialWeeks.reduce(
    (sum, { week, daysInPeriod: count }) =>
      sum + (week.values.workedDays * count) / inclusiveDays(week.startDate, week.endDate),
    0,
  );

  return {
    ...base,
    source: contributions.length > 0 ? "automatic" : "none",
    days,
    weeks: weeksInPeriod,
    partialWeeks: partialWeeks.map(({ week, daysInPeriod: count }) => ({ week, daysInPeriod: count })),
    replacedDays,
    replacedWeeks: [],
    contributions,
    workedDays:
      days.length +
      weeksInPeriod.reduce((sum, week) => sum + week.values.workedDays, 0) +
      Math.round(partialWorkedDays),
    estimatedKilometers: monthWeeks.length > 0,
  };
}
