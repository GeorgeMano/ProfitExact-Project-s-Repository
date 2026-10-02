"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import {
  calculatePlatformBreakdown,
  combinePlatformEntries,
  emptyPlatformEntry,
  hasRequiredEarnings,
  missingEarningsMessage,
  platformsFor,
  type PlatformEnergyBasis,
  type PlatformEntryInput,
} from "@/lib/finance/platform-entry";
import {
  getPeriodBounds,
  summarizePeriod,
  toSavedPlatformEntry,
  type SavedWorkDay,
  type SummaryPeriod,
} from "@/lib/finance/weekly-summary";
import type { WorkspaceMode } from "@/lib/persistence/workspace-repository";
import { BrandMark } from "./brand-mark";
import { PeriodSummaryPanel } from "./period-summary-panel";
import { FleetSettlement } from "./fleet-settlement";
import { OtherEarningsFields, PlatformEarningsFields, platformEarningsHelp } from "./platform-earnings-fields";
import "./daily-calculator.css";

/** Ce se întâmplă acum cu datele introduse — afișat în locul promisiunii vechi. */
function persistenceNoteFor(mode: WorkspaceMode) {
  if (mode === "account") {
    return "Datele sunt salvate în contul tău și rămân disponibile la următoarea conectare.";
  }

  if (mode === "demo") {
    return "Mod de depanare local: datele sunt salvate pe acest calculator și rezistă la reîncărcarea paginii. Nu ajung în contul online.";
  }

  return "Datele rămân numai în această pagină. Salvarea permanentă se activează după conectarea la un cont.";
}

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

interface DailyCalculatorProps {
  config: OnboardingConfig;
  savedDays: SavedWorkDay[];
  manualPeriods: SavedManualPeriod[];
  persistenceMode: WorkspaceMode;
  persistenceWarnings: string[];
  onSaveDay: (day: SavedWorkDay) => void;
  onSaveManualPeriod: (entry: SavedManualPeriod) => void;
  onEditOnboarding: () => void;
  onStartOver: () => void;
}

export function DailyCalculator({
  config,
  savedDays,
  manualPeriods,
  persistenceMode,
  persistenceWarnings,
  onSaveDay,
  onSaveManualPeriod,
  onEditOnboarding,
  onStartOver,
}: DailyCalculatorProps) {
  const [date, setDate] = useState(todayInRomania);
  const [activePeriod, setActivePeriod] = useState<"day" | SummaryPeriod>("day");
  const platformKeys = useMemo(() => platformsFor(config.platform), [config.platform]);
  const [platformEntries, setPlatformEntries] = useState<PlatformEntryInput[]>(() =>
    platformKeys.map(emptyPlatformEntry),
  );
  const [sharedKilometers, setSharedKilometers] = useState(0);
  const [privateEarnings, setPrivateEarnings] = useState(0);
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
  const [lastSavedDate, setLastSavedDate] = useState<string | null>(null);

  // Data pe care o reflectă formularul în acest moment. Ține evidența ca
  // salvarea unei zile să nu declanșeze o reîncărcare peste ce tocmai s-a scris.
  const loadedDateRef = useRef<string | null>(null);

  const savedDayForDate = savedDays.find((day) => day.date === date) ?? null;

  // Schimbarea datei aduce în formular ziua salvată pentru ea, dacă există,
  // altfel golește câmpurile. Ziua devine astfel corectabilă, nu doar adăugabilă.
  useEffect(() => {
    if (activePeriod !== "day") return;
    if (loadedDateRef.current === date) return;
    loadedDateRef.current = date;

    const saved = savedDays.find((day) => day.date === date);
    const inputs = saved?.inputs;

    setPlatformEntries(
      platformKeys.map((platform) => {
        const entry = saved?.platforms?.find((item) => item.platform === platform);
        return entry
          ? {
              platform,
              appRidePayments: entry.appRidePayments,
              campaigns: entry.campaigns,
              cancellationFees: entry.cancellationFees,
              appTips: entry.appTips,
              cashRidePayments: entry.cashRidePayments,
              userCredits: entry.userCredits,
              platformCosts: entry.platformCosts,
              applicationCommission: entry.applicationCommission,
              cashTips: entry.cashTips,
              kilometers: entry.kilometers,
            }
          : emptyPlatformEntry(platform);
      }),
    );

    setPrivateEarnings(saved?.privateEarnings ?? 0);
    setHoursWorked(saved?.hoursWorked ?? 0);
    setSharedKilometers(inputs?.sharedKilometers ?? saved?.kilometers ?? 0);
    setUnitPrice(inputs?.unitPrice ?? 0);
    setGasolineCost(inputs?.gasolineCost ?? 0);
    setElectricCost(inputs?.electricCost ?? 0);

    setWashingCost(inputs?.washingCost ?? 0);
    setWashedToday((inputs?.washingCost ?? 0) > 0);
    setParkingCost(inputs?.parkingCost ?? 0);
    setPaidParkingToday((inputs?.parkingCost ?? 0) > 0);
    setRoadTollCost(inputs?.roadTollCost ?? 0);
    setPaidRoadTollToday((inputs?.roadTollCost ?? 0) > 0);
    setServiceCost(inputs?.serviceCost ?? 0);
    setHadServiceToday((inputs?.serviceCost ?? 0) > 0);
    setOtherPointCost(inputs?.otherCost ?? 0);
    setHadOtherRouteCostToday((inputs?.otherCost ?? 0) > 0);
  }, [activePeriod, date, savedDays, platformKeys]);

  // Dacă utilizatorul schimbă platformele din onboarding, câmpurile se refac.
  useEffect(() => {
    setPlatformEntries((current) => {
      const unchanged =
        current.length === platformKeys.length &&
        current.every((entry, index) => entry.platform === platformKeys[index]);
      return unchanged ? current : platformKeys.map(emptyPlatformEntry);
    });
  }, [platformKeys]);

  const updateEntry = <Key extends keyof PlatformEntryInput>(
    index: number,
    key: Key,
    value: PlatformEntryInput[Key],
  ) => {
    setPlatformEntries((current) =>
      current.map((entry, position) =>
        position === index ? { ...entry, [key]: value } : entry,
      ),
    );
  };

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
  // Modul „un singur total” are sens numai pe două platforme; pe una singură
  // kilometrii sunt oricum ai ei.
  const usesSharedKilometers =
    config.kilometerEntry === "shared" && platformEntries.length > 1;
  const sharedKilometerInput = usesSharedKilometers ? sharedKilometers : null;
  const combined = combinePlatformEntries(platformEntries, sharedKilometerInput);
  const kilometers = combined.kilometers;
  const consumedToday = directPhevCosts
    ? null
    : (Math.max(0, kilometers) * Math.max(0, config.consumptionPer100Km)) / 100;
  const calculatedEnergyCost = directPhevCosts
    ? Math.max(0, gasolineCost) + Math.max(0, electricCost)
    : (consumedToday ?? 0) * Math.max(0, unitPrice);

  const energyBasis: PlatformEnergyBasis = directPhevCosts
    ? { type: "phev", gasolineCost, electricCost }
    : {
        type: "calculated",
        consumptionPer100Km: config.consumptionPer100Km,
        unitPrice,
      };

  const result = calculateDailyResult({
    ...combined,
    privateEarnings,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    weeklyCimCost: config.weeklyCimCost,
    recurringDailyCosts: recurringDailyTotal,
    recurringFleetCosts: recurringFleetTotal,
    oneOffDailyCosts: oneOffDailyTotal,
  });

  // Defalcarea pe platformă: aceleași cifre, privite pe fiecare aplicație.
  // Suma rezultatelor de mai jos plus cursele private, minus cheltuielile
  // comune, dă exact profitul zilei — vezi platform-entry.test.ts.
  const breakdown = calculatePlatformBreakdown({
    entries: platformEntries,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    sharedKilometers: sharedKilometerInput,
  });
  const showSeparateView =
    config.profitView === "separate" && platformEntries.length > 1;
  const canCalculate = hasRequiredEarnings(platformEntries);
  const missingMessage = missingEarningsMessage();
  const resultPerHour = canCalculate && hoursWorked > 0 ? result.result / hoursWorked : null;
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
    onSaveDay({
      date,
      // `breakdown` păstrează ordinea din `platformEntries`, deci indexul
      // leagă valorile introduse de cele calculate.
      platforms: breakdown.map((item, index) =>
        toSavedPlatformEntry(platformEntries[index], item),
      ),
      // Tot ce a fost introdus, ca ziua să poată fi reconstituită și corectată.
      inputs: {
        sharedKilometers,
        unitPrice,
        gasolineCost,
        electricCost,
        washingCost: washedToday ? washingCost : 0,
        parkingCost: paidParkingToday ? parkingCost : 0,
        roadTollCost: paidRoadTollToday ? roadTollCost : 0,
        serviceCost: hadServiceToday ? serviceCost : 0,
        otherCost: hadOtherRouteCostToday ? otherPointCost : 0,
      },
      appRevenue: combined.appRevenue,
      cashRevenue: combined.cashRevenue,
      netEarnings: result.platformNetEarnings,
      cashInHand: result.cashInHand,
      applicationCommission: result.applicationCommission,
      platformCosts: result.platformCosts,
      cashTips: combined.cashTips,
      privateEarnings,
      amountManagedByFleet: result.amountManagedByFleet,
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
    });
    setLastSavedDate(date);
  };
  const persistenceNote = persistenceNoteFor(persistenceMode);

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
        <button type="button" className="account-back" onClick={onStartOver}>Șterge datele salvate și reia</button>
      </header>
      {persistenceWarnings.length > 0 ? <ul role="status" style={{ margin: "0 0 1rem", padding: "0.75rem 1rem 0.75rem 2rem", borderRadius: "0.75rem", background: "rgba(255, 176, 32, 0.12)", border: "1px solid rgba(255, 176, 32, 0.35)", fontSize: "0.875rem", lineHeight: 1.5 }}>{persistenceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}

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
          {platformEntries.map((entry, index) => (
            <fieldset className="section-block" key={entry.platform}>
              <legend>{platformLabels[entry.platform]}</legend>
              <p className="section-help">{platformEarningsHelp(platformLabels[entry.platform], "ziua respectivă")}</p>
              <PlatformEarningsFields entry={entry} platformLabel={platformLabels[entry.platform]} showKilometers={!usesSharedKilometers} onChange={(key, value) => updateEntry(index, key, value)} />
            </fieldset>
          ))}

          <fieldset className="section-block"><legend>Alte încasări</legend><p className="section-help">Bani primiți în afara aplicațiilor de ridesharing, cash sau prin transfer. Rămân integral la tine și nu trec prin flotă.</p><OtherEarningsFields value={privateEarnings} onChange={setPrivateEarnings} /></fieldset>

          <fieldset className="section-block"><legend>Activitatea zilei și combustibilul</legend><p className="section-help">{usesSharedKilometers ? "Ai ales un singur total de kilometri. Introdu kilometrii reali ai zilei, cu tot cu drumul până la client și mersul între curse; repartizarea pe platformă se face proporțional cu încasările." : platformEntries.length > 1 ? "Kilometrii zilei sunt suma celor introduși mai sus, pe fiecare aplicație." : "Orele se completează în fiecare zi lucrată, indiferent dacă mașina este personală sau închiriată."}</p><div className="field-grid activity-grid">
            {usesSharedKilometers ? <NumberField className="kilometers-field" label="Câți kilometri ai parcurs azi în total?" value={sharedKilometers} onChange={setSharedKilometers} suffix="km" step="0.01" /> : <div className="readonly-field"><span>Kilometri în total azi</span><strong>{kilometers.toLocaleString("ro-RO")} km</strong></div>}
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
          <div className="save-day-panel"><div><strong>{savedDayForDate ? `Corectezi ziua de ${shortDate(date)}` : "Centralizează ziua în săptămână"}</strong><span>{savedDayForDate ? "Câmpurile sunt completate cu ce ai introdus atunci. Salvarea actualizează ziua, nu adaugă una nouă." : "Dacă revii la aceeași dată și salvezi din nou, ziua este actualizată, nu dublată."}</span></div><button type="button" onClick={saveDayInWeek} disabled={!canCalculate}>{savedDayForDate ? "Actualizează ziua" : "Salvează ziua în săptămână"}</button>{!canCalculate ? <p>{missingMessage}</p> : null}{lastSavedDate === date ? <p>Ziua de {shortDate(date)} este inclusă în totalul săptămânii.</p> : null}</div>
        </form>

        <aside className="result-column" aria-live="polite">
          <section className={`result-card ${canCalculate ? (result.result < 0 ? "negative" : "positive") : ""}`}>{canCalculate ? <><p className="result-label">Îți rămân azi</p><p className="result-value">{money(result.result)} RON</p><p className="result-alert">{formatResultAlert(result)}</p></> : <><p className="result-label">Calculul nu este gata</p><p className="result-alert">{missingMessage}</p></>}</section>
          {canCalculate ? <section className="breakdown-card"><div className="card-heading"><div><p className="eyebrow">Calcul transparent</p><h2>Detaliile zilei</h2></div><span>{date}</span></div><dl className="breakdown-list">
            <div><dt>Venituri în aplicație</dt><dd>{money(combined.appRevenue)} RON</dd></div>
            <div><dt>Venituri în numerar</dt><dd>{money(combined.cashRevenue)} RON</dd></div>
            {result.platformCosts > 0 ? <div><dt>Costuri și taxe</dt><dd>− {money(result.platformCosts)} RON</dd></div> : null}
            <div><dt>Comision aplicație</dt><dd>− {money(result.applicationCommission)} RON</dd></div>
            <div><dt>Câștigurile tale</dt><dd>{money(result.platformNetEarnings)} RON</dd></div>
            {combined.cashTips > 0 ? <div><dt>Bacșiș numerar</dt><dd>{money(combined.cashTips)} RON</dd></div> : null}
            {privateEarnings > 0 ? <div><dt>Curse private / alte încasări</dt><dd>{money(privateEarnings)} RON</dd></div> : null}
            <div><dt>Total câștiguri</dt><dd>{money(result.totalEarnings)} RON</dd></div>
            <div><dt>Ore lucrate</dt><dd>{hoursWorked.toLocaleString("ro-RO")} ore</dd></div>
            {resultPerHour !== null ? <div><dt>Câștig după cheltuieli / oră</dt><dd>{money(resultPerHour)} RON</dd></div> : null}
            <div><dt>Combustibil / energie</dt><dd>− {money(result.energyCost)} RON</dd></div>
            <div><dt>Comision flotă</dt><dd>− {money(result.fleetCommission)} RON</dd></div>
            <div><dt>CIM alocat zilei (÷ 7)</dt><dd>− {money(result.dailyCimCost)} RON</dd></div>
            {recurringCosts.map((cost) => <div key={cost.id}><dt>{cost.label} · alocat/zi</dt><dd>− {money(cost.dailyAmount)} RON</dd></div>)}
            {pointCosts.filter(([, amount]) => amount > 0).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>− {money(amount)} RON</dd></div>)}
            <div className="total-row"><dt>Total cheltuieli</dt><dd>− {money(result.totalExpenses)} RON</dd></div>
          </dl></section> : <section className="breakdown-card"><p className="eyebrow">Calcul transparent</p><h2>Detaliile apar după completare</h2><p>Din motive de siguranță a calculului, comisionul nu se calculează automat: se introduce exact cum l-a calculat platforma de ridesharing în aplicație.</p></section>}
          {canCalculate && showSeparateView ? <section className="breakdown-card platform-breakdown-card"><div className="card-heading"><div><p className="eyebrow">Separat pe platformă</p><h2>Ce a adus fiecare aplicație</h2></div></div><p className="section-help">Se separă doar ce se poate măsura: încasările și comisionul din fiecare aplicație și kilometrii, plus combustibilul care decurge din ei. Cheltuielile comune ale zilei apar mai jos, o singură dată.</p>{breakdown.map((item) => <dl className="breakdown-list" key={item.platform} aria-label={`Detalii ${platformLabels[item.platform]}`}>
            <div className="total-row"><dt>{platformLabels[item.platform]}</dt><dd>{money(item.resultBeforeCommonCosts)} RON</dd></div>
            <div><dt>Câștigurile tale</dt><dd>{money(item.netEarnings)} RON</dd></div>
            <div><dt>Numerar în mână</dt><dd>{money(item.cashInHand)} RON</dd></div>
            <div><dt>Total câștiguri</dt><dd>{money(item.totalEarnings)} RON</dd></div>
            <div><dt>Kilometri</dt><dd>{item.kilometers.toLocaleString("ro-RO")} km</dd></div>
            <div><dt>Combustibil / energie</dt><dd>− {money(item.energyCost)} RON</dd></div>
            <div><dt>Comision flotă</dt><dd>− {money(item.fleetCommission)} RON</dd></div>
            {item.resultPerKm !== null ? <div><dt>Câștig pe kilometru</dt><dd>{money(item.resultPerKm)} RON/km</dd></div> : null}
          </dl>)}<p className="helper">Sumele de mai sus nu includ CIM-ul, chiria, RCA, spălarea sau parcarea: acelea sunt ale zilei și ale mașinii, nu ale unei aplicații. Profitul final al zilei este același, fie că îl privești împreună sau separat.</p></section> : null}
          {canCalculate ? <FleetSettlement title="Regularizarea zilei" balance={result.fleetBalance} amountManagedByFleet={result.amountManagedByFleet} fleetCommission={result.fleetCommission} cimCost={result.cimCost} cimLabel="CIM alocat zilei (÷ 7)" otherFleetCosts={result.recurringFleetCosts} note="Valoarea zilei intră în regularizarea săptămânală numai după salvare." /> : null}
          <section className={`weekly-card ${weeklySummary.totalFleetBalance > 0 ? "owes" : "receives"}`}><p className="eyebrow">Regularizarea săptămânii</p><p className="weekly-range">{shortDate(weeklySummary.startDate)} – {shortDate(weeklySummary.endDate)}</p><h2>{weeklySummary.days.length ? formatFleetAlert(weeklySummary.totalFleetBalance) : "Nicio zi salvată încă"}</h2>{weeklySummary.days.length ? <><div className="weekly-metrics"><div><span>Zile</span><strong>{weeklySummary.days.length}</strong></div><div><span>Ore</span><strong>{weeklySummary.totalHours.toLocaleString("ro-RO")}</strong></div><div><span>Kilometri</span><strong>{weeklySummary.totalKilometers.toLocaleString("ro-RO")}</strong></div><div><span>Îți rămân</span><strong>{money(weeklySummary.totalResult)} RON</strong></div></div><div className="saved-days">{weeklySummary.days.map((day) => <button type="button" key={day.date} className={day.date === date ? "selected" : ""} aria-label={`Deschide ziua de ${shortDate(day.date)}`} onClick={() => { setActivePeriod("day"); setDate(day.date); }}>{shortDate(day.date)} · {day.hoursWorked.toLocaleString("ro-RO")} ore</button>)}</div></> : <p className="weekly-empty">Salvează fiecare zi lucrată; soldul pentru plată se actualizează pe toată săptămâna luni–duminică.</p>}</section>
          <p className="preview-note">{persistenceNote}</p>
        </aside>
      </section> : <PeriodSummaryPanel config={config} periodType={activePeriod} anchorDate={date} savedDays={savedDays} manualPeriods={manualPeriods} onSaveManualPeriod={onSaveManualPeriod} persistenceNote={persistenceNote} />}
    </main>
  );
}
