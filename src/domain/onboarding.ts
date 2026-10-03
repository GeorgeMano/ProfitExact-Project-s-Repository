import type { FleetCommission } from "@/lib/finance/daily-result";
import type { DeliveryPlatform, KilometerEntryMode, PlatformKey } from "@/lib/finance/platform-entry";
import type { VehicleServiceConfig } from "@/lib/finance/vehicle-service";

export type { DeliveryPlatform, KilometerEntryMode };

/** „both” = ridesharing și delivery în același cont, cu aceeași mașină. */
export type Activity = "ridesharing" | "delivery" | "both";
/**
 * Cu ce se lucrează. La ridesharing este întotdeauna mașina; la delivery
 * se poate livra și cu bicicleta (fără combustibil) sau cu scuterul.
 */
export type VehicleType = "car" | "moto" | "e_bike" | "bicycle";

export type PlatformChoice = "bolt" | "uber" | "bolt_uber";
export type ProfitView = "together" | "separate";
export type VehicleOwnership = "owned" | "rented";
export type FuelType =
  | "gasoline"
  | "diesel"
  | "electric"
  | "gasoline_lpg"
  | "hybrid_gasoline"
  | "hybrid_diesel";
export type HybridType = "hev" | "phev" | null;
export type CostPeriod = "weekly" | "monthly" | "annual" | "validity";
/**
 * Angajat la o flotă (firmă de transport alternativ) sau propria firmă.
 * La propria firmă banii din aplicație intră direct în contul firmei: nu
 * există comision de flotă, CIM plătit flotei sau regularizare.
 */
export type WorkMode = "employee" | "own_business";
export type LegalForm = "srl" | "pfa";
/**
 * Cum este impozitată firma; contează pentru estimarea taxelor.
 *   SRL: microîntreprindere (impozit pe venituri) sau impozit pe profit.
 *   PFA: sistem real (venituri − cheltuieli) sau normă de venit (sumă fixă
 *        stabilită pe județ).
 * null = utilizatorul nu știe încă.
 */
export type TaxRegime = "micro" | "profit" | "real" | "norm";

export interface RecurringCostConfig {
  id: string;
  category:
    | "accounting"
    | "cash_register"
    | "fleet_withholding"
    | "vehicle_rent"
    | "rca"
    | "casco"
    | "itp"
    | "vignette"
    | "leasing"
    | "phone_internet"
    | "arr_authorization"
    | "transport_license"
    | "certified_copy"
    | "vehicle_badges"
    | "affiliation_fee"
    | "vehicle_maintenance"
    | "employee_salary"
    | "bank_fees"
    | "business_other";
  label: string;
  amount: number;
  period: CostPeriod;
  validityDays?: number;
  effectiveFrom: string;
  paidToFleet: boolean;
  /**
   * Plătit o singură dată (de exemplu licența de transport): se împarte pe
   * `validityDays` de la `effectiveFrom`, apoi nu se mai adaugă.
   */
  oneTime?: boolean;
}

export interface OnboardingConfig {
  activity: Activity;
  workMode: WorkMode;
  /** Numai pentru propria firmă; la angajat este întotdeauna null. */
  legalForm: LegalForm | null;
  /** Numai pentru SRL. */
  taxRegime: TaxRegime | null;
  /** Bolt/Uber, numai la ridesharing. */
  platform: PlatformChoice;
  /** Aplicațiile de livrări alese, numai la delivery. */
  deliveryPlatforms: DeliveryPlatform[];
  cityName: string;
  cityKey: string;
  profitView: ProfitView;
  /**
   * Contează numai când se lucrează pe două platforme: kilometrii se introduc
   * pe fiecare aplicație, sau ca un singur total al zilei repartizat după
   * încasări. Vezi `KilometerEntryMode`.
   */
  kilometerEntry: KilometerEntryMode;
  vehicleOwnership: VehicleOwnership;
  vehicleType: VehicleType;
  fuelType: FuelType;
  hybridType: HybridType;
  primaryFuel: "gasoline" | "lpg" | null;
  consumptionPer100Km: number;
  /**
   * Angajat: comisionul flotei. Propria firmă de delivery: comisionul
   * contractului de afiliere. Propria firmă de ridesharing: zero.
   */
  fleetCommission: FleetCommission;
  /**
   * Numai la „Ambele”: comisionul oprit din încasările de delivery, dacă
   * diferă de cel de la ridesharing (altă flotă sau contractul de afiliere).
   * Lipsă = același comision ca la ridesharing.
   */
  deliveryFleetCommission?: FleetCommission;
  weeklyCimCost: number;
  effectiveFrom: string;
  recurringCosts: RecurringCostConfig[];
  /**
   * Kilometrajul și intervalul de revizie, pentru jurnalul vehiculului.
   * Numai la mașină și scuter: la bicicletă nu se cer kilometri.
   */
  vehicleService?: VehicleServiceConfig;
}

export const fuelLabels: Record<FuelType, string> = {
  gasoline: "Benzină",
  diesel: "Motorină",
  electric: "Electric",
  gasoline_lpg: "Benzină + GPL",
  hybrid_gasoline: "Hibrid pe benzină",
  hybrid_diesel: "Hibrid diesel",
};

export const legalFormLabels: Record<LegalForm, string> = {
  srl: "SRL",
  pfa: "PFA",
};

export const taxRegimeLabels: Record<TaxRegime, string> = {
  micro: "Microîntreprindere",
  profit: "Impozit pe profit",
  real: "Sistem real",
  norm: "Normă de venit",
};

export const taxRegimeDescriptions: Record<TaxRegime, string> = {
  micro: "Microîntreprinderea plătește un impozit pe veniturile firmei, chiar dacă are cheltuieli mari.",
  profit: "Impozitul pe profit se plătește din ce rămâne după cheltuielile firmei.",
  real: "Impozitul și contribuțiile se calculează din venituri minus cheltuielile firmei.",
  norm: "Impozitul se calculează dintr-o sumă fixă stabilită pe județ, indiferent cât încasezi sau cheltuiești.",
};

/** Modurile de impozitare posibile pentru fiecare formă de firmă. */
export function taxRegimesFor(legalForm: LegalForm): TaxRegime[] {
  return legalForm === "srl" ? ["micro", "profit"] : ["real", "norm"];
}

export function isOwnBusiness(config: Pick<OnboardingConfig, "workMode">) {
  return config.workMode === "own_business";
}

export function workModeLabel(config: Pick<OnboardingConfig, "workMode" | "legalForm">) {
  return config.workMode === "own_business"
    ? `Propriul ${config.legalForm ? legalFormLabels[config.legalForm] : "SRL/PFA"}`
    : "Angajat";
}

export const platformLabels: Record<PlatformChoice | PlatformKey, string> = {
  bolt: "Bolt",
  uber: "Uber",
  bolt_uber: "Bolt + Uber",
  glovo: "Glovo",
  wolt: "Wolt",
  bolt_food: "Bolt Food",
};

export const activityLabels: Record<Activity, string> = {
  ridesharing: "Ridesharing",
  delivery: "Delivery",
  both: "Ridesharing + Delivery",
};

export const vehicleTypeLabels: Record<VehicleType, string> = {
  car: "Mașină",
  moto: "Scuter / motocicletă",
  e_bike: "Bicicletă / trotinetă electrică",
  bicycle: "Bicicletă",
};

/** Numele scurt al vehiculului, pentru întrebări: „intervenții la mașină”. */
export const vehicleShortNames: Record<VehicleType, string> = {
  car: "mașină",
  moto: "scuter",
  e_bike: "bicicleta electrică",
  bicycle: "bicicletă",
};

/** Kilometrajul și alertele de revizie au sens doar la mașină și scuter. */
export function tracksOdometer(config: Pick<OnboardingConfig, "vehicleType">) {
  return config.vehicleType === "car" || config.vehicleType === "moto";
}

/** Bicicleta și trotineta electrică nu au combustibil de calculat. */
export function usesFuel(config: Pick<OnboardingConfig, "vehicleType">) {
  return config.vehicleType === "car" || config.vehicleType === "moto";
}

/** Numai delivery (fără ridesharing). */
export function isDelivery(config: Pick<OnboardingConfig, "activity">) {
  return config.activity === "delivery";
}

/** Are aplicații de livrări: delivery sau ambele. */
export function hasDelivery(config: Pick<OnboardingConfig, "activity">) {
  return config.activity !== "ridesharing";
}

/** Are ridesharing: ridesharing sau ambele. */
export function hasRidesharing(config: Pick<OnboardingConfig, "activity">) {
  return config.activity !== "delivery";
}

/** Numele aplicațiilor din configurație, ca text: „Glovo + Wolt”. */
export function configPlatformsLabel(config: Pick<OnboardingConfig, "activity" | "platform" | "deliveryPlatforms">) {
  const delivery = config.deliveryPlatforms.map((platform) => platformLabels[platform]).join(" + ");
  if (config.activity === "delivery") return delivery;
  if (config.activity === "both") return `${platformLabels[config.platform]} + ${delivery}`;
  return platformLabels[config.platform];
}

/** Cum se numește comisionul oprit din încasări, după situație. */
export function commissionLabel(config: Pick<OnboardingConfig, "workMode">) {
  return config.workMode === "own_business" ? "Comision afiliere" : "Comision flotă";
}

export function normalizeCityInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 80);
}

export function cityKey(value: string) {
  return normalizeCityInput(value).trim().toLowerCase();
}

export function formatCityName(value: string) {
  return cityKey(value)
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((part) =>
          part ? `${part[0].toUpperCase()}${part.slice(1)}` : "",
        )
        .join("-"),
    )
    .join(" ");
}

export function usesDirectPhevCosts(config: OnboardingConfig) {
  return config.hybridType === "phev";
}

export function energyUnit(config: OnboardingConfig) {
  return config.fuelType === "electric" ? "kWh" : "litru";
}
