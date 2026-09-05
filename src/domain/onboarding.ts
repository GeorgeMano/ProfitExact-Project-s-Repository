import type { FleetCommission } from "@/lib/finance/daily-result";

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
    | "phone_internet";
  label: string;
  amount: number;
  period: CostPeriod;
  validityDays?: number;
  effectiveFrom: string;
  paidToFleet: boolean;
}

export interface OnboardingConfig {
  activity: "ridesharing";
  workMode: "employee";
  platform: PlatformChoice;
  cityName: string;
  cityKey: string;
  profitView: ProfitView;
  vehicleOwnership: VehicleOwnership;
  fuelType: FuelType;
  hybridType: HybridType;
  primaryFuel: "gasoline" | "lpg" | null;
  consumptionPer100Km: number;
  fleetCommission: FleetCommission;
  weeklyCimCost: number;
  effectiveFrom: string;
  recurringCosts: RecurringCostConfig[];
}

export const fuelLabels: Record<FuelType, string> = {
  gasoline: "Benzină",
  diesel: "Motorină",
  electric: "Electric",
  gasoline_lpg: "Benzină + GPL",
  hybrid_gasoline: "Hibrid pe benzină",
  hybrid_diesel: "Hibrid diesel",
};

export const platformLabels: Record<PlatformChoice, string> = {
  bolt: "Bolt",
  uber: "Uber",
  bolt_uber: "Bolt + Uber",
};

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
