import { roundMoney } from "./daily-result";
import type {
  PlatformEntryInput,
  PlatformEntryResult,
  PlatformKey,
} from "./platform-entry";

export type SummaryPeriod = "week" | "month";

/**
 * Defalcarea pe platformă a unei perioade salvate.
 *
 * Cheltuielile comune ale zilei — CIM, chirie, RCA, spălare, parcare — nu apar
 * aici: ele aparțin mașinii și zilei, nu aplicației. De aceea rezultatul de mai
 * jos este „înainte de cheltuielile comune”.
 */
export interface SavedPlatformEntry {
  platform: PlatformKey;
  /** Rândurile introduse din ecranul aplicației — vezi `PlatformEntryInput`. */
  appRidePayments: number;
  campaigns: number;
  cancellationFees: number;
  appTips: number;
  cashRidePayments: number;
  userCredits: number;
  platformCosts: number;
  applicationCommission: number;
  cashTips: number;
  /** Totalurile calculate din rânduri, ca în aplicație. */
  appRevenue: number;
  cashRevenue: number;
  /** „Câștigurile tale”. */
  netEarnings: number;
  /** Plățile cash pentru curse: singurii bani rămași fizic la șofer. */
  cashInHand: number;
  kilometers: number;
  energyCost: number;
  fleetCommission: number;
  totalEarnings: number;
  resultBeforeCommonCosts: number;
}

/**
 * Ce a introdus efectiv șoferul, dincolo de totalurile calculate.
 *
 * Fără aceste valori o zi salvată nu poate fi reconstituită: prețul unitar și
 * defalcarea cheltuielilor punctuale se pierdeau în totaluri, deci ziua nu putea
 * fi nici corectată, nici scrisă în `energy_entries` și `expenses`.
 */
export interface SavedWorkDayInputs {
  /** Totalul introdus în modul „kilometri în comun”. */
  sharedKilometers: number;
  unitPrice: number;
  gasolineCost: number;
  electricCost: number;
  washingCost: number;
  parkingCost: number;
  roadTollCost: number;
  serviceCost: number;
  otherCost: number;
}

export interface SavedWorkDay {
  date: string;
  /**
   * Opțional: zilele salvate înainte de introducerea defalcării nu îl au.
   * Când există, poate fi scris fidel în `platform_earnings`.
   */
  platforms?: SavedPlatformEntry[];
  /** Opțional, din același motiv: zilele vechi nu îl au. */
  inputs?: SavedWorkDayInputs;
  /** Venituri în aplicație și venituri în numerar, ca în ecranul aplicației. */
  appRevenue: number;
  cashRevenue: number;
  netEarnings: number;
  cashInHand: number;
  applicationCommission: number;
  platformCosts: number;
  cashTips: number;
  privateEarnings: number;
  /** Câștig net − numerar în mână: banii care ajung la flotă. */
  amountManagedByFleet: number;
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
  /** Defalcarea pe platformă, când perioada a fost introdusă cu ea. */
  platforms?: SavedPlatformEntry[];
  /** Venituri în aplicație și venituri în numerar, ca în ecranul aplicației. */
  appRevenue: number;
  cashRevenue: number;
  netEarnings: number;
  cashInHand: number;
  applicationCommission: number;
  platformCosts: number;
  cashTips: number;
  privateEarnings: number;
  /** Câștig net − numerar în mână: banii care ajung la flotă. */
  amountManagedByFleet: number;
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
  totalAppRevenue: number;
  totalCashRevenue: number;
  totalNetEarnings: number;
  totalCashInHand: number;
  totalApplicationCommission: number;
  totalPlatformCosts: number;
  totalCashTips: number;
  totalPrivateEarnings: number;
  totalAmountManagedByFleet: number;
  totalFleetCosts: number;
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

/**
 * Adună defalcările pe platformă ale mai multor zile sau perioade.
 * Platformele fără date lipsesc din rezultat, în loc să apară cu zerouri.
 */
const platformNumberKeys = [
  "appRidePayments",
  "campaigns",
  "cancellationFees",
  "appTips",
  "cashRidePayments",
  "userCredits",
  "platformCosts",
  "applicationCommission",
  "cashTips",
  "appRevenue",
  "cashRevenue",
  "netEarnings",
  "cashInHand",
  "kilometers",
  "energyCost",
  "fleetCommission",
  "totalEarnings",
  "resultBeforeCommonCosts",
] as const satisfies readonly (keyof SavedPlatformEntry)[];

export function aggregatePlatformEntries(
  groups: (SavedPlatformEntry[] | undefined)[],
): SavedPlatformEntry[] {
  const totals = new Map<PlatformKey, SavedPlatformEntry>();

  for (const group of groups) {
    for (const entry of group ?? []) {
      const current = totals.get(entry.platform);
      if (!current) {
        totals.set(entry.platform, { ...entry });
        continue;
      }
      for (const key of platformNumberKeys) {
        current[key] = current[key] + entry[key];
      }
    }
  }

  return [...totals.values()].map((entry) => {
    const rounded = { ...entry };
    for (const key of platformNumberKeys) {
      rounded[key] = roundMoney(entry[key]);
    }
    return rounded;
  });
}

/** Ce se salvează pentru o platformă: rândurile introduse plus calculul lor. */
export function toSavedPlatformEntry(
  entry: PlatformEntryInput,
  item: PlatformEntryResult,
): SavedPlatformEntry {
  const amount = (value: number) => roundMoney(Math.max(0, value));

  return {
    platform: item.platform,
    appRidePayments: amount(entry.appRidePayments),
    campaigns: amount(entry.campaigns),
    cancellationFees: amount(entry.cancellationFees),
    appTips: amount(entry.appTips),
    cashRidePayments: amount(entry.cashRidePayments),
    userCredits: amount(entry.userCredits),
    platformCosts: item.platformCosts,
    applicationCommission: item.applicationCommission,
    cashTips: amount(entry.cashTips),
    appRevenue: item.appRevenue,
    cashRevenue: item.cashRevenue,
    netEarnings: item.netEarnings,
    cashInHand: item.cashInHand,
    kilometers: item.kilometers,
    energyCost: item.energyCost,
    fleetCommission: item.fleetCommission,
    totalEarnings: item.totalEarnings,
    resultBeforeCommonCosts: item.resultBeforeCommonCosts,
  };
}

/** Contribuția unei zile salvate la centralizarea perioadei. */
export function contributionFromDay(day: SavedWorkDay): PeriodContribution {
  return {
    startDate: day.date,
    endDate: day.date,
    platforms: day.platforms,
    appRevenue: day.appRevenue,
    cashRevenue: day.cashRevenue,
    netEarnings: day.netEarnings,
    cashInHand: day.cashInHand,
    applicationCommission: day.applicationCommission,
    platformCosts: day.platformCosts,
    cashTips: day.cashTips,
    privateEarnings: day.privateEarnings,
    amountManagedByFleet: day.amountManagedByFleet,
    totalEarnings: day.totalEarnings,
    energyCost: day.energyCost,
    fleetCommission: day.fleetCommission,
    oneOffCosts: day.oneOffCosts,
    resultBeforeCalendarCosts: day.resultBeforeCalendarCosts,
    fleetBalanceBeforeCalendarCosts: day.fleetBalanceBeforeCalendarCosts,
    hoursWorked: day.hoursWorked,
    kilometers: day.kilometers,
  };
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
    selectedDays.map(contributionFromDay),
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
      totalAppRevenue: summary.totalAppRevenue + entry.appRevenue,
      totalCashRevenue: summary.totalCashRevenue + entry.cashRevenue,
      totalNetEarnings: summary.totalNetEarnings + entry.netEarnings,
      totalCashInHand: summary.totalCashInHand + entry.cashInHand,
      totalApplicationCommission:
        summary.totalApplicationCommission + entry.applicationCommission,
      totalPlatformCosts: summary.totalPlatformCosts + entry.platformCosts,
      totalCashTips: summary.totalCashTips + entry.cashTips,
      totalPrivateEarnings:
        summary.totalPrivateEarnings + entry.privateEarnings,
      totalAmountManagedByFleet:
        summary.totalAmountManagedByFleet + entry.amountManagedByFleet,
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
      totalAppRevenue: 0,
      totalCashRevenue: 0,
      totalNetEarnings: 0,
      totalCashInHand: 0,
      totalApplicationCommission: 0,
      totalPlatformCosts: 0,
      totalCashTips: 0,
      totalPrivateEarnings: 0,
      totalAmountManagedByFleet: 0,
      totalFleetCosts: 0,
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
    totalAppRevenue: roundMoney(summary.totalAppRevenue),
    totalCashRevenue: roundMoney(summary.totalCashRevenue),
    totalNetEarnings: roundMoney(summary.totalNetEarnings),
    totalCashInHand: roundMoney(summary.totalCashInHand),
    totalApplicationCommission: roundMoney(
      summary.totalApplicationCommission,
    ),
    totalPlatformCosts: roundMoney(summary.totalPlatformCosts),
    totalCashTips: roundMoney(summary.totalCashTips),
    totalAmountManagedByFleet: roundMoney(summary.totalAmountManagedByFleet),
    // Ce reține flota în afară de comision: CIM și costurile plătite flotei.
    totalFleetCosts: roundMoney(
      calendarCosts.cimCost + calendarCosts.recurringFleetCosts,
    ),
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
