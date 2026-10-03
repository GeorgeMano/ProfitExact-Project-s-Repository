"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { DecimalInput } from "./decimal-input";
import {
  isDeliveryPlatform,
  type DeliveryPlatform,
  platformEntryTotals,
  type PlatformEntryInput,
} from "@/lib/finance/platform-entry";
import {
  fillFromDelivery,
  planDeliveryCapture,
  type DeliveryField,
  type DeliveryReading,
} from "@/lib/ocr/delivery-screenshot";
import { getPeriodBounds } from "@/lib/finance/weekly-summary";
import {
  entryFromReading,
  type ScreenshotField,
  type ScreenshotReading,
} from "@/lib/ocr/earnings-screenshot";

/**
 * Încasările unei platforme, așezate exact ca ecranul „Defalcarea
 * câștigurilor” din aplicația șoferului: aceleași grupe, aceleași rânduri,
 * aceleași totaluri. Șoferul copiază rând cu rând, iar totalurile, câștigul
 * net și numerarul în mână se calculează singure, ca să le poată compara cu
 * ce vede în aplicație.
 */

type Update = <Key extends keyof PlatformEntryInput>(
  key: Key,
  value: PlatformEntryInput[Key],
) => void;

function money(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AmountRow({
  label,
  note,
  ariaLabel,
  value,
  onChange,
  sign = "+",
  suffix = "RON",
  required = false,
  emphasis = false,
  flagged = false,
}: {
  label: string;
  /** Precizare scurtă sub etichetă, de exemplu unde ajung banii. */
  note?: string;
  ariaLabel: string;
  value: number | null;
  onChange: (value: number | null) => void;
  sign?: "+" | "−" | "";
  suffix?: string;
  required?: boolean;
  emphasis?: boolean;
  /** Citită din captură, dar totalurile nu se verifică: de controlat. */
  flagged?: boolean;
}) {
  return (
    <div className={`earnings-row ${emphasis ? "emphasis" : ""} ${flagged ? "needs-check" : ""}`}>
      <span className="earnings-label">
        {label}
        {note ? <small className="earnings-note">{note}</small> : null}
      </span>
      <span className="earnings-leader" aria-hidden="true" />
      <span className={`earnings-input ${required && value === null ? "missing" : ""}`}>
        {sign ? <em aria-hidden="true">{sign}</em> : null}
        <DecimalInput
          aria-label={ariaLabel}
          required={required}
          placeholder={required ? "din aplicație" : "0,00"}
          value={value}
          emptyWhenZero={!required}
          onChange={onChange}
        />
        <small>{suffix}</small>
      </span>
    </div>
  );
}

/**
 * Textul exact scos de OCR din imagine, cu tot cu greșelile lui. Arată că
 * rubricile vin din captura încărcată, nu din altă parte.
 */
function RawOcrText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  return (
    <details className="ocr-raw">
      <summary>Vezi textul citit din captură</summary>
      <pre>{text.trim()}</pre>
    </details>
  );
}

function GroupHead({ title, total }: { title: string; total?: number }) {
  return (
    <div className="earnings-head">
      <span>{title}</span>
      {total !== undefined ? <strong>+{money(total)} RON</strong> : null}
    </div>
  );
}

export type CapturePeriod = "day" | "week" | "month";

/** Perioada pentru care e deschis formularul în care se încarcă captura. */
export interface FormPeriod {
  type: CapturePeriod;
  startDate: string;
  endDate: string;
}

type ImportState =
  | { status: "idle" }
  | { status: "choosing" }
  | { status: "working"; stage: "loading" | "reading"; percent: number }
  | { status: "done"; problems: string[]; note?: string }
  | { status: "error"; message: string; suggestWeek?: ScreenshotReading };

const PERIOD_CHOICES: { key: CapturePeriod; label: string }[] = [
  { key: "day", label: "O zi" },
  { key: "week", label: "O săptămână întreagă" },
  { key: "month", label: "O lună întreagă" },
];

function shortDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function describePeriod(period: { startDate: string; endDate: string }) {
  return period.startDate === period.endDate
    ? shortDate(period.startDate)
    : `${shortDate(period.startDate)} – ${shortDate(period.endDate)}`;
}

/**
 * Completarea rubricilor din captura „Defalcarea câștigurilor”. Textul se
 * citește pe telefon, rubricile se completează, iar utilizatorul verifică
 * și salvează. Nimic nu se salvează fără el.
 *
 * Din formularul zilei, întâi se întreabă pentru ce perioadă e captura: o zi,
 * o săptămână sau o lună. Pentru săptămână și lună, utilizatorul e mutat în
 * formularul potrivit, cu rubricile deja completate.
 */
function ScreenshotImport({
  platformLabel,
  state,
  askPeriod,
  onAsk,
  onCancelAsk,
  onFile,
  onUseForWeek,
  rawText,
}: {
  rawText?: string | null;
  platformLabel: string;
  state: ImportState;
  askPeriod: boolean;
  onAsk: () => void;
  onCancelAsk: () => void;
  onFile: (file: File, period: CapturePeriod | null) => void;
  onUseForWeek?: (reading: ScreenshotReading) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const periodRef = useRef<CapturePeriod | null>(null);
  const working = state.status === "working";

  const openPicker = (period: CapturePeriod | null) => {
    periodRef.current = period;
    inputRef.current?.click();
  };

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Aceeași imagine aleasă din nou trebuie să pornească o nouă citire.
    event.target.value = "";
    if (file) onFile(file, periodRef.current);
  };

  return (
    <div className={`screenshot-import ${state.status}`}>
      <div className="screenshot-import-head">
        <div>
          <strong>Completează din captură</strong>
          <span>Încarcă captura „Defalcarea câștigurilor” din {platformLabel}. Imaginea rămâne pe telefonul tău.</span>
        </div>
        <button type="button" className="screenshot-import-button" onClick={() => (askPeriod ? onAsk() : openPicker(null))} disabled={working}>
          {working ? "Se citește..." : "Încarcă captura"}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          aria-label={`Captură ${platformLabel}`}
          onChange={pick}
        />
      </div>
      {state.status === "choosing" ? (
        <div className="capture-period-choice" role="group" aria-label="Pentru ce perioadă este captura?">
          <p>Ce dorești să calculezi? Pentru ce perioadă este captura?</p>
          <div>
            {PERIOD_CHOICES.map((choice) => (
              <button type="button" key={choice.key} onClick={() => openPicker(choice.key)}>{choice.label}</button>
            ))}
            <button type="button" className="capture-cancel" onClick={onCancelAsk}>Renunță</button>
          </div>
        </div>
      ) : null}
      {state.status === "working" ? (
        <p className="screenshot-import-status" role="status">
          {state.stage === "loading"
            ? "Pregătesc cititorul (doar prima dată durează câteva secunde)..."
            : `Citesc cifrele din captură... ${state.percent}%`}
        </p>
      ) : null}
      {state.status === "done" && state.problems.length === 0 ? (
        <p className="screenshot-import-status ok" role="status">
          Am completat rubricile din captură și totalurile se potrivesc cu aplicația. Verifică-le o dată, apoi salvează.
          {state.note ? <><br /><strong>{state.note}</strong></> : null}
        </p>
      ) : null}
      {state.status === "done" && state.problems.length > 0 ? (
        <div className="screenshot-import-status warn" role="alert">
          <p>Am completat ce am putut citi. Verifică rubricile marcate cu galben:</p>
          <ul>{state.problems.map((problem) => <li key={problem}>{problem}</li>)}{state.note ? <li>{state.note}</li> : null}</ul>
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="screenshot-import-status warn" role="alert">
          <p>{state.message}</p>
          {state.suggestWeek && onUseForWeek ? (
            <button type="button" className="capture-switch" onClick={() => onUseForWeek(state.suggestWeek!)}>Folosește captura pentru toată săptămâna</button>
          ) : null}
        </div>
      ) : null}
      {state.status === "done" || state.status === "error" ? <RawOcrText text={rawText} /> : null}
    </div>
  );
}

/** O captură de delivery citită în alt formular și adusă aici, deja aplicată. */
export interface InitialDelivery {
  reading: DeliveryReading;
  notes: string[];
}

type EarningsFieldsProps = Parameters<typeof RidesharingEarningsFields>[0] & {
  initialDelivery?: InitialDelivery | null;
  /** Captura de delivery este pentru altă perioadă decât formularul deschis. */
  onDeliveryOtherPeriod?: (period: CapturePeriod, anchorDate: string, reading: DeliveryReading, notes: string[]) => void;
};

/** Formularul potrivit aplicației: Bolt/Uber sau o aplicație de livrări. */
export function PlatformEarningsFields(props: EarningsFieldsProps) {
  return isDeliveryPlatform(props.entry.platform) ? (
    <DeliveryEarningsFields {...props} />
  ) : (
    <RidesharingEarningsFields {...props} />
  );
}

/**
 * Încasările dintr-o aplicație de livrări, așezate ca ecranul aplicației:
 * aceleași rubrici, în aceeași ordine (regula lui George). Aplicațiile de
 * livrări nu iau comision de la curier.
 *
 *   Wolt („Statisticile tale”): Livrări finalizate → Distanța parcursă →
 *     Câștiguri (estimare) → Câștiguri fără bacșiș → Bacșiș.
 *   Bolt Food: „Performanță” (Livrări finalizate → Distanță parcursă), apoi
 *     totalul din „Toate livrările”.
 *   Glovo: provizoriu, până vedem ecranul aplicației.
 */
function DeliveryEarningsFields({
  entry,
  platformLabel,
  showKilometers,
  kilometersEstimated = false,
  formPeriod,
  onChange,
  onReplace,
  ownBusiness = false,
  initialDelivery = null,
  onDeliveryOtherPeriod,
}: EarningsFieldsProps) {
  const totals = platformEntryTotals(entry);
  const [importState, setImportState] = useState<DeliveryImportState>(() =>
    initialDelivery
      ? { status: "done", problems: initialDelivery.reading.problems, notes: [...initialDelivery.notes, ...initialDelivery.reading.notes] }
      : { status: "idle" },
  );
  const [flagged, setFlagged] = useState<ReadonlySet<DeliveryField>>(
    () => new Set(initialDelivery?.reading.needsCheck ?? []),
  );
  const [rawText, setRawText] = useState<string | null>(initialDelivery?.reading.rawText ?? null);
  const isFlagged = (field: DeliveryField) => flagged.has(field);
  const amount =
    (key: "appRidePayments" | "appTips" | "cashTips" | "kilometers" | "deliveries" | "cancelledDeliveries" | "hoursOnline") =>
    (value: number | null) => {
      if (key === "appRidePayments" || key === "appTips" || key === "kilometers" || key === "hoursOnline") {
        setFlagged((current) => {
          if (!current.has(key)) return current;
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      }
      onChange(key, value ?? 0);
    };
  // Wolt și Bolt Food măsoară distanța ele însele: nu e o estimare.
  const kmLabel = (base: string) =>
    kilometersEstimated && entry.platform === "glovo" ? `${base} (estimativ)` : base;

  const importScreenshot = async (file: File, chosen: CapturePeriod) => {
    setImportState({ status: "working", stage: "loading", percent: 0 });
    try {
      const { readDeliveryScreenshot } = await import("@/lib/ocr/read-screenshot");
      const reading = await readDeliveryScreenshot(file, (stage, percent) =>
        setImportState({ status: "working", stage, percent }),
      );
      setRawText(reading.rawText ?? null);
      const form = formPeriod ?? { type: "day" as const, startDate: todayIso(), endDate: todayIso() };
      const plan = planDeliveryCapture(reading, chosen, form, entry.platform as DeliveryPlatform, platformLabel);
      if (plan.type === "error") {
        setFlagged(new Set());
        setImportState({ status: "error", message: plan.message });
        return;
      }
      const targetStart = plan.period === "day" ? plan.anchorDate : getPeriodBounds(plan.anchorDate, plan.period).startDate;
      if ((plan.period !== form.type || targetStart !== form.startDate) && onDeliveryOtherPeriod) {
        // Ca la ridesharing: se deschide perioada din captură, cu rubricile completate.
        setImportState({ status: "idle" });
        onDeliveryOtherPeriod(plan.period, plan.anchorDate, reading, plan.notes);
        return;
      }
      const filled = fillFromDelivery(entry, reading, form, showKilometers);
      onReplace(filled.entry);
      setFlagged(new Set(reading.needsCheck));
      setImportState({ status: "done", problems: reading.problems, notes: [...plan.notes, ...filled.notes, ...reading.notes] });
    } catch {
      setImportState({
        status: "error",
        message: "Captura nu a putut fi citită. Verifică conexiunea la internet la prima folosire, apoi încearcă din nou.",
      });
    }
  };

  const deliveriesRow = (
    <AmountRow sign="" suffix="" label="Livrări finalizate" ariaLabel="Livrări finalizate" value={entry.deliveries ?? 0} onChange={amount("deliveries")} />
  );
  const kilometersRow = showKilometers ? (
    <AmountRow sign="" suffix="km" label={kmLabel(entry.platform === "wolt" ? "Distanța parcursă" : "Distanță parcursă")} note={entry.platform === "wolt" ? "În timpul comenzii și în afara acesteia" : undefined} ariaLabel="Kilometri parcurși" value={entry.kilometers} onChange={amount("kilometers")} flagged={isFlagged("kilometers")} />
  ) : null;
  const flotaPill = (
    <div className="earnings-split">
      <div className="earnings-cash-pill card">
        <span>{ownBusiness ? "Bani în contul firmei" : "Bani prin flotă"}<small>{ownBusiness ? "plătiți de aplicație" : "aplicația plătește flota, flota te plătește pe tine"}</small></span>
        <strong>+{money(totals.netEarnings)} RON</strong>
      </div>
    </div>
  );
  const outside = (
    <section className="earnings-group earnings-outside" aria-label="În afara aplicației">
      <GroupHead title="În afara aplicației" />
      <div className="earnings-rows">
        <AmountRow label="Bacșiș numerar" ariaLabel="Bacșiș numerar" value={entry.cashTips} onChange={amount("cashTips")} />
      </div>
    </section>
  );
  const importBox = (
    <DeliveryScreenshotImport platform={entry.platform} platformLabel={platformLabel} state={importState} onAsk={() => setImportState({ status: "choosing" })} onCancelAsk={() => setImportState({ status: "idle" })} onFile={(file, period) => void importScreenshot(file, period)} rawText={rawText} />
  );

  if (entry.platform === "wolt") {
    return (
      <div className="earnings-sheet">
        {importBox}
        <section className="earnings-group" aria-label="Statisticile tale">
          <GroupHead title="Statisticile tale" />
          <div className="earnings-rows">
            {deliveriesRow}
            {kilometersRow}
          </div>
        </section>
        <div className="earnings-total">
          <span>Câștiguri (estimare)</span>
          <strong>{money(totals.netEarnings)} RON</strong>
        </div>
        <div className="earnings-group earnings-flat">
          <AmountRow label="Câștiguri fără bacșiș" ariaLabel="Câștiguri fără bacșiș" value={entry.appRidePayments} onChange={amount("appRidePayments")} flagged={isFlagged("appRidePayments")} />
          <AmountRow label="Bacșiș" ariaLabel="Bacșiș în aplicație" value={entry.appTips} onChange={amount("appTips")} flagged={isFlagged("appTips")} />
        </div>
        {flotaPill}
        {outside}
      </div>
    );
  }

  if (entry.platform === "bolt_food") {
    return (
      <div className="earnings-sheet">
        {importBox}
        <section className="earnings-group" aria-label="Performanță">
          <GroupHead title="Performanță" />
          <div className="earnings-rows">
            {deliveriesRow}
            {kilometersRow}
          </div>
        </section>
        <section className="earnings-group" aria-label="Toate livrările">
          <GroupHead title="Toate livrările" />
          <div className="earnings-rows">
            <AmountRow label="Câștiguri" note="Totalul din „Toate livrările”, cu tot cu bacșiș" ariaLabel="Câștig din livrări" value={entry.appRidePayments} onChange={amount("appRidePayments")} flagged={isFlagged("appRidePayments")} />
          </div>
        </section>
        {flotaPill}
        {outside}
      </div>
    );
  }

  // Glovo — ecranul „Payments”: venitul total, media pe oră, orele online,
  // apoi livrările finalizate și anulate. Distanța nu apare acolo.
  const hoursOnline = entry.hoursOnline ?? 0;
  return (
    <div className="earnings-sheet">
      {importBox}
      <section className="earnings-group" aria-label="Payments">
        <GroupHead title="Payments" />
        <div className="earnings-rows">
          <AmountRow label="Venit total" note="Total income" ariaLabel="Venit total" value={entry.appRidePayments} onChange={amount("appRidePayments")} flagged={isFlagged("appRidePayments")} />
          <div className="earnings-row readonly-row">
            <span className="earnings-label">Medie pe oră<small className="earnings-note">Average per hour, calculată</small></span>
            <span className="earnings-leader" aria-hidden="true" />
            <strong className="earnings-computed">{hoursOnline > 0 ? `${money(entry.appRidePayments / hoursOnline)} RON` : "—"}</strong>
          </div>
          <AmountRow sign="" suffix="ore" label="Ore online" note="Hours online" ariaLabel="Ore online" value={hoursOnline} onChange={amount("hoursOnline")} flagged={isFlagged("hoursOnline")} />
          <AmountRow sign="" suffix="" label="Livrări finalizate" note="Completed" ariaLabel="Livrări finalizate" value={entry.deliveries ?? 0} onChange={amount("deliveries")} />
          <AmountRow sign="" suffix="" label="Livrări anulate" note="Cancelled" ariaLabel="Livrări anulate" value={entry.cancelledDeliveries ?? 0} onChange={amount("cancelledDeliveries")} />
        </div>
      </section>
      {kilometersRow ? <div className="earnings-group earnings-flat">{kilometersRow}</div> : null}
      {flotaPill}
      {outside}
    </div>
  );
}

type DeliveryImportState =
  | { status: "idle" }
  | { status: "choosing" }
  | { status: "working"; stage: "loading" | "reading"; percent: number }
  | { status: "done"; problems: string[]; notes: string[] }
  | { status: "error"; message: string };

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function DeliveryScreenshotImport({
  platform,
  platformLabel,
  state,
  onAsk,
  onCancelAsk,
  onFile,
  rawText,
}: {
  rawText?: string | null;
  platform: PlatformEntryInput["platform"];
  platformLabel: string;
  state: DeliveryImportState;
  onAsk: () => void;
  onCancelAsk: () => void;
  onFile: (file: File, period: CapturePeriod) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const periodRef = useRef<CapturePeriod>("day");
  const working = state.status === "working";
  const openPicker = (period: CapturePeriod) => {
    periodRef.current = period;
    inputRef.current?.click();
  };
  const screens = platform === "wolt" ? "„Statisticile tale”" : platform === "glovo" ? "„Payments”" : "„Toate livrările” sau „Performanță”";

  return (
    <div className={`screenshot-import ${state.status}`}>
      <div className="screenshot-import-head">
        <div>
          <strong>Completează din captură</strong>
          <span>Încarcă {screens} din {platformLabel}. Imaginea rămâne pe telefonul tău.</span>
        </div>
        <button type="button" className="screenshot-import-button" onClick={onAsk} disabled={working}>
          {working ? "Se citește..." : "Încarcă captura"}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept="image/*"
          aria-label={`Captură ${platformLabel}`}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file, periodRef.current);
          }}
        />
      </div>
      {state.status === "choosing" ? (
        <div className="capture-period-choice" role="group" aria-label="Pentru ce perioadă este captura?">
          <p>Ce dorești să calculezi? Pentru ce perioadă este captura?</p>
          <div>
            {PERIOD_CHOICES.map((choice) => (
              <button type="button" key={choice.key} onClick={() => openPicker(choice.key)}>{choice.label}</button>
            ))}
            <button type="button" className="capture-cancel" onClick={onCancelAsk}>Renunță</button>
          </div>
        </div>
      ) : null}
      {state.status === "working" ? (
        <p className="screenshot-import-status" role="status">
          {state.stage === "loading" ? "Pregătesc cititorul (doar prima dată durează câteva secunde)..." : `Citesc cifrele din captură... ${state.percent}%`}
        </p>
      ) : null}
      {state.status === "done" && state.problems.length === 0 ? (
        <div className="screenshot-import-status ok" role="status">
          <p>Am completat rubricile din captură. Verifică-le o dată, apoi salvează.</p>
          {state.notes.length ? <ul>{state.notes.map((note) => <li key={note}>{note}</li>)}</ul> : null}
        </div>
      ) : null}
      {state.status === "done" && state.problems.length > 0 ? (
        <div className="screenshot-import-status warn" role="alert">
          <p>Am completat ce am putut citi. Verifică rubricile marcate cu galben:</p>
          <ul>{[...state.problems, ...state.notes].map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      ) : null}
      {state.status === "error" ? (
        <div className="screenshot-import-status warn" role="alert"><p>{state.message}</p></div>
      ) : null}
      {state.status === "done" || state.status === "error" ? <RawOcrText text={rawText} /> : null}
    </div>
  );
}

function RidesharingEarningsFields({
  entry,
  platformLabel,
  showKilometers,
  kilometersEstimated = false,
  formPeriod,
  initialReading = null,
  onOtherPeriod,
  onChange,
  onReplace,
  ownBusiness = false,
}: {
  /** Propria firmă: banii de pe card intră în contul firmei, nu la flotă. */
  ownBusiness?: boolean;
  entry: PlatformEntryInput;
  platformLabel: string;
  showKilometers: boolean;
  /** Pe săptămână sau lună kilometrii sunt o estimare din kilometrajul mașinii. */
  kilometersEstimated?: boolean;
  /** Perioada formularului; captura e comparată cu ea. */
  formPeriod?: FormPeriod;
  /** Captura citită în alt formular și adusă aici, deja aplicată rubricilor. */
  initialReading?: ScreenshotReading | null;
  /**
   * Captura e pentru altă perioadă decât formularul: săptămână sau lună din
   * formularul zilei, ori altă săptămână decât cea deschisă.
   */
  onOtherPeriod?: (period: Exclude<CapturePeriod, "day">, reading: ScreenshotReading) => void;
  onChange: Update;
  /** Înlocuiește toate rubricile odată, după citirea unei capturi. */
  onReplace: (entry: PlatformEntryInput) => void;
}) {
  const totals = platformEntryTotals(entry);
  // Ce nu a rămas fizic la șofer ajunge la flotă: câștigurile − numerarul.
  const cardMoney = Math.round((totals.netEarnings - totals.cashInHand) * 100) / 100;
  const [importState, setImportState] = useState<ImportState>(() =>
    initialReading
      ? {
          status: "done",
          problems: initialReading.problems,
          note: initialReading.period
            ? `Perioada din captură: ${describePeriod(initialReading.period)}.`
            : undefined,
        }
      : { status: "idle" },
  );
  const [flagged, setFlagged] = useState<ReadonlySet<ScreenshotField>>(
    () => new Set(initialReading?.needsCheck ?? []),
  );
  const [rawText, setRawText] = useState<string | null>(initialReading?.rawText ?? null);
  const askPeriod = formPeriod?.type === "day" && Boolean(onOtherPeriod);

  const unflag = (key: keyof PlatformEntryInput) => {
    if (!flagged.has(key as ScreenshotField)) return;
    const next = new Set(flagged);
    next.delete(key as ScreenshotField);
    setFlagged(next);
  };
  const amount = (key: keyof PlatformEntryInput) => (value: number | null) => {
    unflag(key);
    onChange(key, (value ?? 0) as never);
  };
  const isFlagged = (key: ScreenshotField) => flagged.has(key);

  const fill = (reading: ScreenshotReading, note?: string) => {
    onReplace(entryFromReading(entry, reading));
    setFlagged(new Set(reading.needsCheck));
    setImportState({ status: "done", problems: reading.problems, note });
  };

  const importScreenshot = async (file: File, chosen: CapturePeriod | null) => {
    setImportState({ status: "working", stage: "loading", percent: 0 });
    try {
      // Cititorul se încarcă abia acum, ca restul aplicației să rămână rapid.
      const { readEarningsScreenshot } = await import("@/lib/ocr/read-screenshot");
      const reading = await readEarningsScreenshot(file, (stage, percent) =>
        setImportState({ status: "working", stage, percent }),
      );
      setRawText(reading.rawText ?? null);

      if (!reading.recognized) {
        setFlagged(new Set());
        setImportState({
          status: "error",
          message: `Nu am găsit în imagine ecranul „Defalcarea câștigurilor” din ${platformLabel}. Încearcă o captură de ecran clară sau completează manual.`,
        });
        return;
      }

      const period = chosen ?? formPeriod?.type ?? "day";
      const detected = reading.period;
      const detectedIsDay = detected !== null && detected.startDate === detected.endDate;

      if (period === "day") {
        if (detected && !detectedIsDay) {
          setFlagged(new Set());
          setImportState({
            status: "error",
            message: `Captura pare să fie pentru ${describePeriod(detected)}, nu pentru o singură zi.`,
            suggestWeek: onOtherPeriod ? reading : undefined,
          });
          return;
        }
        const otherDay =
          detected && formPeriod && detected.startDate !== formPeriod.startDate
            ? `Atenție: captura pare din ${shortDate(detected.startDate)}, iar formularul este pentru ${shortDate(formPeriod.startDate)}. Verifică data activității.`
            : undefined;
        fill(reading, otherDay);
        return;
      }

      if (detectedIsDay) {
        setFlagged(new Set());
        setImportState({
          status: "error",
          message: `Captura pare să fie pentru o singură zi (${describePeriod(detected!)}). Pentru o zi, folosește formularul „Zilnic”.`,
        });
        return;
      }

      // Din formularul zilei sau din altă săptămână: se mută formularul pe
      // perioada din captură, cu rubricile completate acolo.
      const samePeriod =
        formPeriod?.type === period &&
        (!detected ||
          (detected.startDate >= formPeriod.startDate && detected.startDate <= formPeriod.endDate));
      if (!samePeriod && onOtherPeriod) {
        setImportState({ status: "idle" });
        onOtherPeriod(period, reading);
        return;
      }

      fill(reading, detected ? `Perioada din captură: ${describePeriod(detected)}.` : undefined);
    } catch {
      setImportState({
        status: "error",
        message: "Captura nu a putut fi citită. Verifică conexiunea la internet la prima folosire, apoi încearcă din nou.",
      });
    }
  };

  return (
    <div className="earnings-sheet">
      <ScreenshotImport
        platformLabel={platformLabel}
        state={importState}
        askPeriod={askPeriod}
        onAsk={() => setImportState({ status: "choosing" })}
        onCancelAsk={() => setImportState({ status: "idle" })}
        onFile={(file, period) => void importScreenshot(file, period)}
        onUseForWeek={onOtherPeriod ? (reading) => onOtherPeriod("week", reading) : undefined}
        rawText={rawText}
      />
      <section className="earnings-group" aria-label="Venituri în aplicație">
        <GroupHead title="Venituri în aplicație" total={totals.appRevenue} />
        <div className="earnings-rows">
          <AmountRow label="Plăți pentru curse" ariaLabel="Plăți pentru curse în aplicație" value={entry.appRidePayments} onChange={amount("appRidePayments")} flagged={isFlagged("appRidePayments")} />
          <AmountRow label="Campanii" ariaLabel="Campanii" value={entry.campaigns} onChange={amount("campaigns")} flagged={isFlagged("campaigns")} />
          <AmountRow label="Taxe de anulare" ariaLabel="Taxe de anulare" value={entry.cancellationFees} onChange={amount("cancellationFees")} flagged={isFlagged("cancellationFees")} />
          <AmountRow label="Bacșiș" ariaLabel="Bacșiș în aplicație" value={entry.appTips} onChange={amount("appTips")} flagged={isFlagged("appTips")} />
        </div>
      </section>

      <section className="earnings-group" aria-label="Venituri în numerar">
        <GroupHead title="Venituri în numerar" total={totals.cashRevenue} />
        <div className="earnings-rows">
          <AmountRow label="Plăți pentru curse" note="Cash primit în mașină de la clienți" ariaLabel="Plăți pentru curse în numerar" value={entry.cashRidePayments} onChange={amount("cashRidePayments")} flagged={isFlagged("cashRidePayments")} />
          <AmountRow label="Credite și promoții pentru utilizatori" note={ownBusiness ? "Nu sunt bani în mână: se socotesc la card și intră în contul firmei" : "Nu sunt bani în mână: se socotesc la card și ajung la flotă"} ariaLabel="Credite și promoții pentru utilizatori" value={entry.userCredits} onChange={amount("userCredits")} flagged={isFlagged("userCredits")} />
        </div>
      </section>

      <div className="earnings-group earnings-flat">
        <AmountRow emphasis label="Costuri și taxe" ariaLabel="Costuri și taxe" sign="−" value={entry.platformCosts} onChange={amount("platformCosts")} flagged={isFlagged("platformCosts")} />
        <AmountRow emphasis required label={`Comision ${platformLabel}`} ariaLabel={`Comision ${platformLabel}`} sign="−" value={entry.applicationCommission} onChange={(value) => { unflag("applicationCommission"); onChange("applicationCommission", value); }} flagged={isFlagged("applicationCommission")} />
      </div>

      <div className="earnings-total">
        <span>Câștigurile tale</span>
        <strong>{money(totals.netEarnings)} RON</strong>
      </div>
      <div className="earnings-split">
        <div className="earnings-cash-pill">
          <span>Numerar în mână<small>cash de la clienți</small></span>
          <strong>+{money(totals.cashInHand)} RON</strong>
        </div>
        <div className="earnings-cash-pill card">
          <span>{ownBusiness ? "Bani pe card, în contul firmei" : "Bani pe card, la flotă"}<small>inclusiv credite și promoții</small></span>
          <strong>+{money(cardMoney)} RON</strong>
        </div>
      </div>

      <section className="earnings-group earnings-outside" aria-label="În afara aplicației">
        <GroupHead title="În afara aplicației" />
        <div className="earnings-rows">
          <AmountRow label="Bacșiș numerar" ariaLabel="Bacșiș numerar" value={entry.cashTips} onChange={amount("cashTips")} />
        </div>
      </section>

      {showKilometers ? (
        <div className="earnings-group earnings-flat">
          <AmountRow emphasis sign="" suffix="km" label={kilometersEstimated ? "Kilometri parcurși (estimativ)" : "Kilometri parcurși"} note={kilometersEstimated ? "Din kilometrajul mașinii, cât ai mers pentru aplicație" : undefined} ariaLabel="Kilometri parcurși" value={entry.kilometers} onChange={amount("kilometers")} />
        </div>
      ) : null}
    </div>
  );
}

/** Rubrica pentru banii care nu apar în nicio aplicație. */
export function OtherEarningsFields({
  value,
  onChange,
  delivery = false,
}: {
  value: number;
  onChange: (value: number) => void;
  delivery?: boolean;
}) {
  return (
    <div className="earnings-sheet">
      <div className="earnings-group earnings-flat">
        <AmountRow
          emphasis
          label={delivery ? "Alte încasări" : "Curse private / alte încasări"}
          ariaLabel={delivery ? "Alte încasări" : "Curse private / alte încasări"}
          value={value}
          onChange={(next) => onChange(next ?? 0)}
        />
      </div>
    </div>
  );
}

/** Explicația scurtă afișată deasupra rândurilor fiecărei platforme. */
export function platformEarningsHelp(platformLabel: string, period: string, delivery = false) {
  if (delivery) {
    return `Copiază încasările din ecranul de câștiguri din ${platformLabel}, pentru ${period}. Totalul se calculează singur.`;
  }
  return `Încarcă captura sau copiază rând cu rând din ${platformLabel} → Defalcarea câștigurilor, pentru ${period}. Totalurile se calculează singure, ca să le poți compara cu aplicația.`;
}
