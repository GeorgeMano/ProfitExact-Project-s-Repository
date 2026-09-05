"use client";

import { useMemo, useState } from "react";
import {
  cityKey,
  formatCityName,
  fuelLabels,
  normalizeCityInput,
  platformLabels,
  type CostPeriod,
  type FuelType,
  type HybridType,
  type OnboardingConfig,
  type PlatformChoice,
  type ProfitView,
  type RecurringCostConfig,
  type VehicleOwnership,
} from "@/domain/onboarding";
import { BrandMark } from "./brand-mark";
import "./onboarding-flow.css";

const stepNames = [
  "Activitate",
  "Forma de lucru",
  "Platforme",
  "Oraș",
  "Vehicul",
  "Flotă",
  "Costuri auto",
  "Confirmare",
];

function todayInRomania() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

interface CostDraft {
  enabled: boolean;
  amount: number;
  period: CostPeriod;
  validityDays?: number;
}

interface Draft {
  platform: PlatformChoice;
  city: string;
  profitView: ProfitView;
  vehicleOwnership: VehicleOwnership;
  effectiveFrom: string;
  commissionType: "percentage" | "fixed";
  commissionValue: number;
  commissionBase: "gross" | "net";
  paysCim: boolean;
  weeklyCimCost: number;
  accounting: CostDraft;
  cashRegister: CostDraft;
  otherFleetEnabled: boolean;
  otherFleetLabel: string;
  otherFleet: CostDraft;
  fuelType: FuelType;
  hybridType: HybridType;
  primaryFuel: "gasoline" | "lpg";
  consumptionPer100Km: number;
  rentWeekly: number;
  rcaAnnual: number;
  casco: CostDraft;
  itp: CostDraft;
  vignette: CostDraft;
  leasing: CostDraft;
  phoneInternetMonthly: number;
}

type DraftSetter = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const initialDraft: Draft = {
  platform: "bolt",
  city: "",
  profitView: "together",
  vehicleOwnership: "owned",
  effectiveFrom: todayInRomania(),
  commissionType: "percentage",
  commissionValue: 0,
  commissionBase: "net",
  paysCim: false,
  weeklyCimCost: 0,
  accounting: { enabled: false, amount: 0, period: "monthly" },
  cashRegister: { enabled: false, amount: 0, period: "monthly" },
  otherFleetEnabled: false,
  otherFleetLabel: "",
  otherFleet: { enabled: false, amount: 0, period: "weekly" },
  fuelType: "gasoline",
  hybridType: null,
  primaryFuel: "lpg",
  consumptionPer100Km: 0,
  rentWeekly: 0,
  rcaAnnual: 0,
  casco: { enabled: false, amount: 0, period: "annual" },
  itp: { enabled: false, amount: 0, period: "validity", validityDays: 180 },
  vignette: {
    enabled: false,
    amount: 0,
    period: "validity",
    validityDays: 365,
  },
  leasing: { enabled: false, amount: 0, period: "monthly" },
  phoneInternetMonthly: 0,
};

function NumberInput({
  label,
  value,
  onChange,
  suffix = "RON",
  placeholder,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <label className="onboarding-field">
      <span>{label}</span>
      <span className="onboarding-input-wrap">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value || ""}
          placeholder={placeholder}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <small>{suffix}</small>
      </span>
    </label>
  );
}

function Choice<T extends string>({
  value,
  selected,
  label,
  detail,
  onSelect,
  disabled = false,
}: {
  value: T;
  selected: boolean;
  label: string;
  detail: string;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`choice-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(value)}
      disabled={disabled}
      aria-pressed={selected}
    >
      <strong>{label}</strong>
      <span>{detail}</span>
      {disabled ? <small>Urmează într-o etapă separată</small> : null}
    </button>
  );
}

function PeriodSelect({
  value,
  onChange,
}: {
  value: CostPeriod;
  onChange: (period: CostPeriod) => void;
}) {
  return (
    <label className="onboarding-field">
      <span>Periodicitate</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CostPeriod)}
      >
        <option value="weekly">Săptămânal</option>
        <option value="monthly">Lunar</option>
        <option value="annual">Anual</option>
      </select>
    </label>
  );
}

function addCost(
  costs: RecurringCostConfig[],
  input: Omit<RecurringCostConfig, "effectiveFrom">,
  effectiveFrom: string,
) {
  if (input.amount > 0) {
    costs.push({ ...input, effectiveFrom });
  }
}

function buildConfig(draft: Draft): OnboardingConfig {
  const recurringCosts: RecurringCostConfig[] = [];
  const add = (input: Omit<RecurringCostConfig, "effectiveFrom">) =>
    addCost(recurringCosts, input, draft.effectiveFrom);

  if (draft.accounting.enabled) {
    add({ id: "accounting", category: "accounting", label: "Contabilitate cerută de flotă", amount: draft.accounting.amount, period: draft.accounting.period, paidToFleet: true });
  }
  if (draft.cashRegister.enabled) {
    add({ id: "cash-register", category: "cash_register", label: "Casă de marcat", amount: draft.cashRegister.amount, period: draft.cashRegister.period, paidToFleet: true });
  }
  if (draft.otherFleetEnabled) {
    add({ id: "fleet-other", category: "fleet_withholding", label: draft.otherFleetLabel || "Altă reținere a flotei", amount: draft.otherFleet.amount, period: draft.otherFleet.period, paidToFleet: true });
  }
  if (draft.vehicleOwnership === "rented") {
    add({ id: "vehicle-rent", category: "vehicle_rent", label: "Chirie auto", amount: draft.rentWeekly, period: "weekly", paidToFleet: false });
  } else {
    add({ id: "rca", category: "rca", label: "RCA", amount: draft.rcaAnnual, period: "annual", paidToFleet: false });
    if (draft.casco.enabled) add({ id: "casco", category: "casco", label: "CASCO", amount: draft.casco.amount, period: "annual", paidToFleet: false });
    if (draft.itp.enabled) add({ id: "itp", category: "itp", label: "ITP", amount: draft.itp.amount, period: "validity", validityDays: draft.itp.validityDays, paidToFleet: false });
    if (draft.vignette.enabled) add({ id: "vignette", category: "vignette", label: "Rovinietă", amount: draft.vignette.amount, period: "validity", validityDays: draft.vignette.validityDays, paidToFleet: false });
    if (draft.leasing.enabled) add({ id: "leasing", category: "leasing", label: "Rată / leasing", amount: draft.leasing.amount, period: "monthly", paidToFleet: false });
  }
  add({ id: "phone", category: "phone_internet", label: "Telefon și internet", amount: draft.phoneInternetMonthly, period: "monthly", paidToFleet: false });

  const isHybrid = draft.fuelType.startsWith("hybrid");
  return {
    activity: "ridesharing",
    workMode: "employee",
    platform: draft.platform,
    cityName: formatCityName(draft.city),
    cityKey: cityKey(draft.city),
    profitView: draft.platform === "bolt_uber" ? draft.profitView : "together",
    vehicleOwnership: draft.vehicleOwnership,
    fuelType: draft.fuelType,
    hybridType: isHybrid ? draft.hybridType ?? "hev" : null,
    primaryFuel: draft.fuelType === "gasoline_lpg" ? draft.primaryFuel : null,
    consumptionPer100Km:
      isHybrid && draft.hybridType === "phev"
        ? 0
        : draft.consumptionPer100Km,
    fleetCommission:
      draft.commissionType === "fixed"
        ? { type: "fixed", value: draft.commissionValue }
        : { type: "percentage", value: draft.commissionValue, base: draft.commissionBase },
    weeklyCimCost: draft.paysCim ? draft.weeklyCimCost : 0,
    effectiveFrom: draft.effectiveFrom,
    recurringCosts,
  };
}

export function OnboardingFlow({
  onComplete,
}: {
  onComplete: (config: OnboardingConfig) => void;
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const config = useMemo(() => buildConfig(draft), [draft]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const isPhev = draft.hybridType === "phev";
  const canContinue =
    step === 3
      ? cityKey(draft.city).length >= 2
      : step !== 6 || isPhev || draft.consumptionPer100Km > 0;

  return (
    <main className="onboarding-shell">
      <header className="onboarding-topbar">
        <a className="brand" href="#" aria-label="ProfitExact — început">
          <BrandMark className="brand-mark" />
          <span>ProfitExact</span>
        </a>
        <span className="profile-pill">Configurare inițială</span>
      </header>

      <div className="onboarding-layout">
        <aside className="progress-panel">
          <p className="eyebrow">Pasul {step + 1} din {stepNames.length}</p>
          <h1>{stepNames[step]}</h1>
          <div className="progress-track"><span style={{ width: `${((step + 1) / stepNames.length) * 100}%` }} /></div>
          <ol>{stepNames.map((name, index) => <li key={name} className={index === step ? "active" : index < step ? "done" : ""}>{name}</li>)}</ol>
        </aside>

        <section className="onboarding-card">
          {step === 0 ? (
            <Step title="Ce tip de activitate faci?" description="Fiecare activitate va avea calcule și costuri separate.">
              <div className="choice-grid three">
                <Choice value="ridesharing" selected label="Ridesharing" detail="Bolt, Uber sau ambele" onSelect={() => undefined} />
                <Choice value="delivery" selected={false} label="Delivery" detail="Glovo, Wolt și Bolt Food" onSelect={() => undefined} disabled />
                <Choice value="both" selected={false} label="Ambele" detail="Două contexte calculate separat" onSelect={() => undefined} disabled />
              </div>
            </Step>
          ) : null}

          {step === 1 ? (
            <Step title="Cum lucrezi pentru ridesharing?" description="Îți arătăm numai costurile care se potrivesc situației tale.">
              <div className="choice-grid">
                <Choice value="employee" selected label="Angajat" detail="Lucrez prin flotă sau SRL-ul altcuiva" onSelect={() => undefined} />
                <Choice value="own" selected={false} label="Propriul SRL/PFA" detail="Lucrez prin entitatea mea" onSelect={() => undefined} disabled />
              </div>
            </Step>
          ) : null}

          {step === 2 ? (
            <Step title="Pe ce platformă lucrezi?" description="Încasările rămân vizibile per platformă.">
              <div className="choice-grid three">
                {(["bolt", "uber", "bolt_uber"] as PlatformChoice[]).map((platform) => (
                  <Choice key={platform} value={platform} selected={draft.platform === platform} label={platformLabels[platform]} detail={platform === "bolt_uber" ? "Folosesc ambele platforme" : `Lucrez pe ${platformLabels[platform]}`} onSelect={(value) => set("platform", value)} />
                ))}
              </div>
              {draft.platform === "bolt_uber" ? <div className="inline-question"><strong>Cum dorești să vezi rezultatul?</strong><div className="segmented"><button type="button" className={draft.profitView === "together" ? "selected" : ""} onClick={() => set("profitView", "together")}>Împreună</button><button type="button" className={draft.profitView === "separate" ? "selected" : ""} onClick={() => set("profitView", "separate")}>Separat pe platformă</button></div></div> : null}
            </Step>
          ) : null}

          {step === 3 ? (
            <Step title="În ce oraș lucrezi în principal?" description="Scrie orașul liber, fără să depindem de o listă care poate rămâne în urmă.">
              <label className="onboarding-field full">
                <span>Orașul principal în care lucrezi</span>
                <input
                  type="text"
                  autoComplete="address-level2"
                  maxLength={80}
                  value={draft.city}
                  placeholder="Ex. Bucuresti"
                  onChange={(event) =>
                    set("city", normalizeCityInput(event.target.value))
                  }
                />
              </label>
              <p className="field-note full">Dacă scrii cu diacritice, ProfitExact le elimină automat pentru ca același oraș să nu apară de mai multe ori în statistici.</p>
            </Step>
          ) : null}

          {step === 4 ? (
            <Step title="Mașina este personală sau închiriată?" description="Costurile afișate în pasul următor depind de această alegere.">
              <div className="choice-grid">
                <Choice value="owned" selected={draft.vehicleOwnership === "owned"} label="Mașină personală" detail="RCA, CASCO, ITP, rovinietă, leasing și jurnale" onSelect={(value) => set("vehicleOwnership", value)} />
                <Choice value="rented" selected={draft.vehicleOwnership === "rented"} label="Mașină închiriată" detail="Chirie săptămânală, combustibil și spălări" onSelect={(value) => set("vehicleOwnership", value)} />
              </div>
            </Step>
          ) : null}

          {step === 5 ? <FleetStep draft={draft} set={set} /> : null}
          {step === 6 ? <VehicleCostsStep draft={draft} set={set} /> : null}
          {step === 7 ? <Summary config={config} /> : null}

          <footer className="onboarding-actions">
            <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0}>Înapoi</button>
            {step < stepNames.length - 1 ? <button type="button" className="primary-button" onClick={() => setStep((current) => current + 1)} disabled={!canContinue}>Continuă</button> : <button type="button" className="primary-button" onClick={() => onComplete(config)}>Confirmă configurația</button>}
          </footer>
        </section>
      </div>
    </main>
  );
}

function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="step-content"><p className="eyebrow">ProfitExact pentru tine</p><h2>{title}</h2><p className="step-description">{description}</p>{children}</div>;
}

function FleetStep({ draft, set }: { draft: Draft; set: DraftSetter }) {
  const updateCost = (
    key: "accounting" | "cashRegister" | "otherFleet",
    patch: Partial<CostDraft>,
  ) => set(key, { ...draft[key], ...patch });

  return (
    <Step title="Ce costuri ai prin flotă?" description="Activează numai costurile pe care le plătești în realitate. Noile valori se aplică de la data aleasă.">
      <div className="onboarding-grid">
        <label className="onboarding-field"><span>Data efectivă</span><input type="date" value={draft.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} /></label>
        <label className="onboarding-field"><span>Tip comision flotă</span><select value={draft.commissionType} onChange={(event) => set("commissionType", event.target.value as Draft["commissionType"])}><option value="percentage">Procent</option><option value="fixed">Sumă fixă</option></select></label>
        <NumberInput label="Valoare comision" value={draft.commissionValue} onChange={(value) => set("commissionValue", value)} suffix={draft.commissionType === "percentage" ? "%" : "RON"} />
        {draft.commissionType === "percentage" ? <label className="onboarding-field"><span>Comision aplicat la</span><select value={draft.commissionBase} onChange={(event) => set("commissionBase", event.target.value as Draft["commissionBase"])}><option value="gross">Brut</option><option value="net">Net după comisionul aplicației</option></select></label> : null}
      </div>

      <div className="cost-options">
        <ConditionalCost title="Plătești CIM/carte de muncă prin flotă?" enabled={draft.paysCim} onToggle={(enabled) => set("paysCim", enabled)}>
          <NumberInput label="Cost pe săptămână" value={draft.weeklyCimCost} onChange={(value) => set("weeklyCimCost", value)} placeholder="ex. 900" />
        </ConditionalCost>
        <ConditionalCost title="Flota îți cere contabilitate?" enabled={draft.accounting.enabled} onToggle={(enabled) => updateCost("accounting", { enabled })}>
          <NumberInput label="Cost contabilitate" value={draft.accounting.amount} onChange={(amount) => updateCost("accounting", { amount })} />
          <PeriodSelect value={draft.accounting.period} onChange={(period) => updateCost("accounting", { period })} />
        </ConditionalCost>
        <ConditionalCost title="Suporți costul casei de marcat?" enabled={draft.cashRegister.enabled} onToggle={(enabled) => updateCost("cashRegister", { enabled })}>
          <NumberInput label="Cost casă de marcat" value={draft.cashRegister.amount} onChange={(amount) => updateCost("cashRegister", { amount })} />
          <PeriodSelect value={draft.cashRegister.period} onChange={(period) => updateCost("cashRegister", { period })} />
        </ConditionalCost>
        <ConditionalCost title="Ai altă reținere a flotei?" enabled={draft.otherFleetEnabled} onToggle={(enabled) => { set("otherFleetEnabled", enabled); updateCost("otherFleet", { enabled }); }}>
          <label className="onboarding-field"><span>Denumire</span><input type="text" value={draft.otherFleetLabel} placeholder="ex. taxă administrativă" onChange={(event) => set("otherFleetLabel", event.target.value)} /></label>
          <NumberInput label="Valoare" value={draft.otherFleet.amount} onChange={(amount) => updateCost("otherFleet", { amount })} />
          <PeriodSelect value={draft.otherFleet.period} onChange={(period) => updateCost("otherFleet", { period })} />
        </ConditionalCost>
      </div>
    </Step>
  );
}

function VehicleCostsStep({ draft, set }: { draft: Draft; set: DraftSetter }) {
  const isHybrid = draft.fuelType === "hybrid_gasoline" || draft.fuelType === "hybrid_diesel";
  const isPhev = isHybrid && draft.hybridType === "phev";
  const updateCost = (
    key: "casco" | "itp" | "vignette" | "leasing",
    patch: Partial<CostDraft>,
  ) => set(key, { ...draft[key], ...patch });
  const unit = draft.fuelType === "electric" ? "kWh/100 km" : "litri/100 km";

  return (
    <Step title="Configurează mașina și costurile recurente" description="ProfitExact le va împărți automat pe zi, săptămână și lună. Valorile zero nu sunt activate.">
      <div className="onboarding-grid">
        <label className="onboarding-field full"><span>Tip combustibil / propulsie</span><select value={draft.fuelType} onChange={(event) => { const fuelType = event.target.value as FuelType; set("fuelType", fuelType); if (!fuelType.startsWith("hybrid")) set("hybridType", null); }}>
          {(Object.keys(fuelLabels) as FuelType[]).map((fuel) => <option key={fuel} value={fuel}>{fuelLabels[fuel]}</option>)}
        </select></label>
        {isHybrid ? <label className="onboarding-field"><span>Tip hibrid</span><select value={draft.hybridType ?? "hev"} onChange={(event) => set("hybridType", event.target.value as HybridType)}><option value="hev">HEV</option><option value="phev">Plug-in / PHEV</option></select></label> : null}
        {draft.fuelType === "gasoline_lpg" ? <label className="onboarding-field"><span>Combustibil principal</span><select value={draft.primaryFuel} onChange={(event) => set("primaryFuel", event.target.value as Draft["primaryFuel"])}><option value="lpg">GPL</option><option value="gasoline">Benzină</option></select></label> : null}
        {!isPhev ? <NumberInput label="Consum aproximativ" value={draft.consumptionPer100Km} onChange={(value) => set("consumptionPer100Km", value)} suffix={unit} placeholder="ex. 8,5" /> : <p className="field-note full">Pentru PHEV vei introduce separat costul benzinei și costul încărcării electrice în fiecare zi lucrată.</p>}
      </div>

      {draft.vehicleOwnership === "rented" ? (
        <div className="cost-options compact"><h3>Mașină închiriată</h3><NumberInput label="Chirie pe săptămână" value={draft.rentWeekly} onChange={(value) => set("rentWeekly", value)} placeholder="ex. 700" /></div>
      ) : (
        <div className="cost-options">
          <h3>Mașină personală</h3>
          <NumberInput label="RCA anual" value={draft.rcaAnnual} onChange={(value) => set("rcaAnnual", value)} placeholder="ex. 2.000" />
          <ConditionalCost title="Ai CASCO?" enabled={draft.casco.enabled} onToggle={(enabled) => updateCost("casco", { enabled })}><NumberInput label="CASCO anual" value={draft.casco.amount} onChange={(amount) => updateCost("casco", { amount })} /></ConditionalCost>
          <ValidityCost title="Adaugi costul ITP?" cost={draft.itp} onChange={(patch) => updateCost("itp", patch)} />
          <ValidityCost title="Adaugi rovinieta?" cost={draft.vignette} onChange={(patch) => updateCost("vignette", patch)} />
          <ConditionalCost title="Ai rată, finanțare sau leasing?" enabled={draft.leasing.enabled} onToggle={(enabled) => updateCost("leasing", { enabled })}><NumberInput label="Rată lunară" value={draft.leasing.amount} onChange={(amount) => updateCost("leasing", { amount })} /></ConditionalCost>
        </div>
      )}
      <div className="shared-cost"><NumberInput label="Telefon și internet / lună" value={draft.phoneInternetMonthly} onChange={(value) => set("phoneInternetMonthly", value)} /></div>
    </Step>
  );
}

function ConditionalCost({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (enabled: boolean) => void; children: React.ReactNode }) {
  return <div className={`conditional-cost ${enabled ? "enabled" : ""}`}><label className="switch-line"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} /><span>{title}</span></label>{enabled ? <div className="conditional-fields">{children}</div> : null}</div>;
}

function ValidityCost({ title, cost, onChange }: { title: string; cost: CostDraft; onChange: (patch: Partial<CostDraft>) => void }) {
  return <ConditionalCost title={title} enabled={cost.enabled} onToggle={(enabled) => onChange({ enabled })}><NumberInput label="Cost" value={cost.amount} onChange={(amount) => onChange({ amount })} /><NumberInput label="Valabilitate" value={cost.validityDays ?? 365} onChange={(validityDays) => onChange({ validityDays })} suffix="zile" /></ConditionalCost>;
}

function Summary({ config }: { config: OnboardingConfig }) {
  const commission = config.fleetCommission.type === "fixed" ? `${config.fleetCommission.value} RON` : `${config.fleetCommission.value}% din ${config.fleetCommission.base === "gross" ? "brut" : "net"}`;
  return <Step title="Verifică înainte de confirmare" description="Aceste date rămân în profil și se folosesc automat pentru zilele și perioadele următoare."><dl className="summary-list"><div><dt>Activitate</dt><dd>Ridesharing · Angajat</dd></div><div><dt>Platformă</dt><dd>{platformLabels[config.platform]}</dd></div><div><dt>Oraș</dt><dd>{config.cityName}</dd></div><div><dt>Vehicul</dt><dd>{config.vehicleOwnership === "owned" ? "Mașină personală" : "Mașină închiriată"}</dd></div><div><dt>Propulsie</dt><dd>{fuelLabels[config.fuelType]}{config.hybridType ? ` · ${config.hybridType.toUpperCase()}` : ""}</dd></div><div><dt>Comision flotă</dt><dd>{commission}</dd></div><div><dt>CIM săptămânal</dt><dd>{config.weeklyCimCost.toLocaleString("ro-RO")} RON</dd></div><div><dt>Costuri recurente</dt><dd>{config.recurringCosts.length ? `${config.recurringCosts.length} configurate` : "Niciun cost opțional"}</dd></div></dl><div className="summary-costs">{config.recurringCosts.map((cost) => <span key={cost.id}>{cost.label}: {cost.amount.toLocaleString("ro-RO")} RON / {periodLabel(cost.period)}</span>)}</div></Step>;
}

function periodLabel(period: CostPeriod) {
  return { weekly: "săptămână", monthly: "lună", annual: "an", validity: "valabilitate" }[period];
}
