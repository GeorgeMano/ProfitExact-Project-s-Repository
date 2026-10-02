"use client";

import { useMemo, useState } from "react";
import {
  energyUnit,
  platformLabels,
  usesDirectPhevCosts,
  type OnboardingConfig,
} from "@/domain/onboarding";
import {
  calculateConsumptionCost,
  calculateFinancialResult,
  roundMoney,
} from "@/lib/finance/daily-result";
import {
  allocateRecurringCostsForRange,
  inclusiveDays,
} from "@/lib/finance/recurring-cost";
import {
  createEmptyManualPeriodValues,
  manualPeriodId,
  type ManualPeriodValues,
  type SavedManualPeriod,
} from "@/lib/finance/manual-period";
import {
  calculatePlatformBreakdown,
  combinePlatformEntries,
  hasRequiredEarnings,
  missingEarningsMessage,
  platformsFor,
  type PlatformEnergyBasis,
  type PlatformEntryInput,
} from "@/lib/finance/platform-entry";
import { FleetSettlement } from "./fleet-settlement";
import { OtherEarningsFields, PlatformEarningsFields, platformEarningsHelp } from "./platform-earnings-fields";
import {
  aggregatePlatformEntries,
  contributionFromDay,
  getPeriodBounds,
  toSavedPlatformEntry,
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

interface PeriodSummaryPanelProps {
  config: OnboardingConfig;
  periodType: SummaryPeriod;
  anchorDate: string;
  savedDays: SavedWorkDay[];
  manualPeriods: SavedManualPeriod[];
  onSaveManualPeriod: (entry: SavedManualPeriod) => void;
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

function ManualPeriodForm({ config, periodType, startDate, endDate, calendarCosts, existing, onSave }: {
  config: OnboardingConfig;
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  calendarCosts: PeriodCalendarCosts;
  existing?: SavedManualPeriod;
  onSave: (entry: SavedManualPeriod) => void;
}) {
  const platformKeys = useMemo(() => platformsFor(config.platform), [config.platform]);
  const [values, setValues] = useState<ManualPeriodValues>(
    () => existing?.values ?? createEmptyManualPeriodValues(platformKeys),
  );
  const set = <Key extends keyof ManualPeriodValues>(key: Key, value: ManualPeriodValues[Key]) => setValues((current) => ({ ...current, [key]: value }));
  const setPlatform = <Key extends keyof PlatformEntryInput>(index: number, key: Key, value: PlatformEntryInput[Key]) =>
    setValues((current) => ({
      ...current,
      platforms: current.platforms.map((entry, position) =>
        position === index ? { ...entry, [key]: value } : entry,
      ),
    }));

  const oneOffCosts = values.washingCost + values.parkingCost + values.roadTollCost + values.serviceCost + values.otherCost;
  const directPhevCosts = usesDirectPhevCosts(config);
  const usesSharedKilometers =
    config.kilometerEntry === "shared" && values.platforms.length > 1;
  const sharedKilometerInput = usesSharedKilometers ? values.sharedKilometers : null;
  const combined = combinePlatformEntries(values.platforms, sharedKilometerInput);
  const kilometers = combined.kilometers;
  const consumedInPeriod =
    (Math.max(0, kilometers) * Math.max(0, config.consumptionPer100Km)) / 100;
  const energyCost = directPhevCosts
    ? Math.max(0, values.gasolineCost) + Math.max(0, values.electricCost)
    : calculateConsumptionCost(
        kilometers,
        config.consumptionPer100Km,
        values.unitPrice,
      );
  const energyBasis: PlatformEnergyBasis = directPhevCosts
    ? { type: "phev", gasolineCost: values.gasolineCost, electricCost: values.electricCost }
    : { type: "calculated", consumptionPer100Km: config.consumptionPer100Km, unitPrice: values.unitPrice };
  const breakdown = calculatePlatformBreakdown({
    entries: values.platforms,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    sharedKilometers: sharedKilometerInput,
  });
  const canCalculate = hasRequiredEarnings(values.platforms);
  const result = canCalculate
    ? calculateFinancialResult({
        ...combined,
        privateEarnings: values.privateEarnings,
        energyCost,
        fleetCommission: config.fleetCommission,
        cimCost: calendarCosts.cimCost,
        recurringCosts: calendarCosts.recurringCosts,
        recurringFleetCosts: calendarCosts.recurringFleetCosts,
        oneOffCosts,
      })
    : null;

  const save = () => {
    if (!result) return;
    onSave({
      id: manualPeriodId(periodType, startDate, endDate),
      periodType,
      startDate,
      endDate,
      values,
      result,
      contribution: {
        startDate,
        endDate,
        platforms: breakdown.map((item, index) =>
          toSavedPlatformEntry(values.platforms[index], item),
        ),
        appRevenue: combined.appRevenue,
        cashRevenue: combined.cashRevenue,
        netEarnings: result.platformNetEarnings,
        cashInHand: result.cashInHand,
        applicationCommission: result.applicationCommission,
        platformCosts: result.platformCosts,
        cashTips: combined.cashTips,
        privateEarnings: values.privateEarnings,
        amountManagedByFleet: result.amountManagedByFleet,
        totalEarnings: result.totalEarnings,
        energyCost: result.energyCost,
        fleetCommission: result.fleetCommission,
        oneOffCosts: result.oneOffCosts,
        resultBeforeCalendarCosts: roundMoney(result.result + result.cimCost + result.recurringCosts),
        fleetBalanceBeforeCalendarCosts: roundMoney(result.fleetBalance - result.cimCost - calendarCosts.recurringFleetCosts),
        hoursWorked: values.hoursWorked,
        kilometers,
      },
    });
  };

  return (
    <form className="manual-period-form" onSubmit={(event) => event.preventDefault()}>
      {values.platforms.map((entry, index) => (
        <fieldset className="section-block" key={entry.platform}>
          <legend>{platformLabels[entry.platform]}</legend>
          <p className="section-help">{platformEarningsHelp(platformLabels[entry.platform], `întreaga ${periodType === "week" ? "săptămână" : "lună"}`)}</p>
          <PlatformEarningsFields entry={entry} platformLabel={platformLabels[entry.platform]} showKilometers={!usesSharedKilometers} onChange={(key, value) => setPlatform(index, key, value)} />
        </fieldset>
      ))}

      <fieldset className="section-block"><legend>Alte încasări</legend><p className="section-help">Bani primiți în afara aplicațiilor de ridesharing, cash sau prin transfer. Rămân integral la tine și nu trec prin flotă.</p><OtherEarningsFields value={values.privateEarnings} onChange={(value) => set("privateEarnings", value)} /></fieldset>

      <fieldset className="section-block"><legend>Activitatea și combustibilul perioadei</legend>{usesSharedKilometers ? <p className="section-help">Ai ales un singur total de kilometri. Introdu kilometrii reali ai perioadei, cu tot cu mersul în gol; repartizarea pe platformă se face proporțional cu încasările.</p> : null}<div className="field-grid">
        <NumberField label="Zile lucrate" value={values.workedDays} onChange={(value) => set("workedDays", value)} suffix="zile" step="1" />
        <NumberField label="Ore lucrate" value={values.hoursWorked} onChange={(value) => set("hoursWorked", value)} suffix="ore" step="0.25" />
        {usesSharedKilometers ? <NumberField label="Kilometri parcurși în total" value={values.sharedKilometers} onChange={(value) => set("sharedKilometers", value)} suffix="km" /> : <div className="readonly-field"><span>Kilometri în total</span><strong>{kilometers.toLocaleString("ro-RO")} km</strong></div>}
        {directPhevCosts ? <><NumberField label="Cost benzină consumată în perioadă" value={values.gasolineCost} onChange={(value) => set("gasolineCost", value)} /><NumberField label="Cost energie electrică consumată în perioadă" value={values.electricCost} onChange={(value) => set("electricCost", value)} /></> : <><div className="readonly-field"><span>Consum configurat în onboarding</span><strong>{config.consumptionPer100Km.toLocaleString("ro-RO")} {config.fuelType === "electric" ? "kWh" : "litri"}/100 km</strong></div><NumberField label={`Prețul pe ${energyUnit(config)} folosit pentru perioadă`} value={values.unitPrice} onChange={(value) => set("unitPrice", value)} suffix={`RON/${energyUnit(config)}`} /><div className="calculation-preview"><div><span>{config.fuelType === "electric" ? "Energie calculată" : "Combustibil calculat"}</span><strong>{consumedInPeriod.toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {config.fuelType === "electric" ? "kWh" : "litri"}</strong></div><div><span>Cheltuială calculată</span><strong>{money(energyCost)} RON</strong></div></div></>}
      </div><p className="helper">Dacă prețul a diferit între zile, introdu zilele separat pentru un calcul exact. Nu se scade valoarea integrală a unui plin rămas în rezervor.</p></fieldset>

      <fieldset className="section-block"><legend>Cheltuieli apărute în perioadă</legend><p className="section-help">Lasă necompletate costurile care nu au existat.</p><div className="field-grid">
        <NumberField label="Spălătorie" value={values.washingCost} onChange={(value) => set("washingCost", value)} />
        <NumberField label="Parcare" value={values.parkingCost} onChange={(value) => set("parkingCost", value)} />
        <NumberField label="Taxe de drum / pod" value={values.roadTollCost} onChange={(value) => set("roadTollCost", value)} />
        <NumberField label="Service / revizii" value={values.serviceCost} onChange={(value) => set("serviceCost", value)} />
        <NumberField label="Alte taxe / costuri pe traseu" value={values.otherCost} onChange={(value) => set("otherCost", value)} />
      </div></fieldset>

      <div className="save-day-panel"><div><strong>{existing ? "Actualizează perioada introdusă" : "Salvează perioada"}</strong><span>Detaliile rămân separate și pot fi folosite în centralizarea lunii.</span></div><button type="button" onClick={save} disabled={!canCalculate}>{existing ? "Actualizează" : `Salvează ${periodType === "week" ? "săptămâna" : "luna"}`}</button>{!canCalculate ? <p>{missingEarningsMessage()}</p> : null}</div>
    </form>
  );
}

export function PeriodSummaryPanel({ config, periodType, anchorDate, savedDays, manualPeriods, onSaveManualPeriod, persistenceNote }: PeriodSummaryPanelProps) {
  const { startDate, endDate } = getPeriodBounds(anchorDate, periodType);
  const periodLabel = periodType === "week" ? "săptămânii" : "lunii";
  const recurring = useMemo(
    () => allocateRecurringCostsForRange(config.recurringCosts, startDate, endDate),
    [config.recurringCosts, startDate, endDate],
  );
  const calendarCosts: PeriodCalendarCosts = {
    cimCost: roundMoney((config.weeklyCimCost / 7) * inclusiveDays(startDate, endDate)),
    recurringCosts: roundMoney(recurring.reduce((sum, cost) => sum + cost.periodAmount, 0)),
    recurringFleetCosts: roundMoney(recurring.filter((cost) => cost.paidToFleet).reduce((sum, cost) => sum + cost.periodAmount, 0)),
  };

  const daysInPeriod = savedDays.filter((day) => day.date >= startDate && day.date <= endDate);
  const eligibleManualWeeks = periodType === "month"
    ? manualPeriods.filter((entry) => entry.periodType === "week" && entry.startDate >= startDate && entry.endDate <= endDate && !daysInPeriod.some((day) => day.date >= entry.startDate && day.date <= entry.endDate))
    : [];
  const automaticContributions = [
    ...daysInPeriod.map(contributionFromDay),
    ...eligibleManualWeeks.map((entry) => entry.contribution),
  ];
  const hasAutomaticData = automaticContributions.length > 0;
  const matchingManual = manualPeriods.find((entry) => entry.periodType === periodType && entry.startDate === startDate && entry.endDate === endDate);
  const contributions = hasAutomaticData ? automaticContributions : matchingManual ? [matchingManual.contribution] : [];
  const hasData = contributions.length > 0;
  const summary = summarizeContributions(contributions, periodType, startDate, endDate, calendarCosts, daysInPeriod);
  const workedDays = hasAutomaticData
    ? daysInPeriod.length + eligibleManualWeeks.reduce((sum, entry) => sum + entry.values.workedDays, 0)
    : matchingManual?.values.workedDays ?? 0;
  const resultPerHour = summary.totalHours > 0 ? summary.totalResult / summary.totalHours : null;
  // Defalcarea perioadei: se adună pe platformă atât zilele salvate, cât și
  // perioadele introduse manual care intră în calcul.
  const platformTotals: SavedPlatformEntry[] = aggregatePlatformEntries(
    contributions.map((entry) => entry.platforms),
  );
  const showSeparateView =
    config.profitView === "separate" && platformTotals.length > 1;

  return (
    <section className="workspace period-workspace" aria-label={`Centralizarea ${periodLabel}`}>
      <div className="form-card period-source-card">
        <section className="section-block">
          <p className="eyebrow">Sursa calculului</p>
          <h2>{hasAutomaticData ? "Centralizare automată" : matchingManual ? "Perioadă introdusă manual" : "Nu există date în această perioadă"}</h2>
          <p className="section-help">{hasAutomaticData ? `ProfitExact folosește ${daysInPeriod.length} zile salvate${eligibleManualWeeks.length ? ` și ${eligibleManualWeeks.length} săptămâni introduse manual` : ""}. Datele nu sunt dublate.` : matchingManual ? "Poți corecta valorile mai jos. Când vor exista date zilnice mai detaliate, ele vor avea prioritate." : `Poți introduce direct totalurile ${periodType === "week" ? "săptămânii" : "lunii"}.`}</p>
          {hasAutomaticData ? <div className="source-chips">{daysInPeriod.map((day) => <span key={day.date}>Zi · {shortDate(day.date)}</span>)}{eligibleManualWeeks.map((entry) => <span key={entry.id}>Săptămână · {shortDate(entry.startDate)}–{shortDate(entry.endDate)}</span>)}</div> : null}
        </section>
        {!hasAutomaticData ? <ManualPeriodForm key={`${periodType}:${startDate}`} config={config} periodType={periodType} startDate={startDate} endDate={endDate} calendarCosts={calendarCosts} existing={matchingManual} onSave={onSaveManualPeriod} /> : <section className="section-block"><h3>Costuri repartizate automat</h3><p className="section-help">CIM și costurile recurente din onboarding sunt calculate pentru fiecare zi calendaristică a perioadei, inclusiv zilele nelucrate.</p><dl className="compact-cost-list"><div><dt>CIM</dt><dd>{money(calendarCosts.cimCost)} RON</dd></div>{recurring.map((cost) => <div key={cost.id}><dt>{cost.label}</dt><dd>{money(cost.periodAmount)} RON</dd></div>)}</dl></section>}
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
            <div><dt>Kilometri</dt><dd>{summary.totalKilometers.toLocaleString("ro-RO")} km</dd></div>
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
            <div><dt>Kilometri</dt><dd>{item.kilometers.toLocaleString("ro-RO")} km</dd></div>
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
