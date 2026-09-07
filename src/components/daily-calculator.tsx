"use client";

import { useMemo, useState } from "react";
import {
  energyUnit,
  fuelLabels,
  platformLabels,
  usesDirectPhevCosts,
  type OnboardingConfig,
} from "@/domain/onboarding";
import {
  calculateDailyResult,
  formatFleetAlert,
  formatResultAlert,
  roundMoney,
} from "@/lib/finance/daily-result";
import {
  allocateRecurringCosts,
  allocateRecurringCostsForRange,
  inclusiveDays,
} from "@/lib/finance/recurring-cost";
import {
  getPeriodBounds,
  summarizePeriod,
  upsertSavedWorkDay,
  type SavedWorkDay,
  type SummaryPeriod,
} from "@/lib/finance/weekly-summary";
import { BrandMark } from "./brand-mark";
import {
  PeriodSummaryPanel,
  type SavedManualPeriod,
} from "./period-summary-panel";
import "./daily-calculator.css";

function todayInRomania() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
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
  }).format(new Date(`${value}T00:00:00Z`));
}

function NumberField({ label, value, onChange, suffix = "RON", step = "0.01", className = "" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: string; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span><span className="input-wrap"><input type="number" min="0" step={step} value={value === 0 ? "" : value} onChange={(event) => onChange(Number(event.target.value))} /><small>{suffix}</small></span></label>;
}

function DailyExpenseQuestion({ question, label, enabled, value, onToggle, onChange }: { question: string; label: string; enabled: boolean; value: number; onToggle: (enabled: boolean) => void; onChange: (value: number) => void }) {
  return (
    <div className={`expense-question ${enabled ? "enabled" : ""}`}>
      <label className="expense-question-toggle">
        <input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} />
        <span>{question}</span>
      </label>
      {enabled ? <NumberField label={label} value={value} onChange={onChange} /> : null}
    </div>
  );
}

export function DailyCalculator({ config, onEditOnboarding }: { config: OnboardingConfig; onEditOnboarding: () => void }) {
  const [date, setDate] = useState(todayInRomania);
  const [activePeriod, setActivePeriod] = useState<"day" | SummaryPeriod>("day");
  const [cardEarnings, setCardEarnings] = useState(0);
  const [cashEarnings, setCashEarnings] = useState(0);
  const [applicationCommission, setApplicationCommission] = useState<number | null>(null);
  const [compensations, setCompensations] = useState(0);
  const [appTips, setAppTips] = useState(0);
  const [cashTips, setCashTips] = useState(0);
  const [privateEarnings, setPrivateEarnings] = useState(0);
  const [kilometers, setKilometers] = useState(0);
  const [hoursWorked, setHoursWorked] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [gasolineCost, setGasolineCost] = useState(0);
  const [electricCost, setElectricCost] = useState(0);
  const [washedToday, setWashedToday] = useState(false);
  const [washingCost, setWashingCost] = useState(0);
  const [paidParkingToday, setPaidParkingToday] = useState(false);
  const [parkingCost, setParkingCost] = useState(0);
  const [paidRoadTollToday, setPaidRoadTollToday] = useState(false);
  const [roadTollCost, setRoadTollCost] = useState(0);
  const [hadServiceToday, setHadServiceToday] = useState(false);
  const [serviceCost, setServiceCost] = useState(0);
  const [hadOtherRouteCostToday, setHadOtherRouteCostToday] = useState(false);
  const [otherPointCost, setOtherPointCost] = useState(0);
  const [savedDays, setSavedDays] = useState<SavedWorkDay[]>([]);
  const [manualPeriods, setManualPeriods] = useState<SavedManualPeriod[]>([]);
  const [lastSavedDate, setLastSavedDate] = useState<string | null>(null);

  const recurringCosts = useMemo(
    () => allocateRecurringCosts(config.recurringCosts, date),
    [config.recurringCosts, date],
  );
  const recurringDailyTotal = recurringCosts.reduce((sum, cost) => sum + cost.dailyAmount, 0);
  const recurringFleetTotal = recurringCosts.filter((cost) => cost.paidToFleet).reduce((sum, cost) => sum + cost.dailyAmount, 0);
  const pointCosts = [
    ["Spălare auto", washedToday ? washingCost : 0],
    ["Parcare", paidParkingToday ? parkingCost : 0],
    ["Taxe de drum / pod", paidRoadTollToday ? roadTollCost : 0],
    ["Service / revizii", hadServiceToday ? serviceCost : 0],
    ["Alte taxe / costuri pe traseu", hadOtherRouteCostToday ? otherPointCost : 0],
  ] as const;
  const oneOffDailyTotal = pointCosts.reduce((sum, [, amount]) => sum + Math.max(0, amount), 0);
  const directPhevCosts = usesDirectPhevCosts(config);
  const consumedToday = directPhevCosts
    ? null
    : (Math.max(0, kilometers) * Math.max(0, config.consumptionPer100Km)) / 100;
  const calculatedEnergyCost = directPhevCosts
    ? Math.max(0, gasolineCost) + Math.max(0, electricCost)
    : (consumedToday ?? 0) * Math.max(0, unitPrice);

  const result = calculateDailyResult({
    cardEarnings,
    cashEarnings,
    applicationCommission,
    compensations,
    appTips,
    cashTips,
    privateEarnings,
    kilometers,
    energy: directPhevCosts
      ? { type: "phev", gasolineCost, electricCost }
      : {
          type: "calculated",
          consumptionPer100Km: config.consumptionPer100Km,
          unitPrice,
        },
    fleetCommission: config.fleetCommission,
    weeklyCimCost: config.weeklyCimCost,
    recurringDailyCosts: recurringDailyTotal,
    recurringFleetCosts: recurringFleetTotal,
    oneOffDailyCosts: oneOffDailyTotal,
  });
  const canCalculate = applicationCommission !== null && Number.isFinite(applicationCommission);
  const resultPerHour = canCalculate && hoursWorked > 0 ? result.result / hoursWorked : null;
  const applicationCommissionLabel = "Comisionul oprit de aplicație";
  const weeklyBounds = getPeriodBounds(date, "week");
  const weeklyRecurringCosts = allocateRecurringCostsForRange(
    config.recurringCosts,
    weeklyBounds.startDate,
    weeklyBounds.endDate,
  );
  const weeklySummary = summarizePeriod(savedDays, date, "week", {
    cimCost: roundMoney(
      (config.weeklyCimCost / 7) *
        inclusiveDays(weeklyBounds.startDate, weeklyBounds.endDate),
    ),
    recurringCosts: roundMoney(
      weeklyRecurringCosts.reduce((sum, cost) => sum + cost.periodAmount, 0),
    ),
    recurringFleetCosts: roundMoney(
      weeklyRecurringCosts
        .filter((cost) => cost.paidToFleet)
        .reduce((sum, cost) => sum + cost.periodAmount, 0),
    ),
  });
  const saveDayInWeek = () => {
    if (!canCalculate) return;
    setSavedDays((current) =>
      upsertSavedWorkDay(current, {
        date,
        cardEarnings,
        cashEarnings,
        applicationCommission: result.applicationCommission,
        compensations,
        appTips,
        cashTips,
        privateEarnings,
        result: result.result,
        resultBeforeCalendarCosts: roundMoney(
          result.result + result.cimCost + result.recurringCosts,
        ),
        fleetBalance: result.fleetBalance,
        fleetBalanceBeforeCalendarCosts: roundMoney(
          result.fleetBalance - result.cimCost - recurringFleetTotal,
        ),
        totalEarnings: result.totalEarnings,
        energyCost: result.energyCost,
        fleetCommission: result.fleetCommission,
        oneOffCosts: result.oneOffCosts,
        hoursWorked,
        kilometers,
      }),
    );
    setLastSavedDate(date);
  };
  const saveManualPeriod = (entry: SavedManualPeriod) => {
    setManualPeriods((current) => [
      ...current.filter((item) => item.id !== entry.id),
      entry,
    ]);
  };

  const title = activePeriod === "day"
    ? "Adaugă o zi de lucru"
    : activePeriod === "week"
      ? "Centralizarea săptămânii"
      : "Centralizarea lunii";
  const dateLabel = activePeriod === "day"
    ? "Data activității"
    : activePeriod === "week"
      ? "Alege o zi din săptămână"
      : "Alege luna";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="ProfitExact — început"><BrandMark className="brand-mark" /><span>ProfitExact</span></a>
        <span className="profile-pill">Ridesharing · Angajat</span>
      </header>

      <section className="intro" id="top">
        <div><p className="eyebrow">Introducere și centralizare</p><h1>{title}</h1><p className="lead">Configurația din onboarding se aplică automat calculelor.</p></div>
        <div className="date-block"><label htmlFor="work-date">{dateLabel}</label><input id="work-date" type={activePeriod === "month" ? "month" : "date"} value={activePeriod === "month" ? date.slice(0, 7) : date} onChange={(event) => setDate(activePeriod === "month" ? `${event.target.value}-01` : event.target.value)} /></div>
      </section>

      <section className="config-strip">
        <div><span>Platformă</span><strong>{platformLabels[config.platform]}</strong></div>
        <div><span>Oraș</span><strong>{config.cityName}</strong></div>
        <div><span>Vehicul</span><strong>{config.vehicleOwnership === "owned" ? "Personal" : "Închiriat"}</strong></div>
        <div><span>Combustibil</span><strong>{fuelLabels[config.fuelType]}{config.hybridType ? ` · ${config.hybridType.toUpperCase()}` : ""}</strong></div>
        <button type="button" onClick={onEditOnboarding}>Modifică onboarding-ul</button>
      </section>

      <nav className="period-tabs segmented" aria-label="Perioada calculului">
        <button type="button" className={activePeriod === "day" ? "selected" : ""} onClick={() => setActivePeriod("day")}>Zilnic</button>
        <button type="button" className={activePeriod === "week" ? "selected" : ""} onClick={() => setActivePeriod("week")}>Săptămânal</button>
        <button type="button" className={activePeriod === "month" ? "selected" : ""} onClick={() => setActivePeriod("month")}>Lunar</button>
      </nav>

      {activePeriod === "day" ? <section className="workspace" aria-label="Calculator zilnic">
        <form className="form-card" onSubmit={(event) => event.preventDefault()}>
          <fieldset className="section-block"><legend>Încasări {platformLabels[config.platform]}</legend><div className="field-grid">
            <NumberField label="Încasări card din curse" value={cardEarnings} onChange={setCardEarnings} />
            <NumberField label="Încasări cash din curse" value={cashEarnings} onChange={setCashEarnings} />
            <label className="field"><span>Comisionul oprit de aplicație</span><span className="input-wrap"><input type="number" min="0" step="0.01" required value={applicationCommission ?? ""} placeholder="Suma din aplicație" onChange={(event) => setApplicationCommission(event.target.value === "" ? null : Number(event.target.value))} /><small>RON</small></span></label>
            <NumberField label="Compensări" value={compensations} onChange={setCompensations} />
            <NumberField label="Tips prin aplicație/card" value={appTips} onChange={setAppTips} />
            <NumberField label="Tips cash" value={cashTips} onChange={setCashTips} />
            <NumberField label="Curse private" value={privateEarnings} onChange={setPrivateEarnings} />
          </div></fieldset>

          <fieldset className="section-block"><legend>Activitatea, kilometrii și combustibilul</legend><p className="section-help">Orele și kilometrii se completează în fiecare zi lucrată, indiferent dacă mașina este personală sau închiriată.</p><div className="field-grid activity-grid">
            <NumberField className="kilometers-field" label="Câți kilometri ai parcurs pentru activitate azi?" value={kilometers} onChange={setKilometers} suffix="km" step="0.01" />
            <NumberField className="hours-field" label="Câte ore ai lucrat azi?" value={hoursWorked} onChange={setHoursWorked} suffix="ore" step="0.25" />
            {directPhevCosts ? <><NumberField label="Cost benzină folosită azi" value={gasolineCost} onChange={setGasolineCost} /><NumberField label="Cost energie electrică folosită azi" value={electricCost} onChange={setElectricCost} /></> : <><div className="readonly-field"><span>Consum configurat</span><strong>{config.consumptionPer100Km.toLocaleString("ro-RO")} {config.fuelType === "electric" ? "kWh" : "litri"}/100 km</strong></div><NumberField label={`Prețul din ziua respectivă / ${energyUnit(config)}`} value={unitPrice} onChange={setUnitPrice} suffix={`RON/${energyUnit(config)}`} /><div className="calculation-preview"><div><span>{config.fuelType === "electric" ? "Energie calculată azi" : "Combustibil calculat azi"}</span><strong>{(consumedToday ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {config.fuelType === "electric" ? "kWh" : "litri"}</strong></div><div><span>Cheltuială calculată</span><strong>{money(calculatedEnergyCost)} RON</strong></div></div></>}
          </div></fieldset>

          <fieldset className="section-block"><legend>Cheltuieli apărute azi</legend><p className="section-help">Răspunde numai la situațiile care au existat astăzi. Costurile recurente din onboarding se adaugă automat.</p><div className="expense-questions">
            <DailyExpenseQuestion question="Ai spălat mașina azi?" label="Suma plătită la spălătorie" enabled={washedToday} value={washingCost} onToggle={(enabled) => { setWashedToday(enabled); if (!enabled) setWashingCost(0); }} onChange={setWashingCost} />
            <DailyExpenseQuestion question="Ai plătit parcare azi?" label="Suma plătită pentru parcare" enabled={paidParkingToday} value={parkingCost} onToggle={(enabled) => { setPaidParkingToday(enabled); if (!enabled) setParkingCost(0); }} onChange={setParkingCost} />
            <DailyExpenseQuestion question="Ai plătit o taxă de drum sau pod azi?" label="Suma taxelor de drum sau pod" enabled={paidRoadTollToday} value={roadTollCost} onToggle={(enabled) => { setPaidRoadTollToday(enabled); if (!enabled) setRoadTollCost(0); }} onChange={setRoadTollCost} />
            <DailyExpenseQuestion question="Ai avut o cheltuială de service sau revizie azi?" label="Suma plătită la service" enabled={hadServiceToday} value={serviceCost} onToggle={(enabled) => { setHadServiceToday(enabled); if (!enabled) setServiceCost(0); }} onChange={setServiceCost} />
            <DailyExpenseQuestion question="Ai avut altă taxă sau cheltuială pe traseu azi?" label="Suma plătită — de exemplu acces aeroport" enabled={hadOtherRouteCostToday} value={otherPointCost} onToggle={(enabled) => { setHadOtherRouteCostToday(enabled); if (!enabled) setOtherPointCost(0); }} onChange={setOtherPointCost} />
          </div><p className="helper">Service-ul va fi păstrat și în jurnal cu data, kilometrajul și descrierea intervenției.</p></fieldset>
          <div className="save-day-panel"><div><strong>Centralizează ziua în săptămână</strong><span>Dacă revii la aceeași dată și salvezi din nou, ziua este actualizată, nu dublată.</span></div><button type="button" onClick={saveDayInWeek} disabled={!canCalculate}>Salvează ziua în săptămână</button>{!canCalculate ? <p>Introdu comisionul oprit de aplicație pentru a calcula și salva ziua.</p> : null}{lastSavedDate === date ? <p>Ziua de {shortDate(date)} este inclusă în totalul săptămânii.</p> : null}</div>
        </form>

        <aside className="result-column" aria-live="polite">
          <section className={`result-card ${canCalculate ? (result.result < 0 ? "negative" : "positive") : ""}`}>{canCalculate ? <><p className="result-label">Îți rămân azi</p><p className="result-value">{money(result.result)} RON</p><p className="result-alert">{formatResultAlert(result)}</p></> : <><p className="result-label">Calculul nu este gata</p><p className="result-alert">Introdu suma exactă oprită de aplicație pentru această zi.</p></>}</section>
          {canCalculate ? <section className="breakdown-card"><div className="card-heading"><div><p className="eyebrow">Calcul transparent</p><h2>Detaliile zilei</h2></div><span>{date}</span></div><dl className="breakdown-list">
            <div><dt>Încasări brute</dt><dd>{money(result.grossPlatformEarnings)} RON</dd></div>
            <div><dt>{applicationCommissionLabel}</dt><dd>− {money(result.applicationCommission)} RON</dd></div>
            <div><dt>Total câștiguri</dt><dd>{money(result.totalEarnings)} RON</dd></div>
            <div><dt>Ore lucrate</dt><dd>{hoursWorked.toLocaleString("ro-RO")} ore</dd></div>
            {resultPerHour !== null ? <div><dt>Câștig după cheltuieli / oră</dt><dd>{money(resultPerHour)} RON</dd></div> : null}
            <div><dt>Combustibil / energie</dt><dd>− {money(result.energyCost)} RON</dd></div>
            <div><dt>Comision flotă</dt><dd>− {money(result.fleetCommission)} RON</dd></div>
            <div><dt>CIM alocat zilei (÷ 7)</dt><dd>− {money(result.dailyCimCost)} RON</dd></div>
            {recurringCosts.map((cost) => <div key={cost.id}><dt>{cost.label} · alocat/zi</dt><dd>− {money(cost.dailyAmount)} RON</dd></div>)}
            {pointCosts.filter(([, amount]) => amount > 0).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>− {money(amount)} RON</dd></div>)}
            <div className="total-row"><dt>Total cheltuieli</dt><dd>− {money(result.totalExpenses)} RON</dd></div>
          </dl></section> : <section className="breakdown-card"><p className="eyebrow">Calcul transparent</p><h2>Detaliile apar după completare</h2><p>Nu folosim automat procentul de 25%. Introdu suma „Comisionul oprit de aplicație” din aplicația Bolt sau din screenshot.</p></section>}
          {canCalculate ? <section className={`fleet-card ${result.fleetBalance > 0 ? "owes" : "receives"}`}><p className="eyebrow">Regularizarea zilei</p><h2>{formatFleetAlert(result.fleetBalance)}</h2><p>Valoarea zilei intră în regularizarea săptămânală numai după salvare.</p></section> : null}
          <section className={`weekly-card ${weeklySummary.totalFleetBalance > 0 ? "owes" : "receives"}`}><p className="eyebrow">Regularizarea săptămânii</p><p className="weekly-range">{shortDate(weeklySummary.startDate)} – {shortDate(weeklySummary.endDate)}</p><h2>{weeklySummary.days.length ? formatFleetAlert(weeklySummary.totalFleetBalance) : "Nicio zi salvată încă"}</h2><div className="weekly-metrics"><div><span>Zile</span><strong>{weeklySummary.days.length}</strong></div><div><span>Ore</span><strong>{weeklySummary.totalHours.toLocaleString("ro-RO")}</strong></div><div><span>Kilometri</span><strong>{weeklySummary.totalKilometers.toLocaleString("ro-RO")}</strong></div><div><span>Îți rămân</span><strong>{money(weeklySummary.totalResult)} RON</strong></div></div>{weeklySummary.days.length ? <div className="saved-days">{weeklySummary.days.map((day) => <span key={day.date}>{shortDate(day.date)} · {day.hoursWorked.toLocaleString("ro-RO")} ore</span>)}</div> : <p className="weekly-empty">Salvează fiecare zi lucrată; soldul pentru plată se actualizează pe toată săptămâna luni–duminică.</p>}</section>
          <p className="preview-note">Această versiune verifică fluxul și formulele. Salvarea în cont urmează după conectarea proiectului Supabase.</p>
        </aside>
      </section> : <PeriodSummaryPanel config={config} periodType={activePeriod} anchorDate={date} savedDays={savedDays} manualPeriods={manualPeriods} onSaveManualPeriod={saveManualPeriod} />}
    </main>
  );
}
