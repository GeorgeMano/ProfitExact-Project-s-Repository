"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  energyUnit,
  fuelLabels,
  isOwnBusiness,
  isDelivery,
  hasDelivery,
  usesFuel,
  commissionLabel,
  configPlatformsLabel,
  vehicleTypeLabels,
  activityLabels,
  workModeLabel,
  platformLabels,
  usesDirectPhevCosts,
  type OnboardingConfig,
  vehicleShortNames,
  tracksOdometer,
} from "@/domain/onboarding";
import {
  formatFleetAlert,
  formatResultAlert,
} from "@/lib/finance/daily-result";
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import {
  emptyPlatformEntry,
  hasRequiredEarnings,
  missingEarningsMessage,
  platformsForConfig,
  type PlatformEntryInput,
  type PlatformKey,
  isDeliveryPlatform,
} from "@/lib/finance/platform-entry";
import {
  getPeriodBounds,
  summarizeContributions,
  type SavedWorkDay,
  type SummaryPeriod,
} from "@/lib/finance/weekly-summary";
import { resolvePeriod } from "@/lib/finance/period-sources";
import {
  buildSavedWorkDay,
  calculateWorkDay,
  calendarCostsForRange,
  type WorkDayInput,
  sharedKilometersFor,
} from "@/lib/finance/work-day";
import type { WorkspaceMode } from "@/lib/persistence/workspace-repository";
import { BrandMark } from "./brand-mark";
import { PeriodSummaryPanel, type IncomingCapture } from "./period-summary-panel";
import type { ScreenshotReading } from "@/lib/ocr/earnings-screenshot";
import { fillFromDelivery, type DeliveryReading } from "@/lib/ocr/delivery-screenshot";
import { FleetSettlement } from "./fleet-settlement";
import { MobileMenu } from "./mobile-menu";
import { DecimalInput } from "./decimal-input";
import { ActivitySplitCard } from "./activity-split";
import { ServiceAlert, VehicleJournalCard, journalDays } from "./vehicle-journal";
import { serviceKindLabels, serviceKinds, type ServiceKind } from "@/lib/finance/vehicle-service";
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

function NumberField({ label, value, onChange, suffix = "RON", className = "" }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; step?: string; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span><span className="input-wrap"><DecimalInput value={value} onChange={(next) => onChange(next ?? 0)} /><small>{suffix}</small></span></label>;
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
  onDeleteManualPeriod: (id: string) => void;
  onEditOnboarding: () => void;
  onStartOver: () => void;
  onSignOut: () => void | Promise<void>;
}

export function DailyCalculator({
  config,
  savedDays,
  manualPeriods,
  persistenceMode,
  persistenceWarnings,
  onSaveDay,
  onSaveManualPeriod,
  onDeleteManualPeriod,
  onEditOnboarding,
  onStartOver,
  onSignOut,
}: DailyCalculatorProps) {
  const [date, setDate] = useState(todayInRomania);
  const [activePeriod, setActivePeriod] = useState<"day" | SummaryPeriod>("day");
  const platformKeys = useMemo(() => platformsForConfig(config), [config]);
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
  const [serviceKind, setServiceKind] = useState<ServiceKind>("revizie");
  const [serviceNote, setServiceNote] = useState("");
  const [odometerKm, setOdometerKm] = useState(0);
  const [hadOtherRouteCostToday, setHadOtherRouteCostToday] = useState(false);
  const [otherPointCost, setOtherPointCost] = useState(0);
  const [lastSavedDate, setLastSavedDate] = useState<string | null>(null);
  // Captura încărcată din formularul zilei, dar pentru o săptămână sau o lună:
  // formularul acelei perioade se deschide cu rubricile deja completate.
  const [incomingCapture, setIncomingCapture] = useState<IncomingCapture | null>(null);
  const openCaptureForPeriod =
    (platform: PlatformKey) =>
    (period: "week" | "month", reading: ScreenshotReading) => {
      const anchor = reading.period?.startDate ?? date;
      setIncomingCapture({ id: Date.now(), platform, periodType: period, anchorDate: anchor, reading });
      setDate(anchor);
      setActivePeriod(period);
    };
  // La fel pentru aplicațiile de livrări, dar și spre o zi anume.
  const openDeliveryCapture =
    (platform: PlatformKey) =>
    (period: "day" | "week" | "month", anchor: string, reading: DeliveryReading, notes: string[]) => {
      setIncomingCapture({ id: Date.now(), platform, periodType: period, anchorDate: anchor, delivery: { reading, notes } });
      setDate(anchor);
      setActivePeriod(period);
    };
  const incomingDay =
    incomingCapture?.periodType === "day" && incomingCapture.delivery && incomingCapture.anchorDate === date
      ? incomingCapture
      : null;

  // Data pe care o reflectă formularul în acest moment. Ține evidența ca
  // salvarea unei zile să nu declanșeze o reîncărcare peste ce tocmai s-a scris.
  const loadedDateRef = useRef<string | null>(null);
  const appliedCaptureRef = useRef<number | null>(null);

  const savedDayForDate = savedDays.find((day) => day.date === date) ?? null;

  // Schimbarea datei aduce în formular ziua salvată pentru ea, dacă există,
  // altfel golește câmpurile. Ziua devine astfel corectabilă, nu doar adăugabilă.
  useEffect(() => {
    if (activePeriod !== "day") return;
    // Captura adusă se aplică o singură dată; corecturile de după rămân.
    const pendingCapture = incomingDay && appliedCaptureRef.current !== incomingDay.id ? incomingDay : null;
    if (loadedDateRef.current === date && !pendingCapture) return;
    loadedDateRef.current = date;

    const saved = savedDays.find((day) => day.date === date);
    const inputs = saved?.inputs;

    setPlatformEntries(
      platformKeys.map((platform) => {
        const loaded = loadEntry(platform);
        // O captură de delivery adusă din alt formular completează ziua.
        if (pendingCapture?.delivery && pendingCapture.platform === platform) {
          return fillFromDelivery(loaded, pendingCapture.delivery.reading, { startDate: date, endDate: date }, sharedKilometersFor(config, platformKeys.map(emptyPlatformEntry), 0) === null).entry;
        }
        return loaded;
      }),
    );
    if (pendingCapture) appliedCaptureRef.current = pendingCapture.id;

    function loadEntry(platform: PlatformKey): PlatformEntryInput {
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
            deliveries: entry.deliveries,
          cancelledDeliveries: entry.cancelledDeliveries,
          hoursOnline: entry.hoursOnline,
          }
        : emptyPlatformEntry(platform);
    }

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
    setServiceKind(inputs?.serviceKind ?? "revizie");
    setServiceNote(inputs?.serviceNote ?? "");
    setOdometerKm(inputs?.odometerKm ?? 0);
    setOtherPointCost(inputs?.otherCost ?? 0);
    setHadOtherRouteCostToday((inputs?.otherCost ?? 0) > 0);
  }, [activePeriod, date, savedDays, platformKeys, incomingDay, config]);

  // Dacă utilizatorul schimbă platformele din onboarding, câmpurile se refac.
  // Ajustarea se face în timpul randării (nu într-un efect), ca formularul să
  // nu apară nici măcar o clipă cu platformele vechi.
  const [entriesPlatforms, setEntriesPlatforms] = useState(platformKeys);
  if (entriesPlatforms !== platformKeys) {
    setEntriesPlatforms(platformKeys);
    const unchanged =
      platformEntries.length === platformKeys.length &&
      platformEntries.every((entry, index) => entry.platform === platformKeys[index]);
    if (!unchanged) setPlatformEntries(platformKeys.map(emptyPlatformEntry));
  }

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

  const pointCosts = [
    ["Spălare auto", washedToday ? washingCost : 0],
    ["Parcare", paidParkingToday ? parkingCost : 0],
    ["Taxe de drum / pod", paidRoadTollToday ? roadTollCost : 0],
    [`Intervenție la ${vehicleShortNames[config.vehicleType]} azi`, hadServiceToday ? serviceCost : 0],
    ["Alte taxe / costuri pe traseu", hadOtherRouteCostToday ? otherPointCost : 0],
  ] as const;
  const directPhevCosts = usesDirectPhevCosts(config);
  // Tot ce a introdus șoferul pentru zi, în forma folosită și la încărcarea
  // din cont, ca ziua să se calculeze identic în ambele locuri.
  const dayInput: WorkDayInput = {
    date,
    platforms: platformEntries,
    privateEarnings,
    hoursWorked,
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
      ...(tracksOdometer(config) && odometerKm > 0 ? { odometerKm } : {}),
      ...(hadServiceToday ? { serviceKind, ...(serviceNote.trim() ? { serviceNote: serviceNote.trim() } : {}) } : {}),
    },
  };
  const { recurringCosts, combined, result, breakdown, sharedKilometers: sharedKilometerInput } =
    calculateWorkDay(config, dayInput);
  // Modul „un singur total” are sens numai pe două platforme; pe una singură
  // kilometrii sunt oricum ai ei.
  const usesSharedKilometers = sharedKilometerInput !== null;
  const kilometers = combined.kilometers;
  const consumedToday = directPhevCosts
    ? null
    : (Math.max(0, kilometers) * Math.max(0, config.consumptionPer100Km)) / 100;
  const calculatedEnergyCost = directPhevCosts
    ? Math.max(0, gasolineCost) + Math.max(0, electricCost)
    : (consumedToday ?? 0) * Math.max(0, unitPrice);

  const showSeparateView =
    config.profitView === "separate" && platformEntries.length > 1;
  const canCalculate = hasRequiredEarnings(platformEntries);
  const missingMessage = missingEarningsMessage();
  const resultPerHour = canCalculate && hoursWorked > 0 ? result.result / hoursWorked : null;
  const weeklyBounds = getPeriodBounds(date, "week");
  // Aceeași regulă ca în centralizare: totalul săptămânii, dacă există,
  // înlocuiește zilele ei; altfel se adună zilele salvate.
  const weekResolved = resolvePeriod("week", date, savedDays, manualPeriods);
  const weeklySummary = summarizeContributions(
    weekResolved.contributions,
    "week",
    weeklyBounds.startDate,
    weeklyBounds.endDate,
    calendarCostsForRange(config, weeklyBounds.startDate, weeklyBounds.endDate),
    weekResolved.days,
  );
  const weekHasData = weekResolved.contributions.length > 0;
  // La mijlocul săptămânii, costurile fixe ale întregii săptămâni sunt deja
  // scăzute; rezultatul poate ieși pe minus până se adună zilele.
  const weekStillRunning = todayInRomania() <= weeklySummary.endDate;
  const vehicleDays = useMemo(() => journalDays(savedDays, manualPeriods), [savedDays, manualPeriods]);
  const weeklyFixedCosts = weeklySummary.totalCimCost + weeklySummary.totalRecurringCosts;
  const ownBusiness = isOwnBusiness(config);
  const delivery = isDelivery(config);
  const fuel = usesFuel(config);
  // Comisionul flotei (angajat) sau al afilierii (propria firmă de delivery).
  const showCommission = !ownBusiness || (hasDelivery(config) && (config.fleetCommission.type === "percentage" || config.deliveryFleetCommission?.type === "percentage"));
  const weekIsTotal = weekResolved.source === "manual";
  const daysOfWeek = [...weekResolved.days, ...weekResolved.replacedDays].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const saveDayInWeek = () => {
    const day = buildSavedWorkDay(config, dayInput);
    if (!day) return;
    onSaveDay(day);
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
        <span className="profile-pill">{activityLabels[config.activity]} · {workModeLabel(config)}</span>
        <div className="topbar-actions">
          {/* Ștergerea completă există numai pentru testarea locală; un cont real nu o are la un clic distanță. */}
          {persistenceMode === "demo" ? <button type="button" className="account-back" onClick={onStartOver}>Șterge datele de test</button> : null}
          <button type="button" className="sign-out-button" onClick={() => void onSignOut()}>Ieși din cont</button>
        </div>
        <MobileMenu
          label="Meniul aplicației"
          heading={`${activityLabels[config.activity]} · ${workModeLabel(config)}`}
          items={[
            { label: "Zilnic", detail: "Adaugă sau corectează o zi", current: activePeriod === "day", onSelect: () => { setActivePeriod("day"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
            { label: "Săptămânal", detail: "Centralizarea săptămânii", current: activePeriod === "week", onSelect: () => { setActivePeriod("week"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
            { label: "Lunar", detail: "Centralizarea lunii", current: activePeriod === "month", onSelect: () => { setActivePeriod("month"); window.scrollTo({ top: 0, behavior: "smooth" }); } },
            "separator",
            { label: "Modifică configurarea", detail: "Platforme, vehicul, costuri", onSelect: onEditOnboarding },
            ...(persistenceMode === "demo" ? [{ label: "Șterge datele de test", onSelect: onStartOver, tone: "quiet" as const }] : []),
            { label: "Ieși din cont", onSelect: () => void onSignOut(), tone: "quiet" as const },
          ]}
        />
      </header>
      {persistenceWarnings.length > 0 ? <ul role="status" style={{ margin: "0 0 1rem", padding: "0.75rem 1rem 0.75rem 2rem", borderRadius: "0.75rem", background: "rgba(255, 176, 32, 0.12)", border: "1px solid rgba(255, 176, 32, 0.35)", fontSize: "0.875rem", lineHeight: 1.5 }}>{persistenceWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}

      <section className="intro" id="top">
        <div><p className="eyebrow">Introducere și centralizare</p><h1>{title}</h1><p className="lead">Configurația din onboarding se aplică automat calculelor.</p></div>
        <div className="date-block"><label htmlFor="work-date">{dateLabel}</label><input id="work-date" type={activePeriod === "month" ? "month" : "date"} value={activePeriod === "month" ? date.slice(0, 7) : date} onChange={(event) => setDate(activePeriod === "month" ? `${event.target.value}-01` : event.target.value)} /></div>
      </section>

      <section className="config-strip">
        <div><span>{delivery ? "Aplicații" : "Platformă"}</span><strong>{configPlatformsLabel(config)}</strong></div>
        <div><span>Oraș</span><strong>{config.cityName}</strong></div>
        <div><span>Vehicul</span><strong>{delivery ? `${vehicleTypeLabels[config.vehicleType]} · ` : ""}{config.vehicleOwnership === "owned" ? "Personal" : "Închiriat"}</strong></div>
        {fuel ? <div><span>Combustibil</span><strong>{fuelLabels[config.fuelType]}{config.hybridType ? ` · ${config.hybridType.toUpperCase()}` : ""}</strong></div> : null}
        <button type="button" onClick={onEditOnboarding}>Modifică configurarea</button>
      </section>
      <ServiceAlert config={config} days={vehicleDays} today={todayInRomania()} />

      <nav className="period-tabs segmented" aria-label="Perioada calculului">
        <button type="button" className={activePeriod === "day" ? "selected" : ""} onClick={() => setActivePeriod("day")}>Zilnic</button>
        <button type="button" className={activePeriod === "week" ? "selected" : ""} onClick={() => setActivePeriod("week")}>Săptămânal</button>
        <button type="button" className={activePeriod === "month" ? "selected" : ""} onClick={() => setActivePeriod("month")}>Lunar</button>
      </nav>
      {activePeriod === "day" ? <p className="period-hint">Ai captura pe toată săptămâna sau luna? Alege „Săptămânal” sau „Lunar” și introdu direct totalul. Altfel, introdu fiecare zi aici.</p> : null}

      {activePeriod === "day" ? <section className="workspace" aria-label="Calculator zilnic">
        <form className="form-card" onSubmit={(event) => event.preventDefault()}>
          {platformEntries.map((entry, index) => (
            <fieldset className="section-block" key={entry.platform}>
              <legend>{platformLabels[entry.platform]}</legend>
              <p className="section-help">{platformEarningsHelp(platformLabels[entry.platform], "ziua respectivă", isDeliveryPlatform(entry.platform))}</p>
              <PlatformEarningsFields key={`${entry.platform}:${date}`} ownBusiness={ownBusiness} entry={entry} platformLabel={platformLabels[entry.platform]} showKilometers={!usesSharedKilometers} formPeriod={{ type: "day", startDate: date, endDate: date }} onOtherPeriod={openCaptureForPeriod(entry.platform)} initialDelivery={incomingDay?.platform === entry.platform ? incomingDay.delivery : null} onDeliveryOtherPeriod={openDeliveryCapture(entry.platform)} onChange={(key, value) => updateEntry(index, key, value)} onReplace={(next) => setPlatformEntries((current) => current.map((item, position) => (position === index ? next : item)))} />
            </fieldset>
          ))}

          <fieldset className="section-block"><legend>Alte încasări</legend><p className="section-help">{delivery ? "Bani primiți în afara aplicațiilor de livrări, cash sau prin transfer." : config.activity === "both" ? "Bani primiți în afara aplicațiilor, cash sau prin transfer." : "Bani primiți în afara aplicațiilor de ridesharing, cash sau prin transfer."} {config.workMode === "own_business" ? "Se adaugă la câștigurile tale." : "Rămân integral la tine și nu trec prin flotă."}</p><OtherEarningsFields value={privateEarnings} onChange={setPrivateEarnings} delivery={delivery} /></fieldset>

          <fieldset className="section-block"><legend>{fuel ? "Activitatea zilei și combustibilul" : "Activitatea zilei"}</legend><p className="section-help">{usesSharedKilometers ? `Ai ales un singur total de kilometri. Introdu kilometrii reali ai zilei, ${delivery ? "cu tot cu drumul până la restaurant și mersul între comenzi" : "cu tot cu drumul până la client și mersul între curse"}; repartizarea pe platformă se face proporțional cu încasările.` : platformEntries.length > 1 ? "Kilometrii zilei sunt suma celor introduși mai sus, pe fiecare aplicație." : "Orele se completează în fiecare zi lucrată, indiferent dacă mașina este personală sau închiriată."}</p><div className="field-grid activity-grid">
            {usesSharedKilometers ? <NumberField className="kilometers-field" label="Câți kilometri ai parcurs azi în total?" value={sharedKilometers} onChange={setSharedKilometers} suffix="km" step="0.01" /> : <div className="readonly-field"><span>Kilometri în total azi</span><strong>{kilometers.toLocaleString("ro-RO")} km</strong></div>}
            <NumberField className="hours-field" label="Câte ore ai lucrat azi?" value={hoursWorked} onChange={setHoursWorked} suffix="ore" step="0.25" />
            {tracksOdometer(config) ? <NumberField className="odometer-field" label="Kilometraj la bord (opțional)" value={odometerKm} onChange={(value) => setOdometerKm(Math.round(value))} suffix="km" /> : null}
            {!fuel ? null : directPhevCosts ? <><NumberField label="Cost benzină folosită azi" value={gasolineCost} onChange={setGasolineCost} /><NumberField label="Cost energie electrică folosită azi" value={electricCost} onChange={setElectricCost} /></> : <><div className="readonly-field"><span>Consum configurat</span><strong>{config.consumptionPer100Km.toLocaleString("ro-RO")} {config.fuelType === "electric" ? "kWh" : "litri"}/100 km</strong></div><NumberField label={`Prețul din ziua respectivă / ${energyUnit(config)}`} value={unitPrice} onChange={setUnitPrice} suffix={`RON/${energyUnit(config)}`} /><div className="calculation-preview"><div><span>{config.fuelType === "electric" ? "Energie calculată azi" : "Combustibil calculat azi"}</span><strong>{(consumedToday ?? 0).toLocaleString("ro-RO", { maximumFractionDigits: 2 })} {config.fuelType === "electric" ? "kWh" : "litri"}</strong></div><div><span>Cheltuială calculată</span><strong>{money(calculatedEnergyCost)} RON</strong></div></div></>}
          </div></fieldset>

          <fieldset className="section-block"><legend>Cheltuieli apărute azi</legend><p className="section-help">Răspunde numai la situațiile care au existat astăzi. Costurile recurente din onboarding se adaugă automat.</p><div className="expense-questions">
            {fuel ? <><DailyExpenseQuestion question={config.vehicleType === "car" ? "Ai spălat mașina azi?" : "Ai spălat vehiculul azi?"} label="Suma plătită la spălătorie" enabled={washedToday} value={washingCost} onToggle={(enabled) => { setWashedToday(enabled); if (!enabled) setWashingCost(0); }} onChange={setWashingCost} />
            <DailyExpenseQuestion question="Ai plătit parcare azi?" label="Suma plătită pentru parcare" enabled={paidParkingToday} value={parkingCost} onToggle={(enabled) => { setPaidParkingToday(enabled); if (!enabled) setParkingCost(0); }} onChange={setParkingCost} />
            <DailyExpenseQuestion question="Ai plătit o taxă de drum sau pod azi?" label="Suma taxelor de drum sau pod" enabled={paidRoadTollToday} value={roadTollCost} onToggle={(enabled) => { setPaidRoadTollToday(enabled); if (!enabled) setRoadTollCost(0); }} onChange={setRoadTollCost} /></> : null}
            <div className={`expense-question ${hadServiceToday ? "enabled" : ""}`}>
              <label className="expense-question-toggle">
                <input type="checkbox" checked={hadServiceToday} onChange={(event) => { setHadServiceToday(event.target.checked); if (!event.target.checked) { setServiceCost(0); setServiceNote(""); } }} />
                <span>{`Ai avut o intervenție la ${vehicleShortNames[config.vehicleType]} azi? (revizie, service, reparație)`}</span>
              </label>
              {hadServiceToday ? <div className="service-question-fields">
                <label><span>Tip intervenție</span><select value={serviceKind} onChange={(event) => setServiceKind(event.target.value as ServiceKind)}>{serviceKinds.map((kind) => <option key={kind} value={kind}>{serviceKindLabels[kind]}</option>)}</select></label>
                <NumberField label="Cost intervenție" value={serviceCost} onChange={setServiceCost} />
                <label className="wide"><span>Ce s-a făcut (opțional)</span><input type="text" maxLength={200} value={serviceNote} placeholder={config.vehicleType === "bicycle" || config.vehicleType === "e_bike" ? "ex. cameră spate, lanț" : "ex. ulei și filtre, plăcuțe față"} onChange={(event) => setServiceNote(event.target.value)} /></label>
                {tracksOdometer(config) && serviceKind === "revizie" && odometerKm <= 0 ? <p className="service-question-note">Trece și kilometrajul la bord (la „Activitatea zilei”), ca următoarea revizie să se calculeze exact.</p> : null}
                <p className="service-question-note" style={{ color: "var(--muted)" }}>{tracksOdometer(config) ? "Intervenția rămâne în cartea de service după ce salvezi ziua." : `Intervenția rămâne la „Reparațiile ${config.vehicleType === "bicycle" ? "bicicletei" : "bicicletei electrice"}” după ce salvezi ziua.`}</p>
              </div> : null}
            </div>
            <DailyExpenseQuestion question="Ai avut altă taxă sau cheltuială pe traseu azi?" label="Suma plătită — de exemplu acces aeroport" enabled={hadOtherRouteCostToday} value={otherPointCost} onToggle={(enabled) => { setHadOtherRouteCostToday(enabled); if (!enabled) setOtherPointCost(0); }} onChange={setOtherPointCost} />
          </div></fieldset>
          <div className="save-day-panel"><div><strong>{savedDayForDate ? `Corectezi ziua de ${shortDate(date)}` : "Centralizează ziua în săptămână"}</strong><span>{savedDayForDate ? "Câmpurile sunt completate cu ce ai introdus atunci. Salvarea actualizează ziua, nu adaugă una nouă." : "Dacă revii la aceeași dată și salvezi din nou, ziua este actualizată, nu dublată."}</span></div><button type="button" onClick={saveDayInWeek} disabled={!canCalculate}>{savedDayForDate ? "Actualizează ziua" : "Salvează ziua în săptămână"}</button>{!canCalculate ? <p>{missingMessage}</p> : null}{weekIsTotal ? <p className="week-total-note">Săptămâna aceasta are un total introdus. Ziua se salvează, dar intră în calcul doar dacă ștergi totalul săptămânii.</p> : lastSavedDate === date ? <p>Ziua de {shortDate(date)} este inclusă în totalul săptămânii.</p> : null}</div>
        </form>

        <aside className="result-column" aria-live="polite">
          <section className={`result-card ${canCalculate ? (result.result < 0 ? "negative" : "positive") : ""}`}>{canCalculate ? <><p className="result-label">{ownBusiness ? "Îți rămân azi, înainte de taxe" : "Îți rămân azi"}</p><p className="result-value">{money(result.result)} RON</p><p className="result-alert">{formatResultAlert(result)}</p></> : <><p className="result-label">Calculul nu este gata</p><p className="result-alert">{missingMessage}</p></>}</section>
          {canCalculate ? <section className="breakdown-card" id="calcul"><div className="card-heading"><div><p className="eyebrow">Calcul transparent</p><h2>Detaliile zilei</h2></div><span>{date}</span></div><dl className="breakdown-list">
            <div><dt>{hasDelivery(config) ? "Încasări din aplicații" : "Venituri în aplicație"}</dt><dd>{money(combined.appRevenue)} RON</dd></div>
            {delivery ? null : <div><dt>Venituri în numerar</dt><dd>{money(combined.cashRevenue)} RON</dd></div>}
            {result.platformCosts > 0 ? <div><dt>Costuri și taxe</dt><dd>− {money(result.platformCosts)} RON</dd></div> : null}
            {delivery ? null : <div><dt>Comision aplicație</dt><dd>− {money(result.applicationCommission)} RON</dd></div>}
            <div><dt>Câștigurile tale</dt><dd>{money(result.platformNetEarnings)} RON</dd></div>
            {combined.cashTips > 0 ? <div><dt>Bacșiș numerar</dt><dd>{money(combined.cashTips)} RON</dd></div> : null}
            {privateEarnings > 0 ? <div><dt>Curse private / alte încasări</dt><dd>{money(privateEarnings)} RON</dd></div> : null}
            <div><dt>Total câștiguri</dt><dd>{money(result.totalEarnings)} RON</dd></div>
            <div><dt>Ore lucrate</dt><dd>{hoursWorked.toLocaleString("ro-RO")} ore</dd></div>
            {resultPerHour !== null ? <div><dt>Câștig după cheltuieli / oră</dt><dd>{money(resultPerHour)} RON</dd></div> : null}
            {fuel ? <div><dt>Combustibil / energie</dt><dd>− {money(result.energyCost)} RON</dd></div> : null}
            {showCommission ? <div><dt>{commissionLabel(config)}</dt><dd>− {money(result.fleetCommission)} RON</dd></div> : null}
            {ownBusiness ? null : <div><dt>CIM alocat zilei (÷ 7)</dt><dd>− {money(result.dailyCimCost)} RON</dd></div>}
            {recurringCosts.map((cost) => <div key={cost.id}><dt>{cost.label} · alocat/zi</dt><dd>− {money(cost.dailyAmount)} RON</dd></div>)}
            {pointCosts.filter(([, amount]) => amount > 0).map(([label, amount]) => <div key={label}><dt>{label}</dt><dd>− {money(amount)} RON</dd></div>)}
            <div className="total-row"><dt>Total cheltuieli</dt><dd>− {money(result.totalExpenses)} RON</dd></div>
          </dl></section> : <section className="breakdown-card"><p className="eyebrow">Calcul transparent</p><h2>Detaliile apar după completare</h2><p>Din motive de siguranță a calculului, comisionul nu se calculează automat: se introduce exact cum l-a calculat platforma de ridesharing în aplicație.</p></section>}
          {canCalculate && showSeparateView ? <section className="breakdown-card platform-breakdown-card"><div className="card-heading"><div><p className="eyebrow">Separat pe platformă</p><h2>Ce a adus fiecare aplicație</h2></div></div><p className="section-help">Se separă doar ce se poate măsura: încasările și comisionul din fiecare aplicație și kilometrii, plus combustibilul care decurge din ei. Cheltuielile comune ale zilei apar mai jos, o singură dată.</p>{breakdown.map((item) => <dl className="breakdown-list" key={item.platform} aria-label={`Detalii ${platformLabels[item.platform]}`}>
            <div className="total-row"><dt>{platformLabels[item.platform]}</dt><dd>{money(item.resultBeforeCommonCosts)} RON</dd></div>
            <div><dt>Câștigurile tale</dt><dd>{money(item.netEarnings)} RON</dd></div>
            {isDeliveryPlatform(item.platform) ? null : <div><dt>Numerar în mână</dt><dd>{money(item.cashInHand)} RON</dd></div>}
            <div><dt>Total câștiguri</dt><dd>{money(item.totalEarnings)} RON</dd></div>
            <div><dt>Kilometri</dt><dd>{item.kilometers.toLocaleString("ro-RO")} km</dd></div>
            {fuel ? <div><dt>Combustibil / energie</dt><dd>− {money(item.energyCost)} RON</dd></div> : null}
            {showCommission ? <div><dt>{commissionLabel(config)}</dt><dd>− {money(item.fleetCommission)} RON</dd></div> : null}
            {item.resultPerKm !== null ? <div><dt>Câștig pe kilometru</dt><dd>{money(item.resultPerKm)} RON/km</dd></div> : null}
          </dl>)}<p className="helper">Sumele de mai sus nu includ CIM-ul, chiria, RCA, spălarea sau parcarea: acelea sunt ale zilei și ale mașinii, nu ale unei aplicații. Profitul final al zilei este același, fie că îl privești împreună sau separat.</p></section> : null}
          {canCalculate && showSeparateView && config.activity === "both" ? <ActivitySplitCard items={breakdown} totalResult={result.result} privateEarnings={privateEarnings} periodLabel="azi" /> : null}
          {canCalculate && !ownBusiness ? <FleetSettlement title="Regularizarea zilei" balance={result.fleetBalance} amountManagedByFleet={result.amountManagedByFleet} fleetCommission={result.fleetCommission} cimCost={result.cimCost} cimLabel="CIM alocat zilei (÷ 7)" otherFleetCosts={result.recurringFleetCosts} note="Valoarea zilei intră în regularizarea săptămânală numai după salvare." /> : null}
          <section className={`weekly-card ${(ownBusiness ? weeklySummary.totalResult < 0 : weeklySummary.totalFleetBalance > 0) ? "owes" : "receives"}`}><p className="eyebrow">{ownBusiness ? "Rezultatul săptămânii" : "Regularizarea săptămânii"}</p><p className="weekly-range">{shortDate(weeklySummary.startDate)} – {shortDate(weeklySummary.endDate)}</p><h2>{weekHasData ? ownBusiness ? `Îți rămân ${money(weeklySummary.totalResult)} RON, înainte de taxe` : formatFleetAlert(weeklySummary.totalFleetBalance) : "Nicio zi salvată încă"}</h2>{weekHasData ? <><div className="weekly-metrics"><div><span>Zile</span><strong>{weekResolved.workedDays}</strong></div><div><span>Ore</span><strong>{weeklySummary.totalHours.toLocaleString("ro-RO")}</strong></div><div><span>{weekResolved.estimatedKilometers ? "Km (estimativ)" : "Kilometri"}</span><strong>{weeklySummary.totalKilometers.toLocaleString("ro-RO")}</strong></div><div><span>Îți rămân</span><strong>{money(weeklySummary.totalResult)} RON</strong></div></div>{weekStillRunning && weeklyFixedCosts > 0 ? <p className="weekly-empty">Săptămâna nu s-a încheiat: sunt deja scăzute {ownBusiness ? "costurile fixe" : "CIM-ul și costurile fixe"} pe toată săptămâna ({money(weeklyFixedCosts)} RON). Rezultatul crește cu fiecare zi lucrată.</p> : null}{weekIsTotal ? <p className="weekly-empty">Calculat din totalul săptămânii introdus de tine. <button type="button" className="inline-link" onClick={() => setActivePeriod("week")}>Vezi totalul</button></p> : null}</> : <p className="weekly-empty">Salvează fiecare zi lucrată; {ownBusiness ? "rezultatul se adună pe toată săptămâna luni–duminică." : "soldul pentru plată se actualizează pe toată săptămâna luni–duminică."}</p>}{daysOfWeek.length ? <div className="saved-days">{daysOfWeek.map((day) => <button type="button" key={day.date} className={day.date === date ? "selected" : ""} aria-label={`Deschide ziua de ${shortDate(day.date)}`} onClick={() => { setActivePeriod("day"); setDate(day.date); }}>{shortDate(day.date)} · {day.hoursWorked.toLocaleString("ro-RO")} ore</button>)}</div> : null}</section>
          <VehicleJournalCard config={config} days={vehicleDays} today={todayInRomania()} />
          <p className="preview-note">{persistenceNote}</p>
        </aside>
        {canCalculate ? <div className={`mobile-result-bar ${result.result < 0 ? "negative" : ""}`}><span>{ownBusiness ? "Rezultat azi, înainte de taxe" : "Rezultat azi"}<strong>{money(result.result)} RON</strong></span><button type="button" onClick={() => document.getElementById("calcul")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Vezi calculul</button></div> : null}
      </section> : <PeriodSummaryPanel config={config} periodType={activePeriod} anchorDate={date} savedDays={savedDays} manualPeriods={manualPeriods} onSaveManualPeriod={onSaveManualPeriod} onDeleteManualPeriod={onDeleteManualPeriod} incomingCapture={incomingCapture} onIncomingCaptureUsed={() => setIncomingCapture(null)} onCaptureForOtherPeriod={openCaptureForPeriod} onDeliveryCaptureForOtherPeriod={openDeliveryCapture} persistenceNote={persistenceNote} />}
    </main>
  );
}
