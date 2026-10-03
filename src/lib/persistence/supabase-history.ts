import type { OnboardingConfig } from "@/domain/onboarding";
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import {
  emptyPlatformEntry,
  platformsForConfig,
  type PlatformEntryInput,
  type PlatformKey,
} from "@/lib/finance/platform-entry";
import type { SavedWorkDay, SavedWorkDayInputs, SummaryPeriod } from "@/lib/finance/weekly-summary";
import { buildManualPeriod, buildSavedWorkDay } from "@/lib/finance/work-day";

/**
 * Reconstituirea istoricului din tabelele normalizate ale contului.
 *
 * În bază se păstrează numai ce a introdus șoferul: rândurile din aplicație,
 * kilometrii, orele, prețul combustibilului și cheltuielile punctuale. Zilele
 * și perioadele se recalculează aici cu aceleași funcții ca în formular, deci
 * ies identic cu ce a văzut șoferul la salvare.
 *
 * Funcțiile primesc rândurile deja citite, ca să poată fi testate fără bază.
 */

export interface WorkEntryRow {
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  worked_days: number | string | null;
  worked_hours: number | string | null;
  total_kilometers: number | string | null;
  private_earnings: number | string | null;
}

export interface PlatformEarningsRow {
  work_entry_id: string;
  platform: string;
  card_earnings: number | string | null;
  campaigns: number | string | null;
  cancellation_fees: number | string | null;
  app_tips: number | string | null;
  cash_earnings: number | string | null;
  user_credits: number | string | null;
  compensations: number | string | null;
  platform_costs: number | string | null;
  application_commission: number | string | null;
  cash_tips: number | string | null;
  kilometers: number | string | null;
  deliveries?: number | string | null;
  cancelled_deliveries?: number | string | null;
  hours_online?: number | string | null;
}

export interface EnergyRow {
  work_entry_id: string;
  unit_price: number | string | null;
  gasoline_cost: number | string | null;
  electric_cost: number | string | null;
}

export interface ExpenseRow {
  work_entry_id: string | null;
  category: string;
  amount: number | string | null;
}

export interface HistoryRows {
  entries: WorkEntryRow[];
  platforms: PlatformEarningsRow[];
  energy: EnergyRow[];
  expenses: ExpenseRow[];
}

/** PostgREST poate întoarce `numeric` ca text; orice valoare invalidă devine 0. */
function amount(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function optionalAmount(value: number | string | null | undefined) {
  return value === null || value === undefined || value === "" ? null : amount(value);
}

function platformInput(platform: PlatformKey, row: PlatformEarningsRow | undefined): PlatformEntryInput {
  if (!row) return emptyPlatformEntry(platform);

  return {
    platform,
    appRidePayments: amount(row.card_earnings),
    // Rândurile scrise înainte de separarea campaniilor le țineau la compensări.
    campaigns: amount(row.campaigns) + amount(row.compensations),
    cancellationFees: amount(row.cancellation_fees),
    appTips: amount(row.app_tips),
    cashRidePayments: amount(row.cash_earnings),
    userCredits: amount(row.user_credits),
    platformCosts: amount(row.platform_costs),
    applicationCommission: optionalAmount(row.application_commission),
    cashTips: amount(row.cash_tips),
    kilometers: amount(row.kilometers),
    ...(amount(row.deliveries) > 0 ? { deliveries: Math.round(amount(row.deliveries)) } : {}),
    ...(amount(row.cancelled_deliveries) > 0 ? { cancelledDeliveries: Math.round(amount(row.cancelled_deliveries)) } : {}),
    ...(amount(row.hours_online) > 0 ? { hoursOnline: amount(row.hours_online) } : {}),
  };
}

function inputsFor(
  entry: WorkEntryRow,
  energy: EnergyRow | undefined,
  expenses: ExpenseRow[],
): SavedWorkDayInputs {
  const sum = (category: string) =>
    expenses
      .filter((expense) => expense.category === category)
      .reduce((total, expense) => total + amount(expense.amount), 0);

  return {
    sharedKilometers: amount(entry.total_kilometers),
    unitPrice: amount(energy?.unit_price),
    gasolineCost: amount(energy?.gasoline_cost),
    electricCost: amount(energy?.electric_cost),
    washingCost: sum("washing"),
    parkingCost: sum("parking"),
    roadTollCost: sum("road_toll"),
    serviceCost: sum("service"),
    otherCost: sum("other"),
  };
}

export function rebuildHistory(config: OnboardingConfig, rows: HistoryRows) {
  const keys = platformsForConfig(config);
  const savedDays: SavedWorkDay[] = [];
  const manualPeriods: SavedManualPeriod[] = [];
  let skipped = 0;

  for (const entry of rows.entries) {
    const platformRows = rows.platforms.filter((row) => row.work_entry_id === entry.id);
    const platforms = keys.map((key) =>
      platformInput(key, platformRows.find((row) => row.platform === key)),
    );
    const inputs = inputsFor(
      entry,
      rows.energy.find((row) => row.work_entry_id === entry.id),
      rows.expenses.filter((row) => row.work_entry_id === entry.id),
    );
    const privateEarnings = amount(entry.private_earnings);
    const hoursWorked = amount(entry.worked_hours);

    if (entry.period_type === "day") {
      const day = buildSavedWorkDay(config, {
        date: entry.period_start,
        platforms,
        privateEarnings,
        hoursWorked,
        inputs,
      });
      if (day) savedDays.push(day);
      else skipped += 1;
      continue;
    }

    if (entry.period_type === "week" || entry.period_type === "month") {
      const { sharedKilometers, ...expenseInputs } = inputs;
      const period = buildManualPeriod(
        config,
        entry.period_type as SummaryPeriod,
        entry.period_start,
        entry.period_end,
        {
          platforms,
          sharedKilometers,
          privateEarnings,
          workedDays: amount(entry.worked_days),
          hoursWorked,
          ...expenseInputs,
        },
      );
      if (period) manualPeriods.push(period);
      else skipped += 1;
    }
  }

  savedDays.sort((left, right) => left.date.localeCompare(right.date));
  manualPeriods.sort(
    (left, right) =>
      left.startDate.localeCompare(right.startDate) ||
      left.periodType.localeCompare(right.periodType),
  );

  return { savedDays, manualPeriods, skipped };
}
