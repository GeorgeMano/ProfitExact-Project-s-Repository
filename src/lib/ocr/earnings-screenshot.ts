import { roundMoney } from "@/lib/finance/daily-result";
import type { PlatformEntryInput } from "@/lib/finance/platform-entry";

/**
 * Recunoașterea ecranului „Defalcarea câștigurilor” din textul citit (OCR).
 *
 * Primește textul brut, rând cu rând, și întoarce sumele pe rubricile
 * ProfitExact. Apoi verifică dacă cifrele se leagă între ele exact ca în
 * aplicație: dacă o cifră a fost citită greșit, totalurile nu mai bat și
 * rubricile implicate sunt marcate pentru verificare.
 *
 * Nimic nu se salvează automat: utilizatorul vede rubricile completate și
 * le confirmă, conform regulii din specificație.
 */

export type ScreenshotField =
  | "appRidePayments"
  | "campaigns"
  | "cancellationFees"
  | "appTips"
  | "cashRidePayments"
  | "userCredits"
  | "platformCosts"
  | "applicationCommission";

export interface ScreenshotTotals {
  appRevenue?: number;
  cashRevenue?: number;
  netEarnings?: number;
  cashInHand?: number;
}

export interface ScreenshotReading {
  /** Rubricile găsite în imagine. */
  values: Partial<Record<ScreenshotField, number>>;
  /** Totalurile afișate de aplicație, folosite numai pentru verificare. */
  totals: ScreenshotTotals;
  /** Rubricile care trebuie verificate de utilizator. */
  needsCheck: ScreenshotField[];
  /** Explicații scurte, pe înțelesul utilizatorului. */
  problems: string[];
  /** Ecranul a fost recunoscut: există cel puțin comisionul sau un total. */
  recognized: boolean;
  /** Perioada scrisă în captură („31 aug. - 6 sept.” sau „2 oct.”), dacă s-a găsit. */
  period: { startDate: string; endDate: string } | null;
}

const MONTHS: Record<string, number> = {
  ian: 1, feb: 2, mar: 3, apr: 4, mai: 5, iun: 6,
  iul: 7, aug: 8, sep: 9, oct: 10, noi: 11, nov: 11, dec: 12,
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Perioada din antetul capturii. Anul nu apare, deci se ia cel mai recent an
 * pentru care data nu este în viitor față de `today`.
 */
export function detectPeriod(text: string, today: string) {
  const month = "(ian|feb|mar|apr|mai|iun|iul|aug|sept?|oct|noi|nov|dec)[a-z]*\\.?";
  const range = new RegExp(`(\\d{1,2})(?:\\s*${month})?\\s*[-–—]\\s*(\\d{1,2})\\s*${month}`, "i");
  const single = new RegExp(`(?:^|\\s)(\\d{1,2})\\s*${month}(?:\\s|$)`, "im");
  const plainText = plain(text);
  const todayYear = Number(today.slice(0, 4));

  const resolve = (day: number, monthNumber: number, year: number) => {
    const date = isoDate(year, monthNumber, day);
    return date > today ? isoDate(year - 1, monthNumber, day) : date;
  };
  const valid = (day: number, monthNumber: number | undefined) =>
    monthNumber !== undefined && day >= 1 && day <= 31;

  const rangeMatch = plainText.match(range);
  if (rangeMatch) {
    const endMonth = MONTHS[rangeMatch[4].slice(0, 3)];
    const startMonth = rangeMatch[2] ? MONTHS[rangeMatch[2].slice(0, 3)] : endMonth;
    const startDay = Number(rangeMatch[1]);
    const endDay = Number(rangeMatch[3]);
    if (valid(startDay, startMonth) && valid(endDay, endMonth)) {
      const endDate = resolve(endDay, endMonth, todayYear);
      const endYear = Number(endDate.slice(0, 4));
      // O perioadă ca „29 dec. - 4 ian.” începe în anul dinainte.
      const startYear = startMonth > endMonth ? endYear - 1 : endYear;
      return { startDate: isoDate(startYear, startMonth, startDay), endDate };
    }
  }

  const singleMatch = plainText.match(single);
  if (singleMatch) {
    const monthNumber = MONTHS[singleMatch[2].slice(0, 3)];
    const day = Number(singleMatch[1]);
    if (valid(day, monthNumber)) {
      const date = resolve(day, monthNumber, todayYear);
      return { startDate: date, endDate: date };
    }
  }

  return null;
}

const ROW_FIELDS: ScreenshotField[] = [
  "appRidePayments",
  "campaigns",
  "cancellationFees",
  "appTips",
  "cashRidePayments",
  "userCredits",
  "platformCosts",
];

/** Fără diacritice, cu litere mici: OCR-ul confundă ș/ş, ț/ţ sau le pierde. */
function plain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[şș]/gi, "s")
    .replace(/[ţț]/gi, "t")
    .toLowerCase();
}

/**
 * O sumă în format românesc: „1.225,78”, „+803,90”, „-395,72”, „0,00”.
 * OCR-ul poate pune spații în jurul semnului sau al separatorului de mii.
 */
const MONEY = /([+\-−–]?)\s*(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*[,.]\s*(\d{2})\s*(?:lei|ron)\b/i;

function readMoney(line: string): number | null {
  const match = line.match(MONEY);
  if (!match) return null;
  const whole = match[2].replace(/[.\s]/g, "");
  const value = Number(`${whole}.${match[3]}`);
  return Number.isFinite(value) ? value : null;
}

type LineKind =
  | { type: "section"; section: "app" | "cash"; total: keyof ScreenshotTotals }
  | { type: "total"; total: keyof ScreenshotTotals }
  | { type: "row"; field: ScreenshotField }
  | { type: "ride" };

/** Ce reprezintă un rând, după eticheta lui. Ordinea contează. */
function classify(label: string): LineKind | null {
  if (label.includes("venituri") && label.includes("aplicat")) {
    return { type: "section", section: "app", total: "appRevenue" };
  }
  if (label.includes("venituri") && label.includes("numerar")) {
    return { type: "section", section: "cash", total: "cashRevenue" };
  }
  if (label.includes("castigurile")) return { type: "total", total: "netEarnings" };
  if (label.includes("numerar") && label.includes("mana")) return { type: "total", total: "cashInHand" };
  if (label.includes("plati") && label.includes("curse")) return { type: "ride" };
  if (label.includes("campanii")) return { type: "row", field: "campaigns" };
  if (label.includes("anulare")) return { type: "row", field: "cancellationFees" };
  if (label.includes("bacsis")) return { type: "row", field: "appTips" };
  if (label.includes("credite") || label.includes("promotii")) return { type: "row", field: "userCredits" };
  if (label.includes("costuri") || label.includes("taxe")) return { type: "row", field: "platformCosts" };
  if (label.includes("comision")) return { type: "row", field: "applicationCommission" };
  return null;
}

const near = (left: number, right: number) => Math.abs(left - right) < 0.015;

export function parseEarningsScreenshot(text: string, today?: string): ScreenshotReading {
  const values: Partial<Record<ScreenshotField, number>> = {};
  const totals: ScreenshotTotals = {};
  let section: "app" | "cash" | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const kind = classify(plain(line));
    if (!kind) continue;
    const amount = readMoney(line);

    if (kind.type === "section") {
      section = kind.section;
      if (amount !== null) totals[kind.total] = amount;
      continue;
    }
    if (amount === null) continue;

    if (kind.type === "total") {
      totals[kind.total] = amount;
    } else if (kind.type === "ride") {
      // „Plăți pentru curse” apare de două ori; secțiunea decide care e.
      if (section === "cash") values.cashRidePayments = amount;
      else values.appRidePayments = amount;
    } else if (values[kind.field] === undefined) {
      values[kind.field] = amount;
    }
  }

  return {
    ...verify(values, totals),
    period: today ? detectPeriod(text, today) : null,
  };
}

function verify(
  values: Partial<Record<ScreenshotField, number>>,
  totals: ScreenshotTotals,
): Omit<ScreenshotReading, "period"> {
  const needsCheck = new Set<ScreenshotField>();
  const problems: string[] = [];
  const value = (field: ScreenshotField) => values[field] ?? 0;
  const flag = (fields: ScreenshotField[], message: string) => {
    fields.forEach((field) => needsCheck.add(field));
    problems.push(message);
  };

  const appRows: ScreenshotField[] = ["appRidePayments", "campaigns", "cancellationFees", "appTips"];
  const cashRows: ScreenshotField[] = ["cashRidePayments", "userCredits"];

  if (totals.appRevenue !== undefined) {
    const sum = roundMoney(appRows.reduce((total, field) => total + value(field), 0));
    if (!near(sum, totals.appRevenue)) {
      flag(appRows, `Rândurile de la „Venituri în aplicație” dau ${sum.toFixed(2)}, dar totalul citit este ${totals.appRevenue.toFixed(2)}.`);
    }
  }

  if (totals.cashRevenue !== undefined) {
    const sum = roundMoney(cashRows.reduce((total, field) => total + value(field), 0));
    if (!near(sum, totals.cashRevenue)) {
      flag(cashRows, `Rândurile de la „Venituri în numerar” dau ${sum.toFixed(2)}, dar totalul citit este ${totals.cashRevenue.toFixed(2)}.`);
    }
  }

  if (totals.cashInHand !== undefined && values.cashRidePayments !== undefined && !near(totals.cashInHand, values.cashRidePayments)) {
    flag(["cashRidePayments"], "„Numerar în mână” nu este egal cu plățile cash pentru curse.");
  }

  if (values.applicationCommission === undefined) {
    flag(["applicationCommission"], "Comisionul nu a putut fi citit. Introdu-l din aplicație.");
  } else if (totals.netEarnings !== undefined) {
    const app = totals.appRevenue ?? appRows.reduce((total, field) => total + value(field), 0);
    const cash = totals.cashRevenue ?? cashRows.reduce((total, field) => total + value(field), 0);
    const net = roundMoney(app + cash - value("platformCosts") - value("applicationCommission"));
    if (!near(net, totals.netEarnings)) {
      flag(
        ["platformCosts", "applicationCommission"],
        `Calculul dă câștiguri de ${net.toFixed(2)}, dar în captură apar ${totals.netEarnings.toFixed(2)}.`,
      );
    }
  }

  const recognized =
    values.applicationCommission !== undefined ||
    totals.netEarnings !== undefined ||
    ROW_FIELDS.some((field) => values[field] !== undefined);

  return { values, totals, needsCheck: [...needsCheck], problems, recognized };
}

/**
 * Rubricile de pus în formular. Rândurile lipsă din captură devin 0 numai dacă
 * totalurile s-au verificat, altfel rămân cum erau, ca să nu se piardă nimic.
 */
export function entryFromReading(
  current: PlatformEntryInput,
  reading: ScreenshotReading,
): PlatformEntryInput {
  const next: PlatformEntryInput = { ...current };
  const totalsConfirmed = reading.problems.length === 0 && reading.totals.netEarnings !== undefined;

  for (const field of ROW_FIELDS) {
    const found = reading.values[field];
    if (found !== undefined) next[field] = found;
    else if (totalsConfirmed) next[field] = 0;
  }

  if (reading.values.applicationCommission !== undefined) {
    next.applicationCommission = reading.values.applicationCommission;
  }

  return next;
}
