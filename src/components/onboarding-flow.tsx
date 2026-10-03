"use client";

import { useMemo, useState } from "react";
import {
  cityKey,
  formatCityName,
  fuelLabels,
  activityLabels,
  configPlatformsLabel,
  vehicleTypeLabels,
  usesFuel,
  legalFormLabels,
  taxRegimeDescriptions,
  taxRegimeLabels,
  taxRegimesFor,
  workModeLabel,
  normalizeCityInput,
  platformLabels,
  type CostPeriod,
  type FuelType,
  type HybridType,
  type OnboardingConfig,
  type PlatformChoice,
  type ProfitView,
  type KilometerEntryMode,
  type Activity,
  type DeliveryPlatform,
  type VehicleType,
  type LegalForm,
  type TaxRegime,
  type WorkMode,
  type RecurringCostConfig,
  type VehicleOwnership,
  vehicleShortNames,
} from "@/domain/onboarding";
import { serviceIntervalExamples } from "@/lib/finance/vehicle-service";
import type { FleetCommission } from "@/lib/finance/daily-result";
import { BrandMark } from "./brand-mark";
import { DecimalInput } from "./decimal-input";
import "./onboarding-flow.css";

function stepNamesFor(workMode: WorkMode, vehicleType: VehicleType) {
  return [
    "Activitate",
    "Forma de lucru",
    "Platforme",
    "Oraș",
    "Vehicul",
    workMode === "own_business" ? "Firmă" : "Flotă",
    vehicleType === "car" ? "Costuri auto" : "Costuri vehicul",
    "Confirmare",
  ];
}

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
  activity: Activity;
  deliveryPlatforms: DeliveryPlatform[];
  vehicleType: VehicleType;
  /** Propria firmă de delivery: contractul de afiliere cu firma parteneră. */
  hasAffiliation: boolean;
  affiliationType: "percentage" | "fixed";
  affiliationPercent: number;
  affiliationFixed: CostDraft;
  /** Jurnalul vehiculului (numai mașină și scuter): kilometrajul de acum și revizia. */
  odometerKm: number;
  lastServiceKm: number;
  lastServiceDate: string;
  serviceIntervalKm: number;
  serviceIntervalMonths: number;
  /** „Ambele”, angajat: flota ia alt comision la livrări decât la ridesharing. */
  deliveryCommissionDiffers: boolean;
  deliveryCommissionType: "percentage" | "fixed";
  deliveryCommissionValue: number;
  deliveryCommissionBase: "gross" | "net";
  workMode: WorkMode;
  legalForm: LegalForm | null;
  /** „unknown” = utilizatorul nu știe încă; se salvează ca null. */
  taxRegime: TaxRegime | "unknown" | null;
  platform: PlatformChoice;
  city: string;
  profitView: ProfitView;
  kilometerEntry: KilometerEntryMode;
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
  transportLicense: CostDraft;
  certifiedCopy: CostDraft;
  /** Copia conformă se ia pe 1, 2 sau 3 ani; ecusoanele țin cât ea. */
  certifiedCopyYears: 1 | 2 | 3;
  badges: CostDraft;
  managerCertificate: CostDraft;
  salary: CostDraft;
  bankFees: CostDraft;
  otherBusinessLabel: string;
  otherBusiness: CostDraft;
}

type DraftSetter = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

const initialDraft: Draft = {
  activity: "ridesharing",
  deliveryPlatforms: [],
  vehicleType: "car",
  hasAffiliation: false,
  affiliationType: "percentage",
  affiliationPercent: 0,
  affiliationFixed: { enabled: true, amount: 0, period: "weekly" },
  odometerKm: 0,
  lastServiceKm: 0,
  lastServiceDate: "",
  serviceIntervalKm: 0,
  serviceIntervalMonths: 0,
  deliveryCommissionDiffers: false,
  deliveryCommissionType: "percentage",
  deliveryCommissionValue: 0,
  deliveryCommissionBase: "net",
  workMode: "employee",
  legalForm: null,
  taxRegime: null,
  platform: "bolt",
  city: "",
  profitView: "together",
  kilometerEntry: "per_platform",
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
  transportLicense: { enabled: false, amount: 0, period: "validity", validityDays: 365 },
  certifiedCopy: { enabled: false, amount: 0, period: "validity" },
  certifiedCopyYears: 1,
  badges: { enabled: false, amount: 0, period: "validity" },
  managerCertificate: { enabled: false, amount: 0, period: "validity", validityDays: 365 },
  salary: { enabled: false, amount: 0, period: "monthly" },
  bankFees: { enabled: false, amount: 0, period: "monthly" },
  otherBusinessLabel: "",
  otherBusiness: { enabled: false, amount: 0, period: "monthly" },
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
        <DecimalInput
          value={value}
          placeholder={placeholder}
          onChange={(next) => onChange(next ?? 0)}
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

  const ownBusiness = draft.workMode === "own_business";
  const delivery = draft.activity === "delivery";
  const both = draft.activity === "both";
  const withDelivery = delivery || both;
  const vehicleType: VehicleType = delivery ? draft.vehicleType : "car";
  const motorVehicle = vehicleType === "car" || vehicleType === "moto";
  const multiPlatform = both || (delivery ? draft.deliveryPlatforms.length > 1 : draft.platform === "bolt_uber");
  const affiliationPercent =
    ownBusiness && withDelivery && draft.hasAffiliation && draft.affiliationType === "percentage";
  const affiliationCommission: FleetCommission = { type: "percentage", value: draft.affiliationPercent, base: "net" };
  const ridesharingCommission: FleetCommission = draft.commissionType === "fixed"
    ? { type: "fixed", value: draft.commissionValue }
    : { type: "percentage", value: draft.commissionValue, base: draft.commissionBase };
  // La „Ambele”: comisionul de la livrări, dacă e altul decât la ridesharing.
  const deliveryFleetCommission: FleetCommission | undefined = !both
    ? undefined
    : ownBusiness
      ? affiliationPercent ? affiliationCommission : undefined
      : draft.deliveryCommissionDiffers
        ? draft.deliveryCommissionType === "fixed"
          ? { type: "fixed", value: draft.deliveryCommissionValue }
          : { type: "percentage", value: draft.deliveryCommissionValue, base: draft.deliveryCommissionBase }
        : undefined;

  if (draft.accounting.enabled) {
    add({ id: "accounting", category: "accounting", label: ownBusiness ? "Contabilitate" : "Contabilitate cerută de flotă", amount: draft.accounting.amount, period: draft.accounting.period, paidToFleet: !ownBusiness });
  }
  if (draft.cashRegister.enabled) {
    add({ id: "cash-register", category: "cash_register", label: "Casă de marcat", amount: draft.cashRegister.amount, period: draft.cashRegister.period, paidToFleet: !ownBusiness });
  }
  if (ownBusiness && withDelivery && draft.hasAffiliation && draft.affiliationType === "fixed") {
    add({ id: "affiliation", category: "affiliation_fee", label: "Contract de afiliere", amount: draft.affiliationFixed.amount, period: draft.affiliationFixed.period, paidToFleet: false });
  }
  if (ownBusiness && !delivery) {
    // Costurile ARR, în ordinea obținerii. Ce se plătește o singură dată se
    // împarte pe primele 12 luni; copia conformă și ecusoanele, pe valabilitatea lor.
    const copyDays = draft.certifiedCopyYears * 365;
    if (draft.transportLicense.enabled) add({ id: "transport-license", category: "transport_license", label: "Licență de transport alternativ (împărțită pe 12 luni)", amount: draft.transportLicense.amount, period: "validity", validityDays: 365, oneTime: true, paidToFleet: false });
    if (draft.certifiedCopy.enabled) add({ id: "certified-copy", category: "certified_copy", label: `Copie conformă (${draft.certifiedCopyYears} ${draft.certifiedCopyYears === 1 ? "an" : "ani"})`, amount: draft.certifiedCopy.amount, period: "validity", validityDays: copyDays, paidToFleet: false });
    if (draft.badges.enabled) add({ id: "badges", category: "vehicle_badges", label: "Ecusoane", amount: draft.badges.amount, period: "validity", validityDays: copyDays, paidToFleet: false });
    if (draft.legalForm === "srl" && draft.managerCertificate.enabled) add({ id: "manager-certificate", category: "business_other", label: "Certificat manager de transport (împărțit pe 12 luni)", amount: draft.managerCertificate.amount, period: "validity", validityDays: 365, oneTime: true, paidToFleet: false });
  }
  if (ownBusiness) {
    if (draft.legalForm === "srl" && draft.salary.enabled) add({ id: "salary", category: "employee_salary", label: "Salariu (cost total firmă)", amount: draft.salary.amount, period: "monthly", paidToFleet: false });
    if (draft.bankFees.enabled) add({ id: "bank", category: "bank_fees", label: "Cont bancar și comisioane", amount: draft.bankFees.amount, period: draft.bankFees.period, paidToFleet: false });
    if (draft.otherBusiness.enabled) add({ id: "business-other", category: "business_other", label: draft.otherBusinessLabel || "Alt cost al firmei", amount: draft.otherBusiness.amount, period: draft.otherBusiness.period, paidToFleet: false });
  } else if (draft.otherFleetEnabled) {
    add({ id: "fleet-other", category: "fleet_withholding", label: draft.otherFleetLabel || "Altă reținere a flotei", amount: draft.otherFleet.amount, period: draft.otherFleet.period, paidToFleet: true });
  }
  if (draft.vehicleOwnership === "rented") {
    add({ id: "vehicle-rent", category: "vehicle_rent", label: vehicleType === "car" ? "Chirie auto" : "Chirie vehicul", amount: draft.rentWeekly, period: "weekly", paidToFleet: false });
  } else if (motorVehicle) {
    add({ id: "rca", category: "rca", label: "RCA", amount: draft.rcaAnnual, period: "annual", paidToFleet: false });
    if (draft.casco.enabled) add({ id: "casco", category: "casco", label: "CASCO", amount: draft.casco.amount, period: "annual", paidToFleet: false });
    if (draft.itp.enabled) add({ id: "itp", category: "itp", label: "ITP", amount: draft.itp.amount, period: "validity", validityDays: draft.itp.validityDays, paidToFleet: false });
    // Motocicletele și scuterele nu plătesc rovinietă.
    if (vehicleType === "car" && draft.vignette.enabled) add({ id: "vignette", category: "vignette", label: "Rovinietă", amount: draft.vignette.amount, period: "validity", validityDays: draft.vignette.validityDays, paidToFleet: false });
    if (draft.leasing.enabled) add({ id: "leasing", category: "leasing", label: "Rată / leasing", amount: draft.leasing.amount, period: "monthly", paidToFleet: false });
  }
  // Reviziile și reparațiile nu se știu dinainte: se trec în ziua în care apar.
  add({ id: "phone", category: "phone_internet", label: "Telefon și internet", amount: draft.phoneInternetMonthly, period: "monthly", paidToFleet: false });

  // Fără combustibil (bicicletă, trotinetă electrică): consum zero.
  // Scuterul merge doar pe benzină sau electric, orice ar fi rămas din altă alegere.
  const fuelType: FuelType = !motorVehicle
    ? "electric"
    : vehicleType === "moto" && draft.fuelType !== "electric"
      ? "gasoline"
      : draft.fuelType;
  const isHybrid = motorVehicle && fuelType.startsWith("hybrid");
  return {
    activity: draft.activity,
    workMode: draft.workMode,
    legalForm: ownBusiness ? draft.legalForm : null,
    taxRegime:
      ownBusiness && draft.legalForm && draft.taxRegime !== "unknown"
        ? draft.taxRegime
        : null,
    platform: delivery ? "bolt" : draft.platform,
    deliveryPlatforms: withDelivery ? draft.deliveryPlatforms : [],
    cityName: formatCityName(draft.city),
    cityKey: cityKey(draft.city),
    profitView: multiPlatform ? draft.profitView : "together",
    kilometerEntry: multiPlatform ? draft.kilometerEntry : "per_platform",
    vehicleOwnership: draft.vehicleOwnership,
    vehicleType,
    fuelType,
    hybridType: isHybrid ? draft.hybridType ?? "hev" : null,
    primaryFuel: motorVehicle && fuelType === "gasoline_lpg" ? draft.primaryFuel : null,
    consumptionPer100Km:
      !motorVehicle || (isHybrid && draft.hybridType === "phev")
        ? 0
        : draft.consumptionPer100Km,
    // La propria firmă banii intră direct în contul firmei: nu există flotă.
    // La delivery rămâne doar comisionul contractului de afiliere, dacă există.
    fleetCommission: affiliationPercent && delivery
      ? affiliationCommission
      : ownBusiness
        ? { type: "fixed", value: 0 }
        : ridesharingCommission,
    ...(deliveryFleetCommission ? { deliveryFleetCommission } : {}),
    weeklyCimCost: !ownBusiness && draft.paysCim ? draft.weeklyCimCost : 0,
    effectiveFrom: draft.effectiveFrom,
    recurringCosts,
    // Kilometrajul pornește jurnalul; fără el nu există alertă de revizie.
    ...(motorVehicle && draft.odometerKm > 0
      ? {
          vehicleService: {
            odometerKm: draft.odometerKm,
            odometerDate: draft.effectiveFrom,
            lastServiceKm: draft.lastServiceKm > 0 ? draft.lastServiceKm : null,
            lastServiceDate: /^\d{4}-\d{2}-\d{2}$/.test(draft.lastServiceDate) ? draft.lastServiceDate : null,
            intervalKm: draft.serviceIntervalKm > 0 ? draft.serviceIntervalKm : null,
            intervalMonths: draft.serviceIntervalMonths > 0 ? Math.min(120, draft.serviceIntervalMonths) : null,
          },
        }
      : {}),
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
  const delivery = draft.activity === "delivery";
  const both = draft.activity === "both";
  const withDelivery = delivery || both;
  const stepNames = stepNamesFor(draft.workMode, delivery ? draft.vehicleType : "car");
  const motorVehicle = !delivery || draft.vehicleType === "car" || draft.vehicleType === "moto";
  const multiPlatform = both || (delivery ? draft.deliveryPlatforms.length > 1 : draft.platform === "bolt_uber");
  const toggleDeliveryPlatform = (platform: DeliveryPlatform) =>
    set(
      "deliveryPlatforms",
      draft.deliveryPlatforms.includes(platform)
        ? draft.deliveryPlatforms.filter((item) => item !== platform)
        : [...draft.deliveryPlatforms, platform],
    );
  const canContinue =
    step === 2
      ? !withDelivery || draft.deliveryPlatforms.length > 0
      : step === 1
      ? draft.workMode === "employee" ||
        (draft.legalForm !== null && draft.taxRegime !== null)
      : step === 3
        ? cityKey(draft.city).length >= 2
        : step !== 6 || !motorVehicle || isPhev || draft.consumptionPer100Km > 0;

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
            <Step title="Ce tip de activitate faci?" description="Îți arătăm doar rubricile și costurile care se potrivesc activității tale.">
              <div className="choice-grid three">
                <Choice value="ridesharing" selected={draft.activity === "ridesharing"} label="Ridesharing" detail="Bolt, Uber sau ambele" onSelect={(value) => set("activity", value)} />
                <Choice value="delivery" selected={draft.activity === "delivery"} label="Delivery" detail="Glovo, Wolt și Bolt Food" onSelect={(value) => set("activity", value)} />
                <Choice value="both" selected={both} label="Ambele" detail="Ridesharing și livrări, cu aceeași mașină" onSelect={(value) => set("activity", value)} />
              </div>
            </Step>
          ) : null}

          {step === 1 ? (
            <Step title={both ? "Cum lucrezi?" : `Cum lucrezi pentru ${delivery ? "delivery" : "ridesharing"}?`} description="Îți arătăm doar costurile care se potrivesc situației tale.">
              <div className="choice-grid">
                <Choice value="employee" selected={draft.workMode === "employee"} label="Angajat" detail={both ? "Lucrez prin flotă, la ridesharing și la livrări" : delivery ? "Lucrez prin firma unei flote, parteneră cu aplicațiile" : "Lucrez pentru o firmă de transport alternativ (flotă)"} onSelect={(value) => set("workMode", value)} />
                <Choice value="own_business" selected={draft.workMode === "own_business"} label="Propriul SRL/PFA" detail={delivery ? "Am firma mea și livrez pe ea" : both ? "Am firma mea, cu autorizație de transport alternativ, și livrez pe ea" : "Am firma mea, cu autorizație de transport alternativ"} onSelect={(value) => set("workMode", value)} />
              </div>
              {draft.workMode === "own_business" ? <div className="inline-question"><strong>Ce formă are firma ta?</strong><div className="segmented">{(["srl", "pfa"] as LegalForm[]).map((form) => <button key={form} type="button" className={draft.legalForm === form ? "selected" : ""} aria-pressed={draft.legalForm === form} onClick={() => { set("legalForm", form); if (draft.legalForm !== form) set("taxRegime", null); }}>{legalFormLabels[form]}</button>)}</div>{draft.legalForm ? <><strong>Cum este impozitat {legalFormLabels[draft.legalForm]}-ul?</strong><div className="segmented">{[...taxRegimesFor(draft.legalForm), "unknown" as const].map((regime) => <button key={regime} type="button" className={draft.taxRegime === regime ? "selected" : ""} aria-pressed={draft.taxRegime === regime} onClick={() => set("taxRegime", regime)}>{regime === "unknown" ? "Nu știu încă" : taxRegimeLabels[regime]}</button>)}</div><p className="step-description">{draft.taxRegime && draft.taxRegime !== "unknown" ? taxRegimeDescriptions[draft.taxRegime] : "Contabilul tău știe sigur. Poți schimba alegerea oricând."}{draft.taxRegime === "norm" ? " Norma de venit nu este disponibilă pentru orice activitate; verifică cu contabilul." : ""}</p></> : null}<p className="step-description">{both ? "Banii intră în contul firmei, deci nu există regularizare cu o flotă. Costurile firmei, cele ARR și eventualul contract de afiliere pentru livrări le configurezi la pasul „Firmă”." : delivery ? "Nu există regularizare cu o flotă. Dacă lucrezi printr-un contract de afiliere, comisionul lui și costurile firmei le configurezi la pasul „Firmă”." : "Banii din aplicație intră direct în contul firmei, deci nu există comision de flotă sau regularizare. Costurile firmei le configurezi tu, la pasul „Firmă”."}</p></div> : null}
            </Step>
          ) : null}

          {step === 2 ? (
            <Step title={delivery ? "Pe ce aplicații livrezi?" : "Pe ce platformă lucrezi?"} description={delivery ? "Alege toate aplicațiile pe care lucrezi. Încasările rămân vizibile pe fiecare." : "Încasările rămân vizibile per platformă."}>
              {both ? <><div className="choice-grid three">
                {(["bolt", "uber", "bolt_uber"] as PlatformChoice[]).map((platform) => (
                  <Choice key={platform} value={platform} selected={draft.platform === platform} label={platformLabels[platform]} detail={platform === "bolt_uber" ? "Folosesc ambele platforme" : `Lucrez pe ${platformLabels[platform]}`} onSelect={(value) => set("platform", value)} />
                ))}
              </div><div className="inline-question"><strong>Și pe ce aplicații livrezi?</strong></div><div className="choice-grid three">
                {(["glovo", "wolt", "bolt_food"] as DeliveryPlatform[]).map((platform) => (
                  <Choice key={platform} value={platform} selected={draft.deliveryPlatforms.includes(platform)} label={platformLabels[platform]} detail={draft.deliveryPlatforms.includes(platform) ? "Ales" : "Apasă ca să o adaugi"} onSelect={toggleDeliveryPlatform} />
                ))}
              </div></> : delivery ? <div className="choice-grid three">
                {(["glovo", "wolt", "bolt_food"] as DeliveryPlatform[]).map((platform) => (
                  <Choice key={platform} value={platform} selected={draft.deliveryPlatforms.includes(platform)} label={platformLabels[platform]} detail={draft.deliveryPlatforms.includes(platform) ? "Ales" : "Apasă ca să o adaugi"} onSelect={toggleDeliveryPlatform} />
                ))}
              </div> : <div className="choice-grid three">
                {(["bolt", "uber", "bolt_uber"] as PlatformChoice[]).map((platform) => (
                  <Choice key={platform} value={platform} selected={draft.platform === platform} label={platformLabels[platform]} detail={platform === "bolt_uber" ? "Folosesc ambele platforme" : `Lucrez pe ${platformLabels[platform]}`} onSelect={(value) => set("platform", value)} />
                ))}
              </div>}
              {multiPlatform ? <><div className="inline-question"><strong>Cum dorești să vezi rezultatul?</strong><div className="segmented"><button type="button" className={draft.profitView === "together" ? "selected" : ""} onClick={() => set("profitView", "together")}>Împreună</button><button type="button" className={draft.profitView === "separate" ? "selected" : ""} onClick={() => set("profitView", "separate")}>Separat pe platformă</button></div></div><div className="inline-question"><strong>Cum introduci kilometrii?</strong><div className="segmented"><button type="button" className={draft.kilometerEntry === "per_platform" ? "selected" : ""} onClick={() => set("kilometerEntry", "per_platform")}>Pe fiecare aplicație</button><button type="button" className={draft.kilometerEntry === "shared" ? "selected" : ""} onClick={() => set("kilometerEntry", "shared")}>Un singur total</button></div><p className="step-description">{draft.kilometerEntry === "per_platform" ? `Iei kilometrii din ecranul fiecărei aplicații. Exacți pe platformă, dar nu cuprind ${delivery ? "drumul până la restaurant, mersul între comenzi" : "drumul până la client, mersul între curse"} și drumul spre casă.` : "Introduci kilometrii reali ai zilei, cu tot cu mersul în gol, deci combustibilul iese corect. Repartizarea pe platformă se face proporțional cu încasările."}</p></div></> : null}
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
            </Step>
          ) : null}

          {step === 4 ? (
            delivery ? <Step title="Cu ce livrezi?" description="La bicicletă nu există combustibil de calculat; la scuter și mașină, da.">
              <div className="choice-grid">
                {(["bicycle", "e_bike", "moto", "car"] as VehicleType[]).map((type) => <Choice key={type} value={type} selected={draft.vehicleType === type} label={vehicleTypeLabels[type]} detail={{ bicycle: "Fără combustibil", e_bike: "Încărcarea costă foarte puțin", moto: "Combustibil, RCA, ITP", car: "Combustibil, RCA, ITP, rovinietă" }[type]} onSelect={(value) => set("vehicleType", value)} />)}
              </div>
              <div className="inline-question"><strong>Vehiculul este al tău sau închiriat?</strong><div className="segmented"><button type="button" className={draft.vehicleOwnership === "owned" ? "selected" : ""} aria-pressed={draft.vehicleOwnership === "owned"} onClick={() => set("vehicleOwnership", "owned")}>Al meu</button><button type="button" className={draft.vehicleOwnership === "rented" ? "selected" : ""} aria-pressed={draft.vehicleOwnership === "rented"} onClick={() => set("vehicleOwnership", "rented")}>Închiriat</button></div></div>
            </Step> : <Step title="Mașina este personală sau închiriată?" description="Costurile afișate în pasul următor depind de această alegere.">
              <div className="choice-grid">
                <Choice value="owned" selected={draft.vehicleOwnership === "owned"} label="Mașină personală" detail="RCA, CASCO, ITP, rovinietă, leasing și cartea de service" onSelect={(value) => set("vehicleOwnership", value)} />
                <Choice value="rented" selected={draft.vehicleOwnership === "rented"} label="Mașină închiriată" detail="Chirie săptămânală, combustibil și spălări" onSelect={(value) => set("vehicleOwnership", value)} />
              </div>
            </Step>
          ) : null}

          {step === 5 ? draft.workMode === "own_business" ? <BusinessStep draft={draft} set={set} /> : <FleetStep draft={draft} set={set} /> : null}
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
        {draft.commissionType === "percentage" ? <label className="onboarding-field"><span>Comision aplicat la</span><select value={draft.commissionBase} onChange={(event) => set("commissionBase", event.target.value as Draft["commissionBase"])}><option value="net">Net — „Câștigurile tale” din aplicație (card + cash)</option><option value="gross">Brut — înainte de comisionul aplicației</option></select></label> : null}
      </div>

      {draft.activity === "both" ? <div className="cost-options">
        <ConditionalCost title="Flota ia alt comision la livrări?" enabled={draft.deliveryCommissionDiffers} onToggle={(enabled) => set("deliveryCommissionDiffers", enabled)}>
          <label className="onboarding-field"><span>Tip comision la livrări</span><select value={draft.deliveryCommissionType} onChange={(event) => set("deliveryCommissionType", event.target.value as Draft["deliveryCommissionType"])}><option value="percentage">Procent</option><option value="fixed">Sumă fixă</option></select></label>
          <NumberInput label="Comision la livrări" value={draft.deliveryCommissionValue} onChange={(value) => set("deliveryCommissionValue", value)} suffix={draft.deliveryCommissionType === "percentage" ? "%" : "RON"} />
          {draft.deliveryCommissionType === "percentage" ? <label className="onboarding-field"><span>Comision la livrări aplicat la</span><select value={draft.deliveryCommissionBase} onChange={(event) => set("deliveryCommissionBase", event.target.value as Draft["deliveryCommissionBase"])}><option value="net">Net — câștigurile din aplicația de livrări</option><option value="gross">Brut</option></select></label> : null}
        </ConditionalCost>
        {!draft.deliveryCommissionDiffers ? <p className="field-note">Altfel, comisionul de mai sus se aplică și la livrări.</p> : null}
      </div> : null}

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

function BusinessStep({ draft, set }: { draft: Draft; set: DraftSetter }) {
  type Key = "accounting" | "cashRegister" | "transportLicense" | "certifiedCopy" | "badges" | "managerCertificate" | "salary" | "bankFees" | "otherBusiness";
  const updateCost = (key: Key, patch: Partial<CostDraft>) => set(key, { ...draft[key], ...patch });
  const srl = draft.legalForm === "srl";
  const form = draft.legalForm ? legalFormLabels[draft.legalForm] : "firmei";
  const years = draft.certifiedCopyYears;
  const delivery = draft.activity === "delivery";
  // La „Ambele” apar și costurile ARR (ridesharing), și afilierea (livrări).
  const showArr = draft.activity !== "delivery";
  const showAffiliation = draft.activity !== "ridesharing";

  return (
    <Step title={`Ce costuri are ${draft.legalForm ? `${form}-ul tău` : "firma ta"}?`} description="Activează numai costurile pe care le plătești în realitate și trece sumele tale. Exemplele din câmpuri sunt tarifele obișnuite; le poți schimba oricând. ProfitExact le împarte automat pe zi, săptămână și lună.">
      <div className="onboarding-grid">
        <label className="onboarding-field"><span>Data de la care se aplică</span><input type="date" value={draft.effectiveFrom} onChange={(event) => set("effectiveFrom", event.target.value)} /></label>
      </div>

      {showAffiliation ? <div className="cost-options">
        <h3>Contract de afiliere{showArr ? " (livrări)" : ""}</h3>
        <ConditionalCost title="Beneficiezi de un contract de afiliere?" enabled={draft.hasAffiliation} onToggle={(enabled) => set("hasAffiliation", enabled)}>
          <p className="field-note full">Contractul cu o firmă care are contract direct cu aplicația de livrări.</p>
          <label className="onboarding-field"><span>Ce comision plătești?</span><select value={draft.affiliationType} onChange={(event) => set("affiliationType", event.target.value as Draft["affiliationType"])}><option value="percentage">Procent din încasări</option><option value="fixed">Sumă fixă</option></select></label>
          {draft.affiliationType === "percentage"
            ? <NumberInput label="Comision" value={draft.affiliationPercent} onChange={(value) => set("affiliationPercent", value)} suffix="%" placeholder="ex. 10" />
            : <><NumberInput label="Sumă" value={draft.affiliationFixed.amount} onChange={(amount) => set("affiliationFixed", { ...draft.affiliationFixed, amount })} /><PeriodSelect value={draft.affiliationFixed.period} onChange={(period) => set("affiliationFixed", { ...draft.affiliationFixed, period })} /></>}
        </ConditionalCost>
      </div> : null}

      {showArr ? <div className="cost-options">
        <h3>Costuri ARR pentru transport alternativ</h3>
        <p className="field-note">În ordinea în care se obțin: întâi licența, apoi copia conformă pentru fiecare mașină, apoi ecusoanele.</p>
        <ConditionalCost title="1. Licență de transport alternativ" enabled={draft.transportLicense.enabled} onToggle={(enabled) => updateCost("transportLicense", { enabled })}>
          <NumberInput label="Suma plătită" value={draft.transportLicense.amount} onChange={(amount) => updateCost("transportLicense", { amount })} placeholder="ex. 300" />
          <p className="field-note full">Se plătește o singură dată, la eliberare. ProfitExact o împarte pe primele 12 luni de la data de mai sus. Dacă ai plătit-o demult, nu o bifa.</p>
        </ConditionalCost>
        <ConditionalCost title="2. Copie conformă" enabled={draft.certifiedCopy.enabled} onToggle={(enabled) => updateCost("certifiedCopy", { enabled })}>
          <label className="onboarding-field"><span>Valabilitate</span><select value={years} onChange={(event) => set("certifiedCopyYears", Number(event.target.value) as Draft["certifiedCopyYears"])}><option value={1}>1 an</option><option value={2}>2 ani</option><option value={3}>3 ani</option></select></label>
          <NumberInput label={`Suma plătită pentru ${years === 1 ? "un an" : `${years} ani`}, toate mașinile`} value={draft.certifiedCopy.amount} onChange={(amount) => updateCost("certifiedCopy", { amount })} placeholder={`ex. ${100 * years}`} />
          <p className="field-note full">Tariful ARR este de obicei 100 lei pe an pentru fiecare mașină.</p>
        </ConditionalCost>
        <ConditionalCost title="3. Ecusoane" enabled={draft.badges.enabled} onToggle={(enabled) => updateCost("badges", { enabled })}>
          <NumberInput label="Suma plătită, toate mașinile" value={draft.badges.amount} onChange={(amount) => updateCost("badges", { amount })} placeholder="ex. 16" />
          <p className="field-note full">De obicei 8 lei/ecuson: 16 lei pentru o mașină pe Bolt și Uber. Țin cât copia conformă ({years === 1 ? "1 an" : `${years} ani`}).</p>
        </ConditionalCost>
        {srl ? <ConditionalCost title="Certificat de manager de transport" enabled={draft.managerCertificate.enabled} onToggle={(enabled) => updateCost("managerCertificate", { enabled })}>
          <NumberInput label="Suma plătită (curs și examen)" value={draft.managerCertificate.amount} onChange={(amount) => updateCost("managerCertificate", { amount })} />
          <p className="field-note full">Obligatoriu la SRL, pentru managerul de transport. Se plătește o singură dată și se împarte pe primele 12 luni.</p>
        </ConditionalCost> : null}
      </div> : null}

      <div className="cost-options">
        <h3>Costurile {srl ? "SRL-ului" : draft.legalForm === "pfa" ? "PFA-ului" : "firmei"}</h3>
        <ConditionalCost title="Plătești contabilitate?" enabled={draft.accounting.enabled} onToggle={(enabled) => updateCost("accounting", { enabled })}>
          <NumberInput label="Cost contabilitate" value={draft.accounting.amount} onChange={(amount) => updateCost("accounting", { amount })} />
          <PeriodSelect value={draft.accounting.period} onChange={(period) => updateCost("accounting", { period })} />
          <p className="field-note full">{srl ? "SRL-ul ține contabilitate în partidă dublă, de obicei printr-un contabil." : "La PFA nu ești obligat să ai contabil: evidența în partidă simplă o poți ține și singur. Mulți apelează totuși la unul."}</p>
        </ConditionalCost>
        {srl ? <ConditionalCost title={delivery ? "Salariu: tu sau un angajat" : "Salariu: tu sau șoferul angajat"} enabled={draft.salary.enabled} onToggle={(enabled) => updateCost("salary", { enabled })}>
          <NumberInput label="Cost total lunar pentru firmă" value={draft.salary.amount} onChange={(amount) => updateCost("salary", { amount })} />
          <p className="field-note full">{delivery ? "Dacă firma are un angajat, chiar și pe tine, trece suma totală plătită de firmă: salariul și contribuțiile, cum apar în statul de plată." : "La SRL, cine conduce trebuie să fie angajatul firmei, chiar dacă ești tu, ca asociat. Trece suma totală plătită de firmă: salariul și contribuțiile, cum apar în statul de plată."}</p>
        </ConditionalCost> : null}
        {!showArr ? null : <ConditionalCost title="Costuri casă de marcat" enabled={draft.cashRegister.enabled} onToggle={(enabled) => updateCost("cashRegister", { enabled })}>
          <NumberInput label="Cost" value={draft.cashRegister.amount} onChange={(amount) => updateCost("cashRegister", { amount })} />
          <PeriodSelect value={draft.cashRegister.period} onChange={(period) => updateCost("cashRegister", { period })} />
        </ConditionalCost>}
        <ConditionalCost title="Plătești cont bancar sau comisioane bancare?" enabled={draft.bankFees.enabled} onToggle={(enabled) => updateCost("bankFees", { enabled })}>
          <NumberInput label="Cost" value={draft.bankFees.amount} onChange={(amount) => updateCost("bankFees", { amount })} />
          <PeriodSelect value={draft.bankFees.period} onChange={(period) => updateCost("bankFees", { period })} />
        </ConditionalCost>
        <ConditionalCost title="Ai alt cost fix al firmei?" enabled={draft.otherBusiness.enabled} onToggle={(enabled) => updateCost("otherBusiness", { enabled })}>
          <label className="onboarding-field"><span>Denumire</span><input type="text" value={draft.otherBusinessLabel} placeholder="ex. sediu social, semnătură electronică" onChange={(event) => set("otherBusinessLabel", event.target.value)} /></label>
          <NumberInput label="Valoare" value={draft.otherBusiness.amount} onChange={(amount) => updateCost("otherBusiness", { amount })} />
          <PeriodSelect value={draft.otherBusiness.period} onChange={(period) => updateCost("otherBusiness", { period })} />
        </ConditionalCost>
      </div>
      <p className="field-note">Impozitul și contribuțiile (CAS, CASS) nu sunt încă incluse: rezultatul arătat este înainte de taxe.</p>
    </Step>
  );
}

function VehicleCostsStep({ draft, set }: { draft: Draft; set: DraftSetter }) {
  const vehicleType: VehicleType = draft.activity === "delivery" ? draft.vehicleType : "car";
  const car = vehicleType === "car";
  const moto = vehicleType === "moto";
  const motorVehicle = car || moto;
  const isHybrid = car && (draft.fuelType === "hybrid_gasoline" || draft.fuelType === "hybrid_diesel");
  const isPhev = isHybrid && draft.hybridType === "phev";
  const updateCost = (
    key: "casco" | "itp" | "vignette" | "leasing",
    patch: Partial<CostDraft>,
  ) => set(key, { ...draft[key], ...patch });
  const unit = draft.fuelType === "electric" ? "kWh/100 km" : "litri/100 km";
  // Scuterele și motocicletele merg pe benzină sau electric.
  const fuelOptions: FuelType[] = moto ? ["gasoline", "electric"] : (Object.keys(fuelLabels) as FuelType[]);
  const vehicleName = car ? "Mașină" : moto ? "Scuter / motocicletă" : vehicleTypeLabels[vehicleType];

  return (
    <Step title={car ? "Configurează mașina și costurile recurente" : "Configurează vehiculul și costurile recurente"} description="ProfitExact le va împărți automat pe zi, săptămână și lună. Valorile zero nu sunt activate.">
      {motorVehicle ? <div className="onboarding-grid">
        <label className="onboarding-field full"><span>Tip combustibil / propulsie</span><select value={fuelOptions.includes(draft.fuelType) ? draft.fuelType : fuelOptions[0]} onChange={(event) => { const fuelType = event.target.value as FuelType; set("fuelType", fuelType); if (!fuelType.startsWith("hybrid")) set("hybridType", null); }}>
          {fuelOptions.map((fuel) => <option key={fuel} value={fuel}>{fuelLabels[fuel]}</option>)}
        </select></label>
        {isHybrid ? <label className="onboarding-field"><span>Tip hibrid</span><select value={draft.hybridType ?? "hev"} onChange={(event) => set("hybridType", event.target.value as HybridType)}><option value="hev">HEV</option><option value="phev">Plug-in / PHEV</option></select></label> : null}
        {car && draft.fuelType === "gasoline_lpg" ? <label className="onboarding-field"><span>Combustibil principal</span><select value={draft.primaryFuel} onChange={(event) => set("primaryFuel", event.target.value as Draft["primaryFuel"])}><option value="lpg">GPL</option><option value="gasoline">Benzină</option></select></label> : null}
        {!isPhev ? <NumberInput label="Consum aproximativ" value={draft.consumptionPer100Km} onChange={(value) => set("consumptionPer100Km", value)} suffix={unit} placeholder={moto ? "ex. 3" : "ex. 8,5"} /> : <p className="field-note full">Pentru PHEV vei introduce separat costul benzinei și costul încărcării electrice în fiecare zi lucrată.</p>}
      </div> : <p className="field-note">{vehicleType === "bicycle" ? "La bicicletă nu există combustibil: calculul folosește doar încasările și costurile de mai jos." : "Încărcarea bateriei costă foarte puțin, așa că nu o calculăm pe kilometru. Dacă vrei, o poți trece la „Alt cost” sau o incluzi în întreținere."}</p>}

      {draft.vehicleOwnership === "rented" ? (
        <div className="cost-options compact"><h3>{vehicleName} închiriat{car ? "ă" : ""}</h3><NumberInput label="Chirie pe săptămână" value={draft.rentWeekly} onChange={(value) => set("rentWeekly", value)} placeholder={car ? "ex. 700" : "ex. 100"} /></div>
      ) : motorVehicle ? (
        <div className="cost-options">
          <h3>{car ? "Mașină personală" : "Scuter / motocicletă personală"}</h3>
          <NumberInput label="RCA anual" value={draft.rcaAnnual} onChange={(value) => set("rcaAnnual", value)} placeholder={car ? "ex. 2.000" : "ex. 500"} />
          <ConditionalCost title="Ai CASCO?" enabled={draft.casco.enabled} onToggle={(enabled) => updateCost("casco", { enabled })}><NumberInput label="CASCO anual" value={draft.casco.amount} onChange={(amount) => updateCost("casco", { amount })} /></ConditionalCost>
          <ValidityCost title="Adaugi costul ITP?" cost={draft.itp} onChange={(patch) => updateCost("itp", patch)} />
          {car ? <ValidityCost title="Adaugi rovinieta?" cost={draft.vignette} onChange={(patch) => updateCost("vignette", patch)} /> : null}
          <ConditionalCost title="Ai rată, finanțare sau leasing?" enabled={draft.leasing.enabled} onToggle={(enabled) => updateCost("leasing", { enabled })}><NumberInput label="Rată lunară" value={draft.leasing.amount} onChange={(amount) => updateCost("leasing", { amount })} /></ConditionalCost>
        </div>
      ) : (
        <div className="cost-options">
          <h3>{vehicleTypeLabels[vehicleType]} personală</h3>
          <p className="field-note">Reviziile și reparațiile nu se știu dinainte: le treci în ziua în care apar, iar aplicația le păstrează la „Reparațiile bicicletei”.</p>
        </div>
      )}
      {motorVehicle ? <ServiceSetup draft={draft} set={set} vehicleType={vehicleType} /> : null}
      <div className="shared-cost"><NumberInput label="Telefon și internet / lună" value={draft.phoneInternetMonthly} onChange={(value) => set("phoneInternetMonthly", value)} /></div>
    </Step>
  );
}

/**
 * Pornirea jurnalului: kilometrajul de acum și, opțional, revizia.
 * Reviziile și reparațiile nu se cer în bani aici: nu se știu dinainte.
 */
function ServiceSetup({ draft, set, vehicleType }: { draft: Draft; set: DraftSetter; vehicleType: VehicleType }) {
  const examples = serviceIntervalExamples[vehicleType];
  const name = vehicleShortNames[vehicleType];
  return (
    <div className="cost-options service-setup">
      <h3>Kilometraj și revizie</h3>
      <p className="field-note full">
        Pentru cartea de service a {vehicleType === "car" ? "mașinii" : "scuterului"}: aplicația ține minte reviziile și reparațiile și te anunță cu roșu când se apropie revizia.
        {draft.vehicleOwnership === "rented" ? " Chiar dacă revizia o face firma de închiriere, alerta te ajută să le spui la timp." : ""} Toate sunt opționale.
      </p>
      <div className="onboarding-grid">
        <NumberInput label={`Kilometrajul ${name === "mașină" ? "mașinii" : "scuterului"} acum`} value={draft.odometerKm} onChange={(value) => set("odometerKm", Math.round(value))} suffix="km" placeholder={vehicleType === "car" ? "ex. 187.400" : "ex. 23.500"} />
        <NumberInput label="Ultima revizie, la kilometrajul" value={draft.lastServiceKm} onChange={(value) => set("lastServiceKm", Math.round(value))} suffix="km" placeholder={vehicleType === "car" ? "ex. 180.000" : "ex. 20.000"} />
        <label className="onboarding-field"><span>Data ultimei revizii</span><input type="date" value={draft.lastServiceDate} max={draft.effectiveFrom} onChange={(event) => set("lastServiceDate", event.target.value)} /></label>
        <NumberInput label="Revizie la fiecare" value={draft.serviceIntervalKm} onChange={(value) => set("serviceIntervalKm", Math.round(value))} suffix="km" placeholder={examples.km} />
        <NumberInput label="Sau la fiecare" value={draft.serviceIntervalMonths} onChange={(value) => set("serviceIntervalMonths", Math.round(value))} suffix="luni" placeholder={examples.months} />
      </div>
      {draft.odometerKm <= 0 && (draft.serviceIntervalKm > 0 || draft.lastServiceKm > 0) ? <p className="field-note full">Fără kilometrajul de acum nu putem calcula cât mai ai până la revizie.</p> : null}
    </div>
  );
}

function ConditionalCost({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (enabled: boolean) => void; children: React.ReactNode }) {
  return <div className={`conditional-cost ${enabled ? "enabled" : ""}`}><label className="switch-line"><input type="checkbox" checked={enabled} onChange={(event) => onToggle(event.target.checked)} /><span>{title}</span></label>{enabled ? <div className="conditional-fields">{children}</div> : null}</div>;
}

function ValidityCost({ title, cost, onChange }: { title: string; cost: CostDraft; onChange: (patch: Partial<CostDraft>) => void }) {
  return <ConditionalCost title={title} enabled={cost.enabled} onToggle={(enabled) => onChange({ enabled })}><NumberInput label="Cost" value={cost.amount} onChange={(amount) => onChange({ amount })} /><NumberInput label="Valabilitate" value={cost.validityDays ?? 365} onChange={(validityDays) => onChange({ validityDays })} suffix="zile" /></ConditionalCost>;
}

function Summary({ config }: { config: OnboardingConfig }) {
  const ownBusiness = config.workMode === "own_business";
  // Comisionul de afiliere: la delivery în `fleetCommission`, la „Ambele” în `deliveryFleetCommission`.
  const affiliationCommission = config.activity === "both" ? config.deliveryFleetCommission : config.fleetCommission;
  const affiliation = ownBusiness && config.activity !== "ridesharing" && affiliationCommission?.type === "percentage" && affiliationCommission.value > 0;
  const deliveryCommission = !ownBusiness && config.deliveryFleetCommission
    ? config.deliveryFleetCommission.type === "fixed"
      ? `${config.deliveryFleetCommission.value} RON`
      : `${config.deliveryFleetCommission.value}% din ${config.deliveryFleetCommission.base === "gross" ? "brut" : "net"}`
    : null;
  const vehicle = config.activity === "delivery"
    ? `${vehicleTypeLabels[config.vehicleType]} · ${config.vehicleOwnership === "owned" ? "al meu" : "închiriat"}`
    : config.vehicleOwnership === "owned" ? "Mașină personală" : "Mașină închiriată";
  const commission = config.fleetCommission.type === "fixed" ? `${config.fleetCommission.value} RON` : `${config.fleetCommission.value}% din ${config.fleetCommission.base === "gross" ? "brut" : "net"}`;
  return <Step title="Verifică înainte de confirmare" description="Aceste date rămân în profil și se folosesc automat pentru zilele și perioadele următoare."><dl className="summary-list"><div><dt>Activitate</dt><dd>{activityLabels[config.activity]} · {workModeLabel(config)}</dd></div>{config.legalForm ? <div><dt>Impozitare</dt><dd>{config.taxRegime ? taxRegimeLabels[config.taxRegime] : "Nu știu încă"}</dd></div> : null}<div><dt>{config.activity === "delivery" ? "Aplicații" : "Platformă"}</dt><dd>{configPlatformsLabel(config)}</dd></div><div><dt>Oraș</dt><dd>{config.cityName}</dd></div><div><dt>Vehicul</dt><dd>{vehicle}</dd></div>{config.vehicleService ? <div><dt>Kilometraj</dt><dd>{config.vehicleService.odometerKm.toLocaleString("ro-RO")} km{config.vehicleService.intervalKm ? ` · revizie la ${config.vehicleService.intervalKm.toLocaleString("ro-RO")} km` : ""}{config.vehicleService.intervalMonths ? ` sau ${config.vehicleService.intervalMonths} luni` : ""}</dd></div> : null}{usesFuel(config) ? <div><dt>Propulsie</dt><dd>{fuelLabels[config.fuelType]}{config.hybridType ? ` · ${config.hybridType.toUpperCase()}` : ""}</dd></div> : null}{affiliation ? <div><dt>Comision afiliere</dt><dd>{affiliationCommission?.value}% din încasări{config.activity === "both" ? " de livrări" : ""}</dd></div> : null}{ownBusiness ? null : <><div><dt>{deliveryCommission ? "Comision flotă la ridesharing" : "Comision flotă"}</dt><dd>{commission}</dd></div>{deliveryCommission ? <div><dt>Comision flotă la livrări</dt><dd>{deliveryCommission}</dd></div> : null}<div><dt>CIM săptămânal</dt><dd>{config.weeklyCimCost.toLocaleString("ro-RO")} RON</dd></div></>}<div><dt>Costuri recurente</dt><dd>{config.recurringCosts.length ? `${config.recurringCosts.length} configurate` : "Niciun cost opțional"}</dd></div></dl><div className="summary-costs">{config.recurringCosts.map((cost) => <span key={cost.id}>{cost.label}: {cost.amount.toLocaleString("ro-RO")} RON {cost.oneTime ? "o singură dată" : cost.period === "validity" ? `pentru ${cost.validityDays ?? 0} zile` : `/ ${periodLabel(cost.period)}`}</span>)}</div></Step>;
}

function periodLabel(period: CostPeriod) {
  return { weekly: "săptămână", monthly: "lună", annual: "an", validity: "valabilitate" }[period];
}
