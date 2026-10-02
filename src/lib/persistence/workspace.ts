import type {
  CostPeriod,
  FuelType,
  HybridType,
  OnboardingConfig,
  PlatformChoice,
  ProfitView,
  RecurringCostConfig,
  VehicleOwnership,
} from "@/domain/onboarding";
import type { FinancialResult, FleetCommission } from "@/lib/finance/daily-result";
import type { SavedManualPeriod, ManualPeriodValues } from "@/lib/finance/manual-period";
import {
  platformEntryTotals,
  type KilometerEntryMode,
  type PlatformEntryInput,
  type PlatformKey,
} from "@/lib/finance/platform-entry";
import type {
  PeriodContribution,
  SavedPlatformEntry,
  SavedWorkDay,
  SavedWorkDayInputs,
  SummaryPeriod,
} from "@/lib/finance/weekly-summary";

/**
 * Forma unică a datelor salvate.
 *
 * Aceeași structură este folosită în modul demo (salvare pe calculator) și în
 * modul real (salvare în contul Supabase). Driverele diferă, datele nu — de
 * aceea trecerea de la demo la cont nu cere rescrierea interfeței.
 */
export const WORKSPACE_VERSION = 1;

export interface WorkspaceAccount {
  email: string;
  /** Neutilizat deocamdată: înregistrarea se face numai cu email. */
  phone: string;
  /** Momentul la care emailul a fost confirmat. */
  verifiedAt: string | null;
}

export interface WorkspaceSnapshot {
  version: number;
  savedAt: string | null;
  account: WorkspaceAccount | null;
  config: OnboardingConfig | null;
  savedDays: SavedWorkDay[];
  manualPeriods: SavedManualPeriod[];
}

export function createEmptyWorkspace(): WorkspaceSnapshot {
  return {
    version: WORKSPACE_VERSION,
    savedAt: null,
    account: null,
    config: null,
    savedDays: [],
    manualPeriods: [],
  };
}

/* ------------------------------------------------------------------ */
/* Validare                                                            */
/* ------------------------------------------------------------------ */

/**
 * Datele citite din storage pot fi vechi, incomplete sau modificate manual.
 * Toate funcțiile de mai jos returnează `null` în loc să arunce, iar aplicația
 * pornește curat dacă ceva nu se potrivește. Un `fuelType` invalid, de exemplu,
 * ar strica afișarea etichetelor, deci este respins din start.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readIsoDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function readEnum<Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): Value | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as Value)
    : null;
}

const platformChoices = ["bolt", "uber", "bolt_uber"] as const satisfies readonly PlatformChoice[];
const profitViews = ["together", "separate"] as const satisfies readonly ProfitView[];
const ownerships = ["owned", "rented"] as const satisfies readonly VehicleOwnership[];
const fuelTypes = [
  "gasoline",
  "diesel",
  "electric",
  "gasoline_lpg",
  "hybrid_gasoline",
  "hybrid_diesel",
] as const satisfies readonly FuelType[];
const costPeriods = ["weekly", "monthly", "annual", "validity"] as const satisfies readonly CostPeriod[];
const costCategories = [
  "accounting",
  "cash_register",
  "fleet_withholding",
  "vehicle_rent",
  "rca",
  "casco",
  "itp",
  "vignette",
  "leasing",
  "phone_internet",
] as const satisfies readonly RecurringCostConfig["category"][];
const summaryPeriods = ["week", "month"] as const satisfies readonly SummaryPeriod[];
const platformKeys = ["bolt", "uber"] as const satisfies readonly PlatformKey[];
const kilometerEntryModes = [
  "per_platform",
  "shared",
] as const satisfies readonly KilometerEntryMode[];

function parseFleetCommission(value: unknown): FleetCommission | null {
  if (!isRecord(value)) return null;
  const amount = readNumber(value.value, -1);
  if (amount < 0) return null;

  if (value.type === "fixed") {
    return { type: "fixed", value: amount };
  }

  if (value.type === "percentage") {
    const base = readEnum(value.base, ["gross", "net"] as const);
    if (!base) return null;
    return { type: "percentage", value: amount, base };
  }

  return null;
}

function parseRecurringCost(value: unknown): RecurringCostConfig | null {
  if (!isRecord(value)) return null;

  const category = readEnum(value.category, costCategories);
  const period = readEnum(value.period, costPeriods);
  const effectiveFrom = readIsoDate(value.effectiveFrom);
  const id = readString(value.id);
  if (!category || !period || !effectiveFrom || !id) return null;

  const validityDays = readOptionalNumber(value.validityDays);

  return {
    id,
    category,
    label: readString(value.label, category),
    amount: Math.max(0, readNumber(value.amount)),
    period,
    ...(validityDays !== null && validityDays > 0
      ? { validityDays }
      : {}),
    effectiveFrom,
    paidToFleet: value.paidToFleet === true,
  };
}

export function parseOnboardingConfig(value: unknown): OnboardingConfig | null {
  if (!isRecord(value)) return null;

  const platform = readEnum(value.platform, platformChoices);
  const profitView = readEnum(value.profitView, profitViews);
  // Configurațiile salvate înainte de introducerea alegerii nu au câmpul,
  // iar modul pe platformă este comportamentul de până acum.
  const kilometerEntry =
    readEnum(value.kilometerEntry, kilometerEntryModes) ?? "per_platform";
  const vehicleOwnership = readEnum(value.vehicleOwnership, ownerships);
  const fuelType = readEnum(value.fuelType, fuelTypes);
  const effectiveFrom = readIsoDate(value.effectiveFrom);
  const fleetCommission = parseFleetCommission(value.fleetCommission);
  const cityKey = readString(value.cityKey);

  if (
    value.activity !== "ridesharing" ||
    value.workMode !== "employee" ||
    !platform ||
    !profitView ||
    !vehicleOwnership ||
    !fuelType ||
    !effectiveFrom ||
    !fleetCommission ||
    !cityKey
  ) {
    return null;
  }

  const hybridType: HybridType = readEnum(value.hybridType, ["hev", "phev"] as const);
  const primaryFuel = readEnum(value.primaryFuel, ["gasoline", "lpg"] as const);

  const recurringCosts = Array.isArray(value.recurringCosts)
    ? value.recurringCosts
        .map(parseRecurringCost)
        .filter((cost): cost is RecurringCostConfig => cost !== null)
    : [];

  return {
    activity: "ridesharing",
    workMode: "employee",
    platform,
    cityName: readString(value.cityName, cityKey),
    cityKey,
    profitView,
    kilometerEntry,
    vehicleOwnership,
    fuelType,
    hybridType,
    primaryFuel,
    consumptionPer100Km: Math.max(0, readNumber(value.consumptionPer100Km)),
    fleetCommission,
    weeklyCimCost: Math.max(0, readNumber(value.weeklyCimCost)),
    effectiveFrom,
    recurringCosts,
  };
}

/**
 * Rândurile din ecranul aplicației, citite din oricare dintre formele salvate:
 *
 *   - forma curentă, rând cu rând, ca în „Defalcarea câștigurilor”;
 *   - forma inițială (card, cash, compensări, tips din aplicație);
 *   - forma de tranziție, numai cu câștigul net și numerarul în mână.
 *
 * Din forma de tranziție nu se pot reface rândurile, deci se păstrează totalul:
 * numerarul devine „plăți pentru curse” cash, iar restul până la câștigul net
 * (plus comisionul și costurile) devine „plăți pentru curse” prin aplicație.
 * Câștigurile tale și banii prin flotă ies astfel exact ca la salvare.
 */
function readPlatformRows(value: Record<string, unknown>) {
  const commission = readOptionalNumber(value.applicationCommission);
  const platformCosts = readNumber(value.platformCosts);
  const cashTips = readNumber(value.cashTips);
  const base = {
    campaigns: 0,
    cancellationFees: 0,
    appTips: 0,
    userCredits: 0,
    platformCosts,
    applicationCommission: commission,
    cashTips,
  };

  if ("appRidePayments" in value || "cashRidePayments" in value) {
    return {
      ...base,
      appRidePayments: readNumber(value.appRidePayments),
      campaigns: readNumber(value.campaigns),
      cancellationFees: readNumber(value.cancellationFees),
      appTips: readNumber(value.appTips),
      cashRidePayments: readNumber(value.cashRidePayments),
      userCredits: readNumber(value.userCredits),
    };
  }

  if ("cardEarnings" in value || "cashEarnings" in value) {
    return {
      ...base,
      appRidePayments: readNumber(value.cardEarnings),
      campaigns: readNumber(value.compensations),
      appTips: readNumber(value.appTips),
      cashRidePayments: readNumber(value.cashEarnings),
    };
  }

  if ("netEarnings" in value) {
    const cashInHand = readNumber(value.cashInHand);
    return {
      ...base,
      appRidePayments: Math.max(
        0,
        readNumber(value.netEarnings) - cashInHand + (commission ?? 0) + platformCosts,
      ),
      cashRidePayments: cashInHand,
    };
  }

  return { ...base, appRidePayments: 0, cashRidePayments: 0 };
}

function parsePlatformEntry(value: unknown): SavedPlatformEntry | null {
  if (!isRecord(value)) return null;
  const platform = readEnum(value.platform, platformKeys);
  if (!platform) return null;

  const rows = { platform, ...readPlatformRows(value), kilometers: readNumber(value.kilometers) };
  const totals = platformEntryTotals(rows);

  return {
    ...rows,
    ...totals,
    kilometers: rows.kilometers,
    energyCost: readNumber(value.energyCost),
    fleetCommission: readNumber(value.fleetCommission),
    totalEarnings: readNumber(value.totalEarnings),
    resultBeforeCommonCosts: readNumber(value.resultBeforeCommonCosts),
  };
}

function parsePlatformEntries(value: unknown): SavedPlatformEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const entries = value
    .map(parsePlatformEntry)
    .filter((entry): entry is SavedPlatformEntry => entry !== null);

  // O defalcare incompletă ar da totaluri greșite, deci se ignoră în întregime.
  return entries.length === value.length && entries.length > 0 ? entries : undefined;
}

function parseWorkDayInputs(value: unknown): SavedWorkDayInputs | undefined {
  if (!isRecord(value)) return undefined;

  return {
    sharedKilometers: readNumber(value.sharedKilometers),
    unitPrice: readNumber(value.unitPrice),
    gasolineCost: readNumber(value.gasolineCost),
    electricCost: readNumber(value.electricCost),
    washingCost: readNumber(value.washingCost),
    parkingCost: readNumber(value.parkingCost),
    roadTollCost: readNumber(value.roadTollCost),
    serviceCost: readNumber(value.serviceCost),
    otherCost: readNumber(value.otherCost),
  };
}

/** Totalurile unei zile sau perioade salvate, din oricare formă salvată. */
function readPeriodEarnings(value: Record<string, unknown>) {
  const commission = readNumber(value.applicationCommission);
  const platformCosts = readNumber(value.platformCosts);
  let appRevenue: number;
  let cashRevenue: number;
  let netEarnings: number;
  let cashInHand: number;

  if ("appRevenue" in value) {
    appRevenue = readNumber(value.appRevenue);
    cashRevenue = readNumber(value.cashRevenue);
    netEarnings = readNumber(value.netEarnings);
    cashInHand = readNumber(value.cashInHand);
  } else if ("netEarnings" in value) {
    netEarnings = readNumber(value.netEarnings);
    cashInHand = readNumber(value.cashInHand);
    cashRevenue = cashInHand;
    appRevenue = Math.max(0, netEarnings - cashInHand + commission + platformCosts);
  } else {
    const card = readNumber(value.cardEarnings);
    const cash = readNumber(value.cashEarnings);
    appRevenue = card + readNumber(value.compensations) + readNumber(value.appTips);
    cashRevenue = cash;
    cashInHand = cash;
    netEarnings = Math.max(0, appRevenue + cashRevenue - commission);
  }

  return {
    appRevenue,
    cashRevenue,
    netEarnings,
    cashInHand,
    applicationCommission: commission,
    platformCosts,
    cashTips: readNumber(value.cashTips),
    amountManagedByFleet: readNumber(value.amountManagedByFleet, netEarnings - cashInHand),
  };
}

export function parseSavedWorkDay(value: unknown): SavedWorkDay | null {
  if (!isRecord(value)) return null;
  const date = readIsoDate(value.date);
  if (!date) return null;

  const platforms = parsePlatformEntries(value.platforms);
  const inputs = parseWorkDayInputs(value.inputs);

  return {
    date,
    ...(platforms ? { platforms } : {}),
    ...(inputs ? { inputs } : {}),
    ...readPeriodEarnings(value),
    privateEarnings: readNumber(value.privateEarnings),
    result: readNumber(value.result),
    resultBeforeCalendarCosts: readNumber(value.resultBeforeCalendarCosts),
    fleetBalance: readNumber(value.fleetBalance),
    fleetBalanceBeforeCalendarCosts: readNumber(
      value.fleetBalanceBeforeCalendarCosts,
    ),
    totalEarnings: readNumber(value.totalEarnings),
    energyCost: readNumber(value.energyCost),
    fleetCommission: readNumber(value.fleetCommission),
    oneOffCosts: readNumber(value.oneOffCosts),
    hoursWorked: readNumber(value.hoursWorked),
    kilometers: readNumber(value.kilometers),
  };
}

function parseFinancialResult(value: unknown): FinancialResult | null {
  if (!isRecord(value)) return null;

  return {
    grossPlatformEarnings: readNumber(value.grossPlatformEarnings),
    applicationCommission: readNumber(value.applicationCommission),
    platformCosts: readNumber(value.platformCosts),
    platformNetEarnings: readNumber(value.platformNetEarnings),
    cashInHand: readNumber(value.cashInHand),
    totalEarnings: readNumber(value.totalEarnings),
    energyCost: readNumber(value.energyCost),
    fleetCommission: readNumber(value.fleetCommission),
    cimCost: readNumber(value.cimCost),
    recurringCosts: readNumber(value.recurringCosts),
    recurringFleetCosts: readNumber(value.recurringFleetCosts),
    oneOffCosts: readNumber(value.oneOffCosts),
    totalExpenses: readNumber(value.totalExpenses),
    result: readNumber(value.result),
    resultPerKm: readOptionalNumber(value.resultPerKm),
    amountManagedByFleet: readNumber(value.amountManagedByFleet),
    fleetBalance: readNumber(value.fleetBalance),
  };
}

function parseContribution(value: unknown): PeriodContribution | null {
  if (!isRecord(value)) return null;
  const startDate = readIsoDate(value.startDate);
  const endDate = readIsoDate(value.endDate);
  if (!startDate || !endDate) return null;

  return {
    startDate,
    endDate,
    ...readPeriodEarnings(value),
    privateEarnings: readNumber(value.privateEarnings),
    totalEarnings: readNumber(value.totalEarnings),
    energyCost: readNumber(value.energyCost),
    fleetCommission: readNumber(value.fleetCommission),
    oneOffCosts: readNumber(value.oneOffCosts),
    resultBeforeCalendarCosts: readNumber(value.resultBeforeCalendarCosts),
    fleetBalanceBeforeCalendarCosts: readNumber(
      value.fleetBalanceBeforeCalendarCosts,
    ),
    hoursWorked: readNumber(value.hoursWorked),
    kilometers: readNumber(value.kilometers),
  };
}

function parseManualPlatformEntry(value: unknown): PlatformEntryInput | null {
  if (!isRecord(value)) return null;
  const platform = readEnum(value.platform, platformKeys);
  if (!platform) return null;

  return { platform, ...readPlatformRows(value), kilometers: readNumber(value.kilometers) };
}

function parseManualValues(value: unknown): ManualPeriodValues | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.platforms)) return null;

  const platforms = value.platforms
    .map(parseManualPlatformEntry)
    .filter((entry): entry is PlatformEntryInput => entry !== null);

  // O perioadă fără platforme valide nu poate fi recalculată corect.
  if (platforms.length === 0 || platforms.length !== value.platforms.length) {
    return null;
  }

  return {
    platforms,
    sharedKilometers: readNumber(value.sharedKilometers),
    privateEarnings: readNumber(value.privateEarnings),
    workedDays: readNumber(value.workedDays),
    hoursWorked: readNumber(value.hoursWorked),
    unitPrice: readNumber(value.unitPrice),
    gasolineCost: readNumber(value.gasolineCost),
    electricCost: readNumber(value.electricCost),
    washingCost: readNumber(value.washingCost),
    parkingCost: readNumber(value.parkingCost),
    roadTollCost: readNumber(value.roadTollCost),
    serviceCost: readNumber(value.serviceCost),
    otherCost: readNumber(value.otherCost),
  };
}

export function parseManualPeriod(value: unknown): SavedManualPeriod | null {
  if (!isRecord(value)) return null;

  const periodType = readEnum(value.periodType, summaryPeriods);
  const startDate = readIsoDate(value.startDate);
  const endDate = readIsoDate(value.endDate);
  const values = parseManualValues(value.values);
  const result = parseFinancialResult(value.result);
  const contribution = parseContribution(value.contribution);

  if (!periodType || !startDate || !endDate || !values || !result || !contribution) {
    return null;
  }

  return {
    id: readString(value.id, `${periodType}:${startDate}:${endDate}`),
    periodType,
    startDate,
    endDate,
    values,
    result,
    contribution,
  };
}

function parseAccount(value: unknown): WorkspaceAccount | null {
  if (!isRecord(value)) return null;
  const email = readString(value.email);
  if (!email) return null;

  return {
    email,
    phone: readString(value.phone),
    verifiedAt: typeof value.verifiedAt === "string" ? value.verifiedAt : null,
  };
}

/**
 * Transformă orice valoare citită din storage într-un instantaneu valid.
 * Returnează `null` dacă versiunea nu este cunoscută sau structura lipsește.
 */
export function parseWorkspace(value: unknown): WorkspaceSnapshot | null {
  if (!isRecord(value)) return null;
  if (readNumber(value.version, -1) !== WORKSPACE_VERSION) return null;

  const savedDays = Array.isArray(value.savedDays)
    ? value.savedDays
        .map(parseSavedWorkDay)
        .filter((day): day is SavedWorkDay => day !== null)
        .sort((left, right) => left.date.localeCompare(right.date))
    : [];

  const manualPeriods = Array.isArray(value.manualPeriods)
    ? value.manualPeriods
        .map(parseManualPeriod)
        .filter((entry): entry is SavedManualPeriod => entry !== null)
    : [];

  return {
    version: WORKSPACE_VERSION,
    savedAt: typeof value.savedAt === "string" ? value.savedAt : null,
    account: parseAccount(value.account),
    config: parseOnboardingConfig(value.config),
    savedDays,
    manualPeriods,
  };
}

/** Citește un instantaneu dintr-un text JSON, fără să arunce niciodată. */
export function deserializeWorkspace(raw: string | null): WorkspaceSnapshot | null {
  if (!raw) return null;
  try {
    return parseWorkspace(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function serializeWorkspace(snapshot: WorkspaceSnapshot) {
  return JSON.stringify({
    ...snapshot,
    version: WORKSPACE_VERSION,
    savedAt: new Date().toISOString(),
  });
}

/** Instantaneul are conținut real, nu doar structura goală. */
export function isEmptyWorkspace(snapshot: WorkspaceSnapshot) {
  return (
    snapshot.config === null &&
    snapshot.account === null &&
    snapshot.savedDays.length === 0 &&
    snapshot.manualPeriods.length === 0
  );
}
