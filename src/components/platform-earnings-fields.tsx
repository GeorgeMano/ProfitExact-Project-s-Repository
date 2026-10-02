"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  platformEntryTotals,
  type PlatformEntryInput,
} from "@/lib/finance/platform-entry";
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
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          aria-label={ariaLabel}
          required={required}
          placeholder={required ? "din aplicație" : "0,00"}
          value={value === null || (!required && value === 0) ? "" : value}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
        />
        <small>{suffix}</small>
      </span>
    </div>
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
}: {
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
    </div>
  );
}

export function PlatformEarningsFields({
  entry,
  platformLabel,
  showKilometers,
  kilometersEstimated = false,
  formPeriod,
  initialReading = null,
  onOtherPeriod,
  onChange,
  onReplace,
}: {
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
          <AmountRow label="Credite și promoții pentru utilizatori" note="Nu sunt bani în mână: se socotesc la card și ajung la flotă" ariaLabel="Credite și promoții pentru utilizatori" value={entry.userCredits} onChange={amount("userCredits")} flagged={isFlagged("userCredits")} />
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
          <span>Bani pe card, la flotă<small>inclusiv credite și promoții</small></span>
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

/** Rubrica pentru banii care nu apar în nicio aplicație de ridesharing. */
export function OtherEarningsFields({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="earnings-sheet">
      <div className="earnings-group earnings-flat">
        <AmountRow
          emphasis
          label="Curse private / alte încasări"
          ariaLabel="Curse private / alte încasări"
          value={value}
          onChange={(next) => onChange(next ?? 0)}
        />
      </div>
    </div>
  );
}

/** Explicația scurtă afișată deasupra rândurilor fiecărei platforme. */
export function platformEarningsHelp(platformLabel: string, period: string) {
  return `Încarcă captura sau copiază rând cu rând din ${platformLabel} → Defalcarea câștigurilor, pentru ${period}. Totalurile se calculează singure, ca să le poți compara cu aplicația.`;
}
