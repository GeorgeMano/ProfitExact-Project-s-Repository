import { roundMoney } from "@/lib/finance/daily-result";
import type { DeliveryPlatform, PlatformEntryInput } from "@/lib/finance/platform-entry";
import { detectPeriod } from "./earnings-screenshot";

/**
 * Citirea capturilor din aplicațiile de livrări.
 *
 * Mecanismul este comun: fiecare aplicație are „cititorul” ei (etichetele și
 * așezarea ecranului ei), dar toate întorc același rezultat, verificat la fel
 * ca la Bolt: rubricile citite, totalurile din captură, rubricile de verificat
 * și explicațiile pentru utilizator. Nimic nu se salvează automat.
 *
 * Ecrane cunoscute (din capturi reale):
 *   - Wolt → „Statisticile tale” (Azi / Săptămâna / Luna / Personalizat):
 *     livrări finalizate, distanța, câștiguri (estimare); la „Personalizat”
 *     și câștigurile fără bacșiș + bacșișul.
 *   - Bolt Food → „Toate livrările”: zilele cu totalul și numărul de livrări,
 *     apoi fiecare livrare cu suma ei.
 *   - Bolt Food → „Performanță”: livrări finalizate și distanța (fără bani).
 *   - Glovo → „Payments” (săptămâna, cu anul dedesubt): Total income,
 *     Average per hour, Hours online, Deliveries „N Completed · N Cancelled”.
 *     Valorile stau pe rândul de sub etichetă.
 */

export type DeliveryField = "appRidePayments" | "appTips" | "kilometers" | "hoursOnline";

export type DeliveryScreen = "wolt_stats" | "boltfood_list" | "boltfood_performance" | "glovo_payments";

export interface DeliveryPeriod {
  startDate: string;
  endDate: string;
  kind: "day" | "week" | "month" | "custom";
}

/** O zi din lista „Toate livrările” (Bolt Food). */
export interface DeliveryDay {
  date: string;
  total: number;
  /** Numărul de livrări scris sub dată („Livrări: 2”). */
  deliveries: number | null;
  /** Sumele livrărilor vizibile în captură (pot lipsi unele, dacă lista e tăiată). */
  amounts: number[];
}

export interface DeliveryReading {
  platform: DeliveryPlatform | null;
  screen: DeliveryScreen | null;
  recognized: boolean;
  /** Rubricile găsite. `appRidePayments` = câștigul fără bacșiș. */
  values: Partial<Record<DeliveryField, number>>;
  /** Totalul câștigurilor afișat de aplicație, folosit pentru verificare. */
  total?: number;
  deliveries: number | null;
  /** Glovo: livrări anulate și ore online. */
  cancelledDeliveries?: number;
  hoursOnline?: number;
  period: DeliveryPeriod | null;
  /** Zilele din lista Bolt Food; goală pentru celelalte ecrane. */
  days: DeliveryDay[];
  needsCheck: DeliveryField[];
  problems: string[];
  /** Precizări care nu sunt greșeli (de exemplu „suma este o estimare”). */
  notes: string[];
  /** Textul brut scos de OCR din imagine, arătat utilizatorului la cerere. */
  rawText?: string;
}

const MONTHS: Record<string, number> = {
  ian: 1, feb: 2, mar: 3, apr: 4, mai: 5, iun: 6,
  iul: 7, aug: 8, sep: 9, oct: 10, noi: 11, nov: 11, dec: 12,
};

const MONTH_WORD =
  "(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)";

function plain(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[şș]/gi, "s")
    .replace(/[ţț]/gi, "t")
    .toLowerCase();
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const near = (left: number, right: number) => Math.abs(left - right) < 0.015;

/** O sumă cu zecimale: „125,00 RON”, „1.225,78 RON”. */
function readMoney(line: string): number | null {
  const match = line.match(/(\d{1,3}(?:[.\s]\d{3})*|\d+)\s*[,.]\s*(\d{2})\s*(?:ron|lei)\b/i);
  if (!match) return null;
  const value = Number(`${match[1].replace(/[.\s]/g, "")}.${match[2]}`);
  return Number.isFinite(value) ? value : null;
}

/**
 * Suma unei livrări din lista Bolt Food. OCR-ul pierde uneori virgula
 * („1132 RON” în loc de „11,32 RON”), dar aplicația arată mereu doi bani,
 * deci ultimele două cifre sunt banii. Totalul zilei confirmă rezultatul.
 */
function readLooseMoney(line: string): number | null {
  const match = line.match(/(\d[\d.,\s]*\d|\d)\s*(?:ron|lei)\b/i);
  if (!match) return null;
  const digits = match[1].replace(/\D/g, "");
  if (digits.length < 3) return null;
  return Number(digits) / 100;
}

/** Un număr simplu (km, livrări). OCR-ul citește uneori cifra 0 ca litera O. */
function readNumberBefore(line: string, unit: string): number | null {
  const match = line.match(new RegExp(`(\\d+(?:[.,]\\d+)?|o)\\s*${unit}\\b`, "i"));
  if (!match) return null;
  const raw = match[1].toLowerCase() === "o" ? "0" : match[1].replace(",", ".");
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readTrailingInteger(line: string): number | null {
  const match = line.match(/(\d+|\bo)\s*$/i);
  if (!match) return null;
  return match[1].toLowerCase() === "o" ? 0 : Number(match[1]);
}

/** Cea mai recentă dată care nu e în viitor (anul nu apare mereu pe ecran). */
function resolveYear(day: number, month: number, today: string) {
  const year = Number(today.slice(0, 4));
  const date = isoDate(year, month, day);
  return date > today ? isoDate(year - 1, month, day) : date;
}

function daysBetween(startDate: string, endDate: string) {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
}

function isMonday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

function classifyPeriod(startDate: string, endDate: string): DeliveryPeriod["kind"] {
  if (startDate === endDate) return "day";
  if (isMonday(startDate) && daysBetween(startDate, endDate) <= 6) return "week";
  const [year, month, day] = startDate.split("-").map(Number);
  if (day === 1 && endDate.slice(0, 7) === startDate.slice(0, 7)) return "month";
  if (day === 1 && endDate === isoDate(year, month, lastDayOfMonth(year, month))) return "month";
  return "custom";
}

/** Perioada din antetul Wolt: o zi, un interval, o lună sau „De la / La”. */
function detectWoltPeriod(lines: string[], text: string, today: string): DeliveryPeriod | null {
  const plainLines = lines.map(plain);

  // „Personalizat”: De la lun 03/08/2026, La joi 03/09/2026.
  const from = plainLines.find((line) => /^de la\b/.test(line))?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const to = plainLines.find((line) => /^la\b/.test(line))?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (from && to) {
    const startDate = isoDate(Number(from[3]), Number(from[2]), Number(from[1]));
    const endDate = isoDate(Number(to[3]), Number(to[2]), Number(to[1]));
    return { startDate, endDate, kind: classifyPeriod(startDate, endDate) };
  }

  // „Luna”: doar numele lunii, pe un rând separat („Septembrie”).
  const monthOnly = plainLines.find((line) => new RegExp(`^${MONTH_WORD}$`).test(line.trim()));
  if (monthOnly) {
    const month = MONTHS[monthOnly.trim().slice(0, 3)];
    const startDate = resolveYear(1, month, today);
    const [year] = startDate.split("-").map(Number);
    // Luna curentă se termină azi; cele trecute, în ultima lor zi.
    const fullEnd = isoDate(year, month, lastDayOfMonth(year, month));
    return { startDate, endDate: fullEnd, kind: "month" };
  }

  // „Azi” sau „Săptămâna”: „3 septembrie” sau „31 aug - 3 sep”.
  const detected = detectPeriod(text, today);
  if (!detected) return null;
  const kind = classifyPeriod(detected.startDate, detected.endDate);
  // Săptămâna curentă apare doar până azi; o socotim săptămâna întreagă.
  if (kind === "week") {
    const end = new Date(`${detected.startDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    return { startDate: detected.startDate, endDate: end.toISOString().slice(0, 10), kind };
  }
  return { ...detected, kind };
}

function emptyReading(): DeliveryReading {
  return {
    platform: null,
    screen: null,
    recognized: false,
    values: {},
    deliveries: null,
    period: null,
    days: [],
    needsCheck: [],
    problems: [],
    notes: [],
  };
}

function parseWolt(lines: string[], text: string, today: string): DeliveryReading {
  const reading: DeliveryReading = { ...emptyReading(), platform: "wolt", screen: "wolt_stats", recognized: true };
  let total: number | null = null;
  let withoutTips: number | null = null;
  let tips: number | null = null;

  for (const line of lines) {
    const label = plain(line);
    if (label.includes("livrari finalizate")) {
      reading.deliveries = readTrailingInteger(line);
    } else if (/\bkm\b/.test(label)) {
      const km = readNumberBefore(line, "km");
      if (km !== null) reading.values.kilometers = km;
    } else if (label.includes("fara bacsis")) {
      withoutTips = readMoney(line);
    } else if (label.includes("bacsis")) {
      tips = readMoney(line);
    } else if (label.includes("castiguri")) {
      // „Câștiguri (estimare) —” înseamnă fără câștiguri în perioada aceea.
      total = readMoney(line) ?? (/[-—–]\s*$/.test(line.trim()) ? 0 : null);
    }
  }

  reading.period = detectWoltPeriod(lines, text, today);
  if (total !== null) reading.total = total;

  if (withoutTips !== null && tips !== null) {
    reading.values.appRidePayments = withoutTips;
    reading.values.appTips = tips;
    if (total !== null && !near(roundMoney(withoutTips + tips), total)) {
      reading.needsCheck.push("appRidePayments", "appTips");
      reading.problems.push(
        `Câștigurile fără bacșiș și bacșișul dau ${roundMoney(withoutTips + tips).toFixed(2)}, dar totalul citit este ${total.toFixed(2)}.`,
      );
    }
  } else if (total !== null) {
    reading.values.appRidePayments = total;
    if (total > 0) {
      reading.notes.push("Pe acest ecran Wolt arată doar totalul, cu tot cu bacșiș. Bacșișul separat apare la „Personalizat”.");
    }
  } else {
    reading.needsCheck.push("appRidePayments");
    reading.problems.push("Câștigurile nu au putut fi citite. Introdu-le din aplicație.");
  }

  if (reading.values.kilometers === undefined) {
    reading.needsCheck.push("kilometers");
    reading.problems.push("Distanța nu a putut fi citită.");
  }
  reading.notes.push("Wolt numește suma „estimare”: verifică-o cu plata primită.");
  return reading;
}

function parseBoltFoodList(lines: string[]): DeliveryReading {
  const reading: DeliveryReading = { ...emptyReading(), platform: "bolt_food", screen: "boltfood_list", recognized: true };
  const header = new RegExp(`^(\\d{1,2})\\s*${MONTH_WORD}\\s*(\\d{4})\\b`);
  let current: DeliveryDay | null = null;

  for (const line of lines) {
    const label = plain(line).trim();
    const day = label.match(header);
    if (day) {
      const total = readMoney(line) ?? readLooseMoney(line);
      current = {
        date: isoDate(Number(day[3]), MONTHS[day[2].slice(0, 3)], Number(day[1])),
        total: total ?? 0,
        deliveries: null,
        amounts: [],
      };
      reading.days.push(current);
      continue;
    }
    if (!current) continue;
    const count = label.match(/livrari\s*:\s*(\d+)/);
    if (count) {
      current.deliveries = Number(count[1]);
      continue;
    }
    // „2121RON”: OCR-ul lipește uneori suma de monedă.
    if (/\d\s*(ron|lei)\b/.test(label)) {
      const amount = readLooseMoney(line);
      if (amount !== null) current.amounts.push(amount);
    }
  }

  for (const day of reading.days) {
    const complete = day.deliveries !== null && day.amounts.length === day.deliveries;
    const sum = roundMoney(day.amounts.reduce((total, amount) => total + amount, 0));
    if (complete && !near(sum, day.total)) {
      reading.problems.push(
        `La ${day.date.split("-").reverse().join(".")}, livrările citite dau ${sum.toFixed(2)}, dar totalul zilei este ${day.total.toFixed(2)}. Am folosit totalul zilei; verifică-l.`,
      );
      reading.needsCheck.push("appRidePayments");
    }
  }

  if (reading.days.length === 0) {
    reading.recognized = false;
  }
  reading.notes.push("Bolt Food arată un singur total pe livrare, cu tot cu bacșiș și bonusuri.");
  return reading;
}

function parseBoltFoodPerformance(lines: string[]): DeliveryReading {
  const reading: DeliveryReading = { ...emptyReading(), platform: "bolt_food", screen: "boltfood_performance", recognized: true };
  // Cifrele mari stau deasupra etichetei lor.
  lines.forEach((line, index) => {
    const label = plain(line);
    const previous = index > 0 ? lines[index - 1].trim() : "";
    const value = /^(\d+(?:[.,]\d+)?|o)$/i.test(previous)
      ? Number(previous.toLowerCase() === "o" ? 0 : previous.replace(",", "."))
      : null;
    if (label.includes("livrari finalizate") && value !== null) reading.deliveries = value;
    if (label.includes("distanta parcursa") && value !== null) reading.values.kilometers = value;
  });
  if (reading.values.kilometers === undefined) {
    reading.needsCheck.push("kilometers");
    reading.problems.push("Distanța nu a putut fi citită. Introdu kilometrii din aplicație.");
  }
  reading.notes.push("Ecranul „Performanță” nu are câștigurile: încarcă și lista „Toate livrările”.");
  return reading;
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** „RON 1,234.56” (Glovo scrie moneda înainte și punct la zecimale). */
function readMoneyPrefix(line: string): number | null {
  const match = line.match(/(?:ron|lei)\s*(\d{1,3}(?:[,\s]\d{3})*|\d+)[.,](\d{2})\b/i);
  if (!match) return null;
  const value = Number(`${match[1].replace(/[,\s]/g, "")}.${match[2]}`);
  return Number.isFinite(value) ? value : null;
}

/** „12h 30m”, „45m”, „3h” → ore cu zecimale. OCR-ul citește 0 ca „O”. */
function readDuration(text: string): number | null {
  const cleaned = text.replace(/(?:ron|lei)\s*[\d.,]+/gi, " ");
  const match = cleaned.match(/(?:\b(\d+|o)\s*h)?\s*(?:\b(\d+|o)\s*m)\b|\b(\d+|o)\s*h\b/i);
  if (!match) return null;
  const num = (value: string | undefined) => (!value ? 0 : value.toLowerCase() === "o" ? 0 : Number(value));
  const hours = match[3] !== undefined ? num(match[3]) : num(match[1]);
  const minutes = match[3] !== undefined ? 0 : num(match[2]);
  return roundMoney(hours + minutes / 60);
}

/** „Mon 28 Sep - Sun 4 Oct” + anul pe rândul următor („2026”). */
function detectGlovoPeriod(lines: string[], today: string): DeliveryPeriod | null {
  const month = "(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*";
  const range = new RegExp(`(\\d{1,2})\\s*${month}\\s*[-–—]\\s*(?:[a-z]+\\s*)?(\\d{1,2})\\s*${month}`, "i");
  const year = lines.map((line) => line.trim().match(/^(20\d{2})$/)).find(Boolean);
  for (const line of lines) {
    const match = plain(line).match(range);
    if (!match) continue;
    const startMonth = EN_MONTHS[match[2].slice(0, 3)];
    const endMonth = EN_MONTHS[match[4].slice(0, 3)];
    const endYear = year ? Number(year[1]) : Number(resolveYear(Number(match[3]), endMonth, today).slice(0, 4));
    const startYear = startMonth > endMonth ? endYear - 1 : endYear;
    const startDate = isoDate(startYear, startMonth, Number(match[1]));
    const endDate = isoDate(endYear, endMonth, Number(match[3]));
    return { startDate, endDate, kind: classifyPeriod(startDate, endDate) };
  }
  return null;
}

function parseGlovo(lines: string[], today: string): DeliveryReading {
  const reading: DeliveryReading = { ...emptyReading(), platform: "glovo", screen: "glovo_payments", recognized: true };
  let average: number | null = null;

  lines.forEach((line, index) => {
    const label = plain(line);
    const next = lines[index + 1] ?? "";
    if (label.includes("total income")) {
      const total = readMoneyPrefix(line) ?? readMoneyPrefix(next);
      if (total !== null) {
        reading.total = total;
        reading.values.appRidePayments = total;
      }
    }
    if (label.includes("average per hour")) average = readMoneyPrefix(line) ?? readMoneyPrefix(next);
    if (label.includes("hours online")) {
      const hours = readDuration(line.replace(/hours online/i, "")) ?? readDuration(next);
      if (hours !== null) reading.hoursOnline = hours;
    }
    const completed = label.match(/(\d+|\bo)\s*completed/);
    if (completed) reading.deliveries = completed[1] === "o" ? 0 : Number(completed[1]);
    const cancelled = label.match(/(\d+|\bo)\s*cancel+ed/);
    if (cancelled) reading.cancelledDeliveries = cancelled[1] === "o" ? 0 : Number(cancelled[1]);
  });

  reading.period = detectGlovoPeriod(lines, today);

  if (reading.values.appRidePayments === undefined) {
    reading.needsCheck.push("appRidePayments");
    reading.problems.push("Venitul total nu a putut fi citit. Introdu-l din aplicație.");
  } else if (average !== null && reading.hoursOnline && reading.hoursOnline > 0) {
    // Glovo arată și media pe oră: venitul ÷ orele online trebuie să dea media.
    const computed = roundMoney(reading.values.appRidePayments / reading.hoursOnline);
    if (Math.abs(computed - average) > 0.02) {
      reading.needsCheck.push("appRidePayments", "hoursOnline");
      reading.problems.push(
        `Venitul împărțit la orele online dă ${computed.toFixed(2)} pe oră, dar media citită este ${(average as number).toFixed(2)}.`,
      );
    }
  }
  return reading;
}

/** Recunoaște ecranul și îl citește cu cititorul aplicației potrivite. */
export function parseDeliveryScreenshot(text: string, today: string): DeliveryReading {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const all = plain(text);

  if (all.includes("total income") || (all.includes("hours online") && all.includes("completed"))) {
    return parseGlovo(lines, today);
  }
  if (all.includes("statisticile tale") || all.includes("castiguri (estimare)") || all.includes("in afara")) {
    return parseWolt(lines, text, today);
  }
  if (all.includes("toate livrarile") || new RegExp(`\\d{1,2}\\s*${MONTH_WORD}\\s*\\d{4}`).test(all)) {
    return parseBoltFoodList(lines);
  }
  if (all.includes("performanta") && all.includes("livrari finalizate")) {
    return parseBoltFoodPerformance(lines);
  }
  return emptyReading();
}

/** Zilele din lista Bolt Food care cad în perioada formularului. */
export function daysInPeriod(reading: DeliveryReading, startDate: string, endDate: string) {
  return reading.days.filter((day) => day.date >= startDate && day.date <= endDate);
}

/**
 * Rubricile de pus în formular. Ce nu apare în captură rămâne cum era, iar
 * rubricile citite le înlocuiesc pe cele vechi.
 */
export function entryFromDeliveryReading(
  current: PlatformEntryInput,
  reading: DeliveryReading,
  options: { startDate: string; endDate: string; includeKilometers: boolean },
): PlatformEntryInput {
  const next: PlatformEntryInput = { ...current };

  if (reading.screen === "boltfood_list") {
    const days = daysInPeriod(reading, options.startDate, options.endDate);
    next.appRidePayments = roundMoney(days.reduce((total, day) => total + day.total, 0));
    const counted = days.filter((day) => day.deliveries !== null);
    if (counted.length === days.length) {
      next.deliveries = counted.reduce((total, day) => total + (day.deliveries ?? 0), 0);
    }
    return next;
  }

  if (reading.deliveries !== null) next.deliveries = reading.deliveries;
  if (reading.cancelledDeliveries !== undefined) next.cancelledDeliveries = reading.cancelledDeliveries;
  if (reading.hoursOnline !== undefined) next.hoursOnline = reading.hoursOnline;

  if (reading.values.appRidePayments !== undefined) next.appRidePayments = reading.values.appRidePayments;
  if (reading.values.appTips !== undefined) next.appTips = reading.values.appTips;
  if (options.includeKilometers && reading.values.kilometers !== undefined) {
    next.kilometers = reading.values.kilometers;
  }
  return next;
}

export type CaptureTarget = "day" | "week" | "month";

const TARGET_NAMES: Record<CaptureTarget, string> = { day: "o zi", week: "o săptămână", month: "o lună" };

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function describe(period: { startDate: string; endDate: string }) {
  return period.startDate === period.endDate
    ? shortDate(period.startDate)
    : `${shortDate(period.startDate)} – ${shortDate(period.endDate)}`;
}

/**
 * Unde merge captura, ca la ridesharing: utilizatorul spune ce vrea să
 * calculeze (o zi, o săptămână, o lună), aplicația citește perioada din
 * captură, iar valorile ajung la perioada potrivită, chiar dacă formularul
 * deschis era altul. Perioada scrisă în captură are întâietate.
 */
export function planDeliveryCapture(
  reading: DeliveryReading,
  chosen: CaptureTarget,
  form: { type: CaptureTarget; startDate: string; endDate: string },
  platform: DeliveryPlatform,
  platformLabel: string,
): { type: "error"; message: string } | { type: "target"; period: CaptureTarget; anchorDate: string; notes: string[] } {
  if (!reading.recognized) {
    return {
      type: "error",
      message: platform === "wolt"
        ? "Nu am recunoscut ecranul. Încarcă „Statisticile tale” din Wolt."
        : platform === "bolt_food"
          ? "Nu am recunoscut ecranul. Încarcă „Toate livrările” sau „Performanță” din Bolt Food."
          : platform === "glovo"
            ? "Nu am recunoscut ecranul. Încarcă „Payments” din Glovo."
          : `Nu am recunoscut ecranul din ${platformLabel}.`,
    };
  }
  if (reading.platform && reading.platform !== platform) {
    return { type: "error", message: `Captura pare din altă aplicație, iar rubricile sunt pentru ${platformLabel}.` };
  }

  if (reading.screen === "boltfood_list") {
    const dates = reading.days.map((day) => day.date);
    const inForm = (date: string) => date >= form.startDate && date <= form.endDate;
    if (chosen === "day") {
      const date = form.type === "day" && dates.includes(form.startDate) ? form.startDate : dates[0];
      const notes = dates.length > 1
        ? [`Captura are zilele ${dates.map(shortDate).join(", ")}; am folosit ${shortDate(date)}. Pentru altă zi, deschide-o și încarcă din nou captura.`]
        : [];
      return { type: "target", period: "day", anchorDate: date, notes };
    }
    const anchorDate = form.type === chosen && dates.some(inForm) ? form.startDate : dates[0];
    return { type: "target", period: chosen, anchorDate, notes: [] };
  }

  const { period } = reading;
  if (!period) {
    return {
      type: "target",
      period: chosen,
      anchorDate: form.startDate,
      notes: reading.screen === "boltfood_performance"
        ? []
        : ["Nu am găsit perioada în captură: am pus valorile la perioada deschisă. Verifică dacă e cea corectă."],
    };
  }
  if (period.kind === "custom") {
    return {
      type: "target",
      period: chosen,
      anchorDate: period.startDate,
      notes: [`Captura este pe o perioadă personalizată (${describe(period)}); am pus valorile la ${TARGET_NAMES[chosen]} care începe pe ${shortDate(period.startDate)}. Verifică perioada.`],
    };
  }
  return {
    type: "target",
    period: period.kind,
    anchorDate: period.startDate,
    notes: period.kind === chosen
      ? []
      : [`Ai ales ${TARGET_NAMES[chosen]}, dar captura este pentru ${TARGET_NAMES[period.kind]} (${describe(period)}); am pus valorile acolo.`],
  };
}

/** Completează rubricile pentru perioada formularului și explică ce a făcut. */
export function fillFromDelivery(
  current: PlatformEntryInput,
  reading: DeliveryReading,
  range: { startDate: string; endDate: string },
  includeKilometers: boolean,
): { entry: PlatformEntryInput; notes: string[] } {
  const notes: string[] = [];
  if (reading.screen === "boltfood_list" && range.startDate !== range.endDate) {
    const days = daysInPeriod(reading, range.startDate, range.endDate);
    notes.push(`Am adunat ${days.length} ${days.length === 1 ? "zi" : "zile"} din captură: ${days.map((day) => shortDate(day.date)).join(", ")}. Dacă lipsesc zile, derulează lista și încarcă și restul.`);
  }
  return {
    entry: entryFromDeliveryReading(current, reading, { ...range, includeKilometers }),
    notes,
  };
}
