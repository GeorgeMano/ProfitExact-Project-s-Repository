"use client";

import { useMemo, useState } from "react";
import type { OnboardingConfig } from "@/domain/onboarding";
import {
  calculateFinancialResult,
  formatFleetAlert,
  roundMoney,
  type FinancialResult,
} from "@/lib/finance/daily-result";
import {
  allocateRecurringCostsForRange,
  inclusiveDays,
} from "@/lib/finance/recurring-cost";
import {
  getPeriodBounds,
  summarizeContributions,
  type PeriodCalendarCosts,
  type PeriodContribution,
  type SavedWorkDay,
  type SummaryPeriod,
} from "@/lib/finance/weekly-summary";

export interface ManualPeriodValues {
  cardEarnings: number;
  cashEarnings: number;
  applicationCommission: number | null;
  compensations: number;
  appTips: number;
  cashTips: number;
  privateEarnings: number;
  workedDays: number;
  hoursWorked: number;
  kilometers: number;
  energyCost: number;
  washingCost: number;
  parkingCost: number;
  roadTollCost: number;
  serviceCost: number;
  otherCost: number;
}

export interface SavedManualPeriod {
  id: string;
  periodType: SummaryPeriod;
  startDate: string;
  endDate: string;
  values: ManualPeriodValues;
  result: FinancialResult;
  contribution: PeriodContribution;
}

interface PeriodSummaryPanelProps {
  config: OnboardingConfig;
  periodType: SummaryPeriod;
  anchorDate: string;
  savedDays: SavedWorkDay[];
  manualPeriods: SavedManualPeriod[];
  onSaveManualPeriod: (entry: SavedManualPeriod) => void;
}

const emptyValues: ManualPeriodValues = {
  cardEarnings: 0,
  cashEarnings: 0,
  applicationCommission: null,
  compensations: 0,
  appTips: 0,
  cashTips: 0,
  privateEarnings: 0,
  workedDays: 0,
  hoursWorked: 0,
  kilometers: 0,
  energyCost: 0,
  washingCost: 0,
  parkingCost: 0,
  roadTollCost: 0,
  serviceCost: 0,
  otherCost: 0,
};

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

function contributionFromDay(day: SavedWorkDay): PeriodContribution {
  return {
    startDate: day.date,
    endDate: day.date,
    cardEarnings: day.cardEarnings,
    cashEarnings: day.cashEarnings,
    applicationCommission: day.applicationCommission,
    compensations: day.compensations,
    appTips: day.appTips,
    cashTips: day.cashTips,
    privateEarnings: day.privateEarnings,
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
  const [values, setValues] = useState<ManualPeriodValues>(existing?.values ?? emptyValues);
  const set = <Key extends keyof ManualPeriodValues>(key: Key, value: ManualPeriodValues[Key]) => setValues((current) => ({ ...current, [key]: value }));
  const oneOffCosts = values.washingCost + values.parkingCost + values.roadTollCost + values.serviceCost + values.otherCost;
  const canCalculate = values.applicationCommission !== null;
  const result = canCalculate
    ? calculateFinancialResult({
        cardEarnings: values.cardEarnings,
        cashEarnings: values.cashEarnings,
        applicationCommission: values.applicationCommission,
        compensations: values.compensations,
        appTips: values.appTips,
        cashTips: values.cashTips,
        privateEarnings: values.privateEarnings,
        kilometers: values.kilometers,
        energyCost: values.energyCost,
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
      id: `${periodType}:${startDate}:${endDate}`,
      periodType,
      startDate,
      endDate,
      values,
      result,
      contribution: {
        startDate,
        endDate,
        cardEarnings: values.cardEarnings,
        cashEarnings: values.cashEarnings,
        applicationCommission: result.applicationCommission,
        compensations: values.compensations,
        appTips: values.appTips,
        cashTips: values.cashTips,
        privateEarnings: values.privateEarnings,
        totalEarnings: result.totalEarnings,
        energyCost: result.energyCost,
        fleetCommission: result.fleetCommission,
        oneOffCosts: result.oneOffCosts,
        resultBeforeCalendarCosts: roundMoney(result.result + result.cimCost + result.recurringCosts),
        fleetBalanceBeforeCalendarCosts: roundMoney(result.fleetBalance - result.cimCost - calendarCosts.recurringFleetCosts),
        hoursWorked: values.hoursWorked,
        kilometers: values.kilometers,
      },
    });
  };

  return (
    <form className="manual-period-form" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="section-block"><legend>Încasările perioadei</legend><p className="section-help">Completează totalurile exacte pentru întreaga {periodType === "week" ? "săptămână" : "lună"}. Câmpurile pornesc goale.</p><div className="field-grid">
        <NumberField label="Încasări card din curse" value={values.cardEarnings} onChange={(value) => set("cardEarnings", value)} />
        <NumberField label="Încasări cash din curse" value={values.cashEarnings} onChange={(value) => set("cashEarnings", value)} />
        <label className="field"><span>Comisionul oprit de aplicație</span><span className="input-wrap"><input type="number" min="0" step="0.01" required value={values.applicationCommission ?? ""} placeholder="Suma exactă din aplicație" onChange={(event) => set("applicationCommission", event.target.value === "" ? null : Number(event.target.value))} /><small>RON</small></span></label>
        <NumberField label="Compensări / campanii / taxe de anulare" value={values.compensations} onChange={(value) => set("compensations", value)} />
        <NumberField label="Tips prin aplicație/card" value={values.appTips} onChange={(value) => set("appTips", value)} />
        <NumberField label="Tips cash" value={values.cashTips} onChange={(value) => set("cashTips", value)} />
        <NumberField label="Curse private" value={values.privateEarnings} onChange={(value) => set("privateEarnings", value)} />
      </div></fieldset>

      <fieldset className="section-block"><legend>Activitatea și combustibilul perioadei</legend><div className="field-grid">
        <NumberField label="Zile lucrate" value={values.workedDays} onChange={(value) => set("workedDays", value)} suffix="zile" step="1" />
        <NumberField label="Ore lucrate" value={values.hoursWorked} onChange={(value) => set("hoursWorked", value)} suffix="ore" step="0.25" />
        <NumberField label="Kilometri parcurși" value={values.kilometers} onChange={(value) => set("kilometers", value)} suffix="km" />
        <NumberField label="Cost combustibil / energie consumată" value={values.energyCost} onChange={(value) => set("energyCost", value)} />
      </div><p className="helper">Introdu costul consumat în perioadă, nu valoarea integrală a unui plin rămas în rezervor.</p></fieldset>

      <fieldset className="section-block"><legend>Cheltuieli apărute în perioadă</legend><p className="section-help">Lasă necompletate costurile care nu au existat.</p><div className="field-grid">
        <NumberField label="Spălătorie" value={values.washingCost} onChange={(value) => set("washingCost", value)} />
        <NumberField label="Parcare" value={values.parkingCost} onChange={(value) => set("parkingCost", value)} />
        <NumberField label="Taxe de drum / pod" value={values.roadTollCost} onChange={(value) => set("roadTollCost", value)} />
        <NumberField label="Service / revizii" value={values.serviceCost} onChange={(value) => set("serviceCost", value)} />
        <NumberField label="Alte taxe / costuri pe traseu" value={values.otherCost} onChange={(value) => set("otherCost", value)} />
      </div></fieldset>

      <div className="save-day-panel"><div><strong>{existing ? "Actualizează perioada introdusă" : "Salvează perioada"}</strong><span>Detaliile rămân separate și pot fi folosite în centralizarea lunii.</span></div><button type="button" onClick={save} disabled={!canCalculate}>{existing ? "Actualizează" : `Salvează ${periodType === "week" ? "săptămâna" : "luna"}`}</button>{!canCalculate ? <p>Comisionul exact oprit de aplicație este obligatoriu.</p> : null}</div>
    </form>
  );
}

export function PeriodSummaryPanel({ config, periodType, anchorDate, savedDays, manualPeriods, onSaveManualPeriod }: PeriodSummaryPanelProps) {
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
  const fleetMessage = summary.totalFleetBalance === 0 ? "Regularizarea cu flota este 0 RON." : formatFleetAlert(summary.totalFleetBalance);

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
            <div><dt>Încasări card din curse</dt><dd>{money(summary.totalCardEarnings)} RON</dd></div>
            <div><dt>Încasări cash din curse</dt><dd>{money(summary.totalCashEarnings)} RON</dd></div>
            <div><dt>Comision oprit de aplicație</dt><dd>− {money(summary.totalApplicationCommission)} RON</dd></div>
            <div><dt>Compensări / campanii</dt><dd>{money(summary.totalCompensations)} RON</dd></div>
            <div><dt>Tips prin aplicație/card</dt><dd>{money(summary.totalAppTips)} RON</dd></div>
            <div><dt>Tips cash</dt><dd>{money(summary.totalCashTips)} RON</dd></div>
            <div><dt>Curse private</dt><dd>{money(summary.totalPrivateEarnings)} RON</dd></div>
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
          <section className={`fleet-card ${summary.totalFleetBalance > 0 ? "owes" : "receives"}`}><p className="eyebrow">Regularizarea {periodLabel}</p><h2>{fleetMessage}</h2><p>Cash-ul și tips-ul cash rămân la șofer; soldul folosește numai sumele gestionate prin flotă și costurile datorate flotei.</p></section>
        </> : <section className="breakdown-card empty-period-card"><p className="eyebrow">Centralizare</p><h2>Completează datele perioadei</h2><p>Rezultatul apare numai după introducerea comisionului exact oprit de aplicație și salvarea perioadei.</p></section>}
        <p className="preview-note">Datele sunt păstrate momentan în această previzualizare. Salvarea permanentă în cont va fi activată după migrarea sigură a bazei Supabase.</p>
      </aside>
    </section>
  );
}
