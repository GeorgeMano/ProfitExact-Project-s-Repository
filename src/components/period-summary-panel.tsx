"use client";

import { useMemo, useState } from "react";
import {
  energyUnit,
  platformLabels,
  usesDirectPhevCosts,
  type OnboardingConfig,
} from "@/domain/onboarding";
import { roundMoney } from "@/lib/finance/daily-result";
import { allocateRecurringCostsForRange } from "@/lib/finance/recurring-cost";
import {
  createEmptyManualPeriodValues,
  type ManualPeriodValues,
  type SavedManualPeriod,
} from "@/lib/finance/manual-period";
import {
  missingEarningsMessage,
  platformsFor,
  type PlatformEntryInput,
  type PlatformKey,
} from "@/lib/finance/platform-entry";
import { resolvePeriod } from "@/lib/finance/period-sources";
import { entryFromReading, type ScreenshotReading } from "@/lib/ocr/earnings-screenshot";
import {
  buildManualPeriod,
  calculateManualPeriod,
  calendarCostsForRange,
} from "@/lib/finance/work-day";
import { FleetSettlement } from "./fleet-settlement";
import { OtherEarningsFields, PlatformEarningsFields, platformEarningsHelp } from "./platform-earnings-fields";
import {
  aggregatePlatformEntries,
  getPeriodBounds,
  summarizeContributions,
  type PeriodCalendarCosts,
  type SavedPlatformEntry,
  type SavedWorkDay,
  type SummaryPeriod,
} from "@/lib/finance/weekly-summary";

// Tipurile stau acum în `lib/finance/manual-period`, ca stratul de persistență
// să le poată folosi fără să importe cod de interfață. Se re-exportă de aici
// pentru importurile existente.
export type { ManualPeriodValues, SavedManualPeriod };

/** O captură citită în alt formular, de aplicat în formularul perioadei. */
export interface IncomingCapture {
  id: number;
  platform: PlatformKey;
  periodType: SummaryPeriod;
  anchorDate: string;
  reading: ScreenshotReading;
}

interface PeriodSummaryPanelProps {
  config: OnboardingConfig;
  periodType: SummaryPeriod;
  anchorDate: string;
  savedDays: SavedWorkDay[];
  manualPeriods: SavedManualPeriod[];
  onSaveManualPeriod: (entry: SavedManualPeriod) => void;
  /** Șterge un total introdus; zilele înlocuite de el revin în calcul. */
  onDeleteManualPeriod: (id: string) => void;
  incomingCapture: IncomingCapture | null;
  onIncomingCaptureUsed: () => void;
  onCaptureForOtherPeriod: (
    platform: PlatformKey,
  ) => (period: "week" | "month", reading: ScreenshotReading) => void;
  /** Ce se întâmplă cu datele introduse: demo local, cont real sau deloc. */
  persistenceNote: string;
}

function money(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatPeriodResult(totalResult: number, kilometers: number, periodType: SummaryPeriod) {
  if (totalResult === 0) return "Ai câștigat 0 RON.";
  if (kilometers <= 0) {
    return totalResult > 0
      ? `Ai încheiat ${periodType === "week" ? "săptămâna" : "luna"} pe plus.`
      : `Ai încheiat ${periodType === "week" ? "săptămâna" : "luna"} pe minus.`;
  }

  const perKm = money(Math.abs(totalResult / kilometers));
  return totalResult > 0
    ? `Ai câștigat ${perKm} RON/km în această ${periodType === "week" ? "săptămână" : "lună"}.`
    : `Ai pierdut ${perKm} RON/km în această ${periodType === "week" ? "săptămână" : "lună"}.`;
}

function NumberField({ label, value, onChange, suffix = "RON", step = "0.01" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: string }) {
  return <label className="field"><span>{label}</span><span className="input-wrap"><input type="number" min="0" step={step} value={value === 0 ? "" : value} onChange={(event) => onChange(Number(event.target.value))} /><small>{suffix}</small></span></label>;
}

function ManualPeriodForm({ config, periodType, startDate, endDate, calendarCosts, existing, replacing, incoming, onCaptureForOtherPeriod, onSave, onDelete }: {
  config: OnboardingConfig;
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  calendarCosts: PeriodCalendarCosts;
  existing?: SavedManualPeriod | null;
  /** Ce înlocuiește totalul la salvare, spus pe înțeles: „3 zile salvate”. */
  replacing?: string | null;
  incoming?: IncomingCapture | null;
  onCaptureForOtherPeriod: PeriodSummaryPanelProps["onCaptureForOtherPeriod"];
  onSave: (entry: SavedManualPeriod) => void;
  onDelete?: () => void;
}) {
  const periodNoun = periodType === "week" ? "săptămânii" : "lunii";
  const platformKeys = useMemo(() => platformsFor(config.platform), [config.platform]);
  const [values, setValues] = useState<ManualPeriodValues>(() => {
    const base = existing?.values ?? createEmptyManualPeriodValues(platformKeys);
    if (!incoming) return base;
    // Rubricile platformei din captură vin completate; restul rămân cum erau.
    return {
      ...base,
      platforms: base.platforms.map((entry) =>
        entry.platform === incoming.platform ? entryFromReading(entry, incoming.reading) : entry,
      ),
    };
  });
  const set = <Key extends keyof ManualPeriodValues>(key: Key, value: ManualPeriodValues[Key]) => setValues((current) => ({ ...current, [key]: value }));
  const setPlatform = <Key extends keyof PlatformEntryInput>(index: number, key: Key, value: PlatformEntryInput[Key]) =>
    setValues((current) => ({
      ...current,
      platforms: current.platforms.map((entry, position) =>
        position === index ? { ...entry, [key]: value } : entry,
      ),
    }));

  const directPhevCosts = usesDirectPhevCosts(config);
  const { sharedKilometers: sharedKilometerInput, combined, energyCost, canCalculate } =
    calculateManualPeriod(config, values, calendarCosts);
  const usesSharedKilometers = sharedKilometerInput !== null;
  const kilometers = combined.kilometers;
  const consumedInPeriod =
    (Math.max(0, kilometers) * Math.max(0, config.consumptionPer100Km)) / 100;

  const save = () => {
    const entry = buildManualPeriod(config, periodType, startDate, endDate, values, calendarCosts);
    if (entry) onSave(entry);
  };

  return (
    <form className="manual-period-form" onSubmit={(event) => event.preventDefault()}>
      {values.platforms.map((entry, index) => (
        <fieldset className="section-block" key={entry.platform}>
          <legend>{platformLabels[entry.platform]}</legend>
          <p className="section-help">{platformEarningsHelp(platformLabels[entry.platform], `întreaga ${periodType === "week" ? "săptămână" : "lună"}`)}</p>
          <PlatformEarningsFields entry={entry} platformLabel={platformLabels[entry.platform]} showKilometers={!usesSharedKilometers} kilometersEstimated formPeriod={{ type: periodType, startDate, endDate }} initialReading={incoming?.platform === entry.platform ? incoming.reading : null} onOtherPeriod={onCaptureForOtherPeriod(entry.platform)} onChange={(key, value) => setPlatform(index, key, value)} onReplace={(next) => setValues((current) => ({ ...current, platforms: current.platforms.map((item, position) => (position === index ? next : item)) }))} />
        </fieldset>
      ))}

      <fieldset className="section-block"><legend>Alte încasări</legend><p className="section-help">Bani primiți în afara aplicațiilor de ridesharing, cash sau prin transfer. Rămân integral la tine și nu trec prin flotă.</p><OtherEarningsFields value={values.privateEarnings} onChange={(value) => set("privateEarnings", value)} /></fieldset>

      <fieldset className="section-block"><legend>Activitatea și combustibilul perioadei</legend><p className="section-help">{usesSharedKilometers ? "Ai ales un singur total de kilometri. Introdu o estimare a kilometrilor reali ai perioadei, din kilometrajul mașinii, cu tot cu mersul în gol; repartizarea pe platformă se face proporțional cu încasările." : "Aplicațiile nu arată kilometrii pe toată perioada, așa că introdu o estimare din kilometrajul mașinii. Combustibilul se calculează din ea."}</p><div className="field-grid">
        <NumberField label="Zile lucrate" value={values.workedDays} onChange={(value) => set("workedDays", value)} suffix="zile" step="1" />
        <NumberField label="Ore lucrate" value={values.hoursWorked} onChange={(value) => set("hoursWorked", value)} suffix="ore" step="0.25" />
        {usesSharedKilometers ? <NumberField label="Kilometri parcurși în total (estimativ)" value={values.sharedKilometers} onChange={(value) => set("sharedKilometers", value)} suffix="km" /> : <div className="readonly-field"><span>Kilometri în total (estimativ)</span><strong>{kilometers.toLocaleString("ro-RO")} km</strong></div>}
        {directPhevCosts ? <><NumberField label="Cost benzină consumată în perioadă" value={values.gasolineCost} onChange={(value) => set("gasolineCost", value)} /><NumberField label="Cost energie electrică consumată în perioadă" value={values.electricCost} onChange={(value) => set("electricCost", value)} /></> : <><div className="readonly-field"><span>Consum configurat în onboarding</span><strong>{config.consumptionPer100Km.toLocaleString("ro-RO")} {config.fuelType === "electric" ? "kWh" : "litri"}/100 km</strong></div><NumberField label={`Prețul pe ${energyUnit(config)} folosit pentru perioadă`} value={values.unitPrice} onChange={(value) => set("unitPrice", value)} suffix={`RON/${energyUnit(config)}`} /><div className="calculation-preview"><div><span>{config.fuelType === "electric" ? "Energie calculată" : "Combustibil calculat"}</span><strong>{consumedInPeriod.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {config.fuelType === "electric" ? "kWh" : "litri"}</strong></div><div><span>Cheltuială calculată</span><strong>{money(energyCost)} RON</strong></div></div></>}
      </div><p className="helper">Dacă prețul a diferit între zile, introdu zilele separat pentru un calcul exact. Nu se scade valoarea integrală a unui plin rămas în rezervor.</p></fieldset>

      <fieldset className="section-block"><legend>Cheltuieli apărute în perioadă</legend><p className="section-help">Lasă necompletate costurile care nu au existat.</p><div className="field-grid">
        <NumberField label="Spălătorie" value={values.washingCost} onChange={(value) => set("washingCost", value)} />
        <NumberField label="Parcare" value={values.parkingCost} onChange={(value) => set("parkingCost", value)} />
        <NumberField label="Taxe de drum / pod" value={values.roadTollCost} onChange={(value) => set("roadTollCost", value)} />
        <NumberField label="Service / revizii" value={values.serviceCost} onChange={(value) => set("serviceCost", value)} />
        <NumberField label="Alte taxe / costuri pe traseu" value={values.otherCost} onChange={(value) => set("otherCost", value)} />
      </div></fieldset>

      <div className="save-day-panel"><div><strong>{existing ? `Actualizează totalul ${periodNoun}` : `Salvează totalul ${periodNoun}`}</strong><span>{replacing ? `La salvare, totalul înlocuiește în calcul ${replacing}. Datele înlocuite rămân salvate și revin dacă ștergi totalul.` : periodType === "week" ? "Totalul săptămânii intră și în regularizarea cu flota și în centralizarea lunii." : "Totalul lunii intră în regularizarea cu flota a lunii."}</span></div><button type="button" onClick={save} disabled={!canCalculate}>{existing ? "Actualizează" : `Salvează ${periodType === "week" ? "săptămâna" : "luna"}`}</button>{!canCalculate ? <p>{missingEarningsMessage()}</p> : null}{existing && onDelete ? <button type="button" className="delete-period-button" onClick={onDelete}>Șterge totalul {periodNoun}</button> : null}</div>
    </form>
  );
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export function PeriodSummaryPanel({ config, periodType, anchorDate, savedDays, manualPeriods, onSaveManualPeriod, onDeleteManualPeriod, incomingCapture, onIncomingCaptureUsed, onCaptureForOtherPeriod, persistenceNote }: PeriodSummaryPanelProps) {
  const { startDate, endDate } = getPeriodBounds(anchorDate, periodType);
  const periodLabel = periodType === "week" ? "săptămânii" : "lunii";
  const recurring = useMemo(
    () => allocateRecurringCostsForRange(config.recurringCosts, startDate, endDate),
    [config.recurringCosts, startDate, endDate],
  );
  const calendarCosts: PeriodCalendarCosts = calendarCostsForRange(config, startDate, endDate);

  // Ce intră în calcul: totalul introdus are prioritate față de zilele și
  // săptămânile din interiorul lui (regula din `period-sources`).
  const resolved = resolvePeriod(periodType, anchorDate, savedDays, manualPeriods);
  const { contributions, manual } = resolved;
  const hasData = contributions.length > 0;
  const summary = summarizeContributions(contributions, periodType, startDate, endDate, calendarCosts, resolved.days);
  const workedDays = resolved.workedDays;
  const resultPerHour = summary.totalHours > 0 ? summary.totalResult / summary.totalHours : null;

  // Cu zile salvate, formularul totalului se deschide numai la cerere.
  const [replacingFor, setReplacingFor] = useState<string | null>(null);
  // O captură adusă din alt formular, pentru exact această perioadă.
  const incoming =
    incomingCapture &&
    incomingCapture.periodType === periodType &&
    getPeriodBounds(incomingCapture.anchorDate, periodType).startDate === startDate
      ? incomingCapture
      : null;
  const showForm =
    resolved.source !== "automatic" ||
    replacingFor === `${periodType}:${startDate}` ||
    incoming !== null;
  const automaticParts = [
    resolved.days.length ? plural(resolved.days.length, "zi salvată", "zile salvate") : null,
    resolved.weeks.length ? plural(resolved.weeks.length, "săptămână introdusă ca total", "săptămâni introduse ca total") : null,
    resolved.partialWeeks.length ? plural(resolved.partialWeeks.length, "săptămână împărțită cu luna vecină", "săptămâni împărțite cu lunile vecine") : null,
  ].filter(Boolean);
  const replacedParts = [
    resolved.replacedDays.length ? plural(resolved.replacedDays.length, "zi salvată", "zile salvate") : null,
    resolved.replacedWeeks.length ? plural(resolved.replacedWeeks.length, "săptămână introdusă ca total", "săptămâni introduse ca total") : null,
  ].filter(Boolean);
  const pendingReplacement = resolved.source === "automatic" ? automaticParts.join(" și ") : null;

  // Defalcarea perioadei: se adună pe platformă tot ce intră în calcul.
  const platformTotals: SavedPlatformEntry[] = aggregatePlatformEntries(
    contributions.map((entry) => entry.platforms),
  );
  const showSeparateView =
    config.profitView === "separate" && platformTotals.length > 1;
  const kilometerLabel = resolved.estimatedKilometers ? "Kilometri (estimativ)" : "Kilometri";

  return (
    <section className="workspace period-workspace" aria-label={`Centralizarea ${periodLabel}`}>
      <div className="form-card period-source-card">
        <section className="section-block">
          <p className="eyebrow">Sursa calculului</p>
          <h2>{resolved.source === "manual" ? `Totalul ${periodLabel}, introdus de tine` : resolved.source === "automatic" ? "Centralizare automată" : `Introdu totalul ${periodLabel}`}</h2>
          <p className="section-help">
            {resolved.source === "manual"
              ? `Calculul folosește totalul introdus pentru toată ${periodType === "week" ? "săptămâna" : "luna"}.${replacedParts.length ? ` Înlocuiește în calcul ${replacedParts.join(" și ")}; datele înlocuite rămân salvate și revin dacă ștergi totalul.` : ""} Poți corecta valorile mai jos.`
              : resolved.source === "automatic"
                ? `ProfitExact adună ${automaticParts.join(", ")}. Datele nu sunt dublate.`
                : `Ai captura pe toată ${periodType === "week" ? "săptămâna" : "luna"}? Introdu totalul aici. Dacă preferi, poți introduce în continuare fiecare zi, de la „Zilnic”.`}
          </p>
          {resolved.source === "automatic" ? <div className="source-chips">
            {resolved.days.map((day) => <span key={day.date}>Zi · {shortDate(day.date)}</span>)}
            {resolved.weeks.map((entry) => <span key={entry.id}>Săptămână · {shortDate(entry.startDate)}–{shortDate(entry.endDate)}</span>)}
            {resolved.partialWeeks.map(({ week, daysInPeriod }) => <span key={week.id}>Săptămână · {shortDate(week.startDate)}–{shortDate(week.endDate)} · {daysInPeriod} din 7 zile, estimativ</span>)}
          </div> : null}
          {resolved.source === "automatic" && !showForm ? <button type="button" className="replace-period-button" onClick={() => setReplacingFor(`${periodType}:${startDate}`)}>Introdu totalul {periodLabel} în locul lor</button> : null}
        </section>
        {showForm ? <ManualPeriodForm key={`${periodType}:${startDate}:${manual?.id ?? "nou"}:${incoming?.id ?? ""}`} config={config} periodType={periodType} startDate={startDate} endDate={endDate} calendarCosts={calendarCosts} existing={manual} replacing={manual ? null : pendingReplacement} incoming={incoming} onCaptureForOtherPeriod={onCaptureForOtherPeriod} onSave={(entry) => { setReplacingFor(null); onIncomingCaptureUsed(); onSaveManualPeriod(entry); }} onDelete={manual ? () => onDeleteManualPeriod(manual.id) : undefined} /> : <section className="section-block"><h3>Costuri repartizate automat</h3><p className="section-help">CIM și costurile recurente din onboarding sunt calculate pentru fiecare zi calendaristică a perioadei, inclusiv zilele nelucrate.</p><dl className="compact-cost-list"><div><dt>CIM</dt><dd>{money(calendarCosts.cimCost)} RON</dd></div>{recurring.map((cost) => <div key={cost.id}><dt>{cost.label}</dt><dd>{money(cost.periodAmount)} RON</dd></div>)}</dl></section>}
      </div>

      <aside className="result-column" aria-live="polite">
        {hasData ? <>
          <section className={`result-card ${summary.totalResult < 0 ? "negative" : "positive"}`}><p className="result-label">Îți rămân în această {periodType === "week" ? "săptămână" : "lună"}</p><p className="result-value">{money(summary.totalResult)} RON</p><p className="result-alert">{formatPeriodResult(summary.totalResult, summary.totalKilometers, periodType)}</p></section>
          <section className="breakdown-card"><div className="card-heading"><div><p className="eyebrow">Calcul transparent</p><h2>Detaliile {periodLabel}</h2></div><span>{shortDate(startDate)} – {shortDate(endDate)}</span></div><dl className="breakdown-list">
            <div><dt>Venituri în aplicație</dt><dd>{money(summary.totalAppRevenue)} RON</dd></div>
            <div><dt>Venituri în numerar</dt><dd>{money(summary.totalCashRevenue)} RON</dd></div>
            {summary.totalPlatformCosts > 0 ? <div><dt>Costuri și taxe</dt><dd>− {money(summary.totalPlatformCosts)} RON</dd></div> : null}
            <div><dt>Comision aplicație</dt><dd>− {money(summary.totalApplicationCommission)} RON</dd></div>
            <div><dt>Câștigurile tale</dt><dd>{money(summary.totalNetEarnings)} RON</dd></div>
            <div><dt>Numerar în mână</dt><dd>{money(summary.totalCashInHand)} RON</dd></div>
            {summary.totalCashTips > 0 ? <div><dt>Bacșiș numerar</dt><dd>{money(summary.totalCashTips)} RON</dd></div> : null}
            {summary.totalPrivateEarnings > 0 ? <div><dt>Curse private / alte încasări</dt><dd>{money(summary.totalPrivateEarnings)} RON</dd></div> : null}
            <div><dt>Total câștiguri</dt><dd>{money(summary.totalEarnings)} RON</dd></div>
            <div><dt>Zile lucrate</dt><dd>{workedDays}</dd></div>
            <div><dt>Ore lucrate</dt><dd>{summary.totalHours.toLocaleString("ro-RO")} ore</dd></div>
            {resultPerHour !== null ? <div><dt>Câștig după cheltuieli / oră</dt><dd>{money(resultPerHour)} RON</dd></div> : null}
            <div><dt>{kilometerLabel}</dt><dd>{summary.totalKilometers.toLocaleString("ro-RO")} km</dd></div>
            <div><dt>Combustibil / energie</dt><dd>− {money(summary.totalEnergyCost)} RON</dd></div>
            <div><dt>Comision flotă</dt><dd>− {money(summary.totalFleetCommission)} RON</dd></div>
            <div><dt>CIM repartizat</dt><dd>− {money(summary.totalCimCost)} RON</dd></div>
            <div><dt>Costuri recurente</dt><dd>− {money(summary.totalRecurringCosts)} RON</dd></div>
            <div><dt>Cheltuieli apărute în perioadă</dt><dd>− {money(summary.totalOneOffCosts)} RON</dd></div>
            <div className="total-row"><dt>Total cheltuieli</dt><dd>− {money(summary.totalExpenses)} RON</dd></div>
          </dl></section>
          {showSeparateView ? <section className="breakdown-card platform-breakdown-card"><div className="card-heading"><div><p className="eyebrow">Separat pe platformă</p><h2>Ce a adus fiecare aplicație</h2></div></div><p className="section-help">Se separă doar ce se poate măsura: încasările și comisionul din fiecare aplicație și kilometrii, plus combustibilul care decurge din ei.</p>{platformTotals.map((item) => <dl className="breakdown-list" key={item.platform} aria-label={`Detalii ${platformLabels[item.platform]}`}>
            <div className="total-row"><dt>{platformLabels[item.platform]}</dt><dd>{money(item.resultBeforeCommonCosts)} RON</dd></div>
            <div><dt>Câștigurile tale</dt><dd>{money(item.netEarnings)} RON</dd></div>
            <div><dt>Numerar în mână</dt><dd>{money(item.cashInHand)} RON</dd></div>
            <div><dt>Total câștiguri</dt><dd>{money(item.totalEarnings)} RON</dd></div>
            <div><dt>{kilometerLabel}</dt><dd>{item.kilometers.toLocaleString("ro-RO")} km</dd></div>
            <div><dt>Combustibil / energie</dt><dd>− {money(item.energyCost)} RON</dd></div>
            <div><dt>Comision flotă</dt><dd>− {money(item.fleetCommission)} RON</dd></div>
            {item.kilometers > 0 ? <div><dt>Câștig pe kilometru</dt><dd>{money(item.resultBeforeCommonCosts / item.kilometers)} RON/km</dd></div> : null}
          </dl>)}<p className="helper">Sumele nu includ CIM-ul, chiria, RCA, spălarea sau parcarea: acelea sunt ale perioadei și ale mașinii, nu ale unei aplicații. Rezultatul final al {periodLabel} este același, fie că îl privești împreună sau separat.</p></section> : null}
          <FleetSettlement title={`Regularizarea ${periodLabel}`} balance={summary.totalFleetBalance} amountManagedByFleet={summary.totalAmountManagedByFleet} fleetCommission={summary.totalFleetCommission} cimCost={summary.totalCimCost} cimLabel="CIM repartizat" otherFleetCosts={roundMoney(summary.totalFleetCosts - summary.totalCimCost)} note="Numerarul în mână și bacșișul cash rămân la tine. Flota primește restul câștigurilor, inclusiv creditele și promoțiile, și oprește din ei comisionul, CIM-ul și costurile plătite ei." />
        </> : <section className="breakdown-card empty-period-card"><p className="eyebrow">Centralizare</p><h2>Completează datele perioadei</h2><p>Rezultatul apare după ce introduci comisionul exact din aplicație și salvezi perioada.</p></section>}
        <p className="preview-note">{persistenceNote}</p>
      </aside>
    </section>
  );
}
