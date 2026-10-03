/**
 * Jurnalul vehiculului: kilometrajul, reviziile și reparațiile.
 *
 * Aplicația știe sigur doar kilometrii făcuți la lucru. Kilometrajul real
 * crește și cu drumurile personale, așa că estimarea pornește de la ultima
 * citire de la bord (la configurare sau trecută într-o zi) și adaugă doar
 * kilometrii de lucru de după ea. Fiecare citire nouă corectează estimarea.
 */

export type ServiceKind = "revizie" | "reparatie" | "anvelope" | "frane" | "altele";

export const serviceKinds: ServiceKind[] = ["revizie", "reparatie", "anvelope", "frane", "altele"];

export const serviceKindLabels: Record<ServiceKind, string> = {
  revizie: "Revizie",
  reparatie: "Reparație",
  anvelope: "Anvelope",
  frane: "Frâne / plăcuțe",
  altele: "Altă intervenție",
};

/** Ce se știe despre vehicul la configurare. Totul în afară de kilometraj e opțional. */
export interface VehicleServiceConfig {
  /** Kilometrajul de la bord în ziua configurării. */
  odometerKm: number;
  odometerDate: string;
  lastServiceKm: number | null;
  lastServiceDate: string | null;
  /** Revizia la fiecare X km. */
  intervalKm: number | null;
  /** Sau la fiecare X luni, oricât s-ar fi mers. */
  intervalMonths: number | null;
}

/** Ce poate avea o zi salvată, pe lângă sume. */
export interface DayServiceInfo {
  date: string;
  /** Kilometrii de lucru ai zilei. */
  kilometers: number;
  /** Kilometrajul de la bord, dacă a fost trecut. */
  odometerKm?: number;
  serviceCost?: number;
  serviceKind?: ServiceKind;
  serviceNote?: string;
}

export interface ServiceLogEntry {
  date: string;
  kind: ServiceKind;
  note: string;
  cost: number;
  /** Kilometrajul trecut în acea zi sau, dacă lipsește, cel estimat. */
  odometerKm: number | null;
  odometerEstimated: boolean;
}

export type ServiceLevel = "unknown" | "ok" | "soon" | "overdue";

export interface ServiceStatus {
  /** Kilometrajul estimat azi; null când nu s-a trecut niciodată unul. */
  estimatedKm: number | null;
  /** Data ultimei citiri de la bord. */
  lastReadingDate: string | null;
  /** Kilometri de lucru adăugați peste ultima citire. */
  kmSinceReading: number;
  lastServiceKm: number | null;
  lastServiceDate: string | null;
  nextServiceKm: number | null;
  kmLeft: number | null;
  nextServiceDate: string | null;
  daysLeft: number | null;
  level: ServiceLevel;
  /** De ce e „soon” sau „overdue”: după kilometri, după timp sau ambele. */
  reason: "km" | "time" | "both" | null;
}

/** Sub 10% din interval rămas (dar cel puțin 100 km) revizia se arată cu roșu. */
export function soonThresholdKm(intervalKm: number) {
  return Math.max(100, Math.round(intervalKm * 0.1));
}

/** Cu 30 de zile înainte de termenul în luni. */
export const SOON_DAYS = 30;

function addMonths(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

interface Reading {
  date: string;
  km: number;
}

function readings(config: VehicleServiceConfig | undefined, days: DayServiceInfo[]): Reading[] {
  const list: Reading[] = [];
  if (config && config.odometerKm > 0) list.push({ date: config.odometerDate, km: config.odometerKm });
  for (const day of days) {
    if (day.odometerKm && day.odometerKm > 0) list.push({ date: day.date, km: day.odometerKm });
  }
  // Cea mai recentă dată; la aceeași dată, kilometrajul mai mare.
  return list.sort((a, b) => (a.date === b.date ? a.km - b.km : a.date.localeCompare(b.date)));
}

/**
 * Kilometrajul estimat la sfârșitul unei zile: ultima citire până atunci
 * plus kilometrii de lucru de după ea, până la acea zi inclusiv.
 */
export function estimateOdometer(
  config: VehicleServiceConfig | undefined,
  days: DayServiceInfo[],
  date: string,
): { km: number; readingDate: string; kmSinceReading: number } | null {
  const before = readings(config, days).filter((reading) => reading.date <= date);
  const last = before[before.length - 1];
  if (!last) return null;
  const kmSinceReading = days
    .filter((day) => day.date > last.date && day.date <= date)
    .reduce((total, day) => total + Math.max(0, day.kilometers), 0);
  return { km: last.km + kmSinceReading, readingDate: last.date, kmSinceReading };
}

/** Toate intervențiile, cele mai noi primele. */
export function serviceLog(config: VehicleServiceConfig | undefined, days: DayServiceInfo[]): ServiceLogEntry[] {
  return days
    .filter((day) => (day.serviceCost ?? 0) > 0 || day.serviceKind)
    .map((day) => {
      const estimate = day.odometerKm ? null : estimateOdometer(config, days, day.date);
      return {
        date: day.date,
        kind: day.serviceKind ?? "altele",
        note: day.serviceNote?.trim() ?? "",
        cost: Math.max(0, day.serviceCost ?? 0),
        odometerKm: day.odometerKm ?? (estimate ? Math.round(estimate.km) : null),
        odometerEstimated: !day.odometerKm && estimate !== null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function serviceStatus(
  config: VehicleServiceConfig | undefined,
  days: DayServiceInfo[],
  today: string,
): ServiceStatus {
  const estimate = estimateOdometer(config, days, today);
  const estimatedKm = estimate ? Math.round(estimate.km) : null;

  // Ultima revizie: din jurnal, dacă e mai nouă decât cea de la configurare.
  let lastServiceKm = config?.lastServiceKm ?? null;
  let lastServiceDate = config?.lastServiceDate ?? null;
  const lastFromLog = serviceLog(config, days).find((entry) => entry.kind === "revizie" && entry.date <= today);
  if (lastFromLog && (!lastServiceDate || lastFromLog.date >= lastServiceDate)) {
    lastServiceDate = lastFromLog.date;
    lastServiceKm = lastFromLog.odometerKm;
  }

  const intervalKm = config?.intervalKm && config.intervalKm > 0 ? config.intervalKm : null;
  const intervalMonths = config?.intervalMonths && config.intervalMonths > 0 ? config.intervalMonths : null;

  const nextServiceKm = intervalKm !== null && lastServiceKm !== null ? lastServiceKm + intervalKm : null;
  const kmLeft = nextServiceKm !== null && estimatedKm !== null ? nextServiceKm - estimatedKm : null;
  const nextServiceDate = intervalMonths !== null && lastServiceDate ? addMonths(lastServiceDate, intervalMonths) : null;
  const daysLeft = nextServiceDate ? daysBetween(today, nextServiceDate) : null;

  const kmOverdue = kmLeft !== null && kmLeft < 0;
  const timeOverdue = daysLeft !== null && daysLeft < 0;
  const kmSoon = kmLeft !== null && intervalKm !== null && kmLeft <= soonThresholdKm(intervalKm);
  const timeSoon = daysLeft !== null && daysLeft <= SOON_DAYS;

  let level: ServiceLevel = "unknown";
  let reason: ServiceStatus["reason"] = null;
  const pick = (km: boolean, time: boolean) => (km && time ? "both" : km ? "km" : "time");
  if (kmOverdue || timeOverdue) {
    level = "overdue";
    reason = pick(kmOverdue, timeOverdue);
  } else if (kmSoon || timeSoon) {
    level = "soon";
    reason = pick(kmSoon, timeSoon);
  } else if (kmLeft !== null || daysLeft !== null) {
    level = "ok";
  }

  return {
    estimatedKm,
    lastReadingDate: estimate?.readingDate ?? null,
    kmSinceReading: estimate ? Math.round(estimate.kmSinceReading) : 0,
    lastServiceKm,
    lastServiceDate,
    nextServiceKm,
    kmLeft,
    nextServiceDate,
    daysLeft,
    level,
    reason,
  };
}

/** Valori de exemplu, arătate pe fundal la configurare. */
export const serviceIntervalExamples = {
  car: { km: "ex. 15.000", months: "ex. 12" },
  moto: { km: "ex. 5.000", months: "ex. 12" },
  e_bike: { km: "ex. 1.500", months: "ex. 6" },
  bicycle: { km: "ex. 1.500", months: "ex. 6" },
} as const;

const isDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);

/** Citește configurarea salvată; orice valoare stricată se ignoră. */
export function parseVehicleServiceConfig(value: unknown): VehicleServiceConfig | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const odometerKm = positive(record.odometerKm);
  if (odometerKm === null || !isDate(record.odometerDate)) return undefined;
  return {
    odometerKm,
    odometerDate: record.odometerDate,
    lastServiceKm: positive(record.lastServiceKm),
    lastServiceDate: isDate(record.lastServiceDate) ? record.lastServiceDate : null,
    intervalKm: positive(record.intervalKm),
    intervalMonths: positive(record.intervalMonths),
  };
}

export function readServiceKind(value: unknown): ServiceKind | undefined {
  return typeof value === "string" && (serviceKinds as string[]).includes(value) ? (value as ServiceKind) : undefined;
}

/** Câmpurile de jurnal ale unei zile, numai cele care există. */
export function parseDayServiceFields(value: Record<string, unknown>) {
  const odometerKm = positive(value.odometerKm);
  const serviceKind = readServiceKind(value.serviceKind);
  const serviceNote = typeof value.serviceNote === "string" ? value.serviceNote.trim().slice(0, 200) : "";
  return {
    ...(odometerKm !== null ? { odometerKm } : {}),
    ...(serviceKind ? { serviceKind } : {}),
    ...(serviceNote ? { serviceNote } : {}),
  };
}
