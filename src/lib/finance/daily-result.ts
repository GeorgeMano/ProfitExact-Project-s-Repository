export type FleetCommission =
  | {
      type: "percentage";
      value: number;
      base: "gross" | "net";
    }
  | {
      type: "fixed";
      value: number;
    };

export type DailyEnergyCost =
  | {
      type: "calculated";
      consumptionPer100Km: number;
      unitPrice: number;
    }
  | {
      type: "phev";
      gasolineCost: number;
      electricCost: number;
    };

export interface DailyResultInput {
  cardEarnings: number;
  cashEarnings: number;
  compensations: number;
  appTips: number;
  cashTips: number;
  privateEarnings: number;
  kilometers: number;
  energy: DailyEnergyCost;
  fleetCommission: FleetCommission;
  weeklyCimCost: number;
  recurringDailyCosts: number;
  recurringFleetCosts: number;
  oneOffDailyCosts: number;
}

export interface DailyResult {
  grossPlatformEarnings: number;
  applicationCommission: number;
  platformNetEarnings: number;
  totalEarnings: number;
  energyCost: number;
  fleetCommission: number;
  dailyCimCost: number;
  recurringDailyCosts: number;
  oneOffDailyCosts: number;
  totalExpenses: number;
  result: number;
  resultPerKm: number | null;
  amountManagedByFleet: number;
  fleetBalance: number;
}

const APPLICATION_COMMISSION_RATE = 0.25;

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function calculateDailyResult(input: DailyResultInput): DailyResult {
  const cardEarnings = nonNegative(input.cardEarnings);
  const cashEarnings = nonNegative(input.cashEarnings);
  const compensations = nonNegative(input.compensations);
  const appTips = nonNegative(input.appTips);
  const cashTips = nonNegative(input.cashTips);
  const privateEarnings = nonNegative(input.privateEarnings);
  const kilometers = nonNegative(input.kilometers);

  const grossPlatformEarnings = cardEarnings + cashEarnings;
  const applicationCommission =
    grossPlatformEarnings * APPLICATION_COMMISSION_RATE;
  const platformNetEarnings =
    grossPlatformEarnings - applicationCommission;

  const commissionBase =
    input.fleetCommission.type === "percentage" &&
    input.fleetCommission.base === "gross"
      ? grossPlatformEarnings
      : platformNetEarnings;

  const fleetCommission =
    input.fleetCommission.type === "fixed"
      ? nonNegative(input.fleetCommission.value)
      : commissionBase *
        (nonNegative(input.fleetCommission.value) / 100);

  const energyCost =
    input.energy.type === "phev"
      ? nonNegative(input.energy.gasolineCost) +
        nonNegative(input.energy.electricCost)
      : (kilometers *
          nonNegative(input.energy.consumptionPer100Km) *
          nonNegative(input.energy.unitPrice)) /
        100;

  const dailyCimCost = nonNegative(input.weeklyCimCost) / 7;
  const recurringDailyCosts = nonNegative(input.recurringDailyCosts);
  const recurringFleetCosts = nonNegative(input.recurringFleetCosts);
  const oneOffDailyCosts = nonNegative(input.oneOffDailyCosts);

  const totalEarnings =
    platformNetEarnings +
    compensations +
    appTips +
    cashTips +
    privateEarnings;

  const totalExpenses =
    energyCost +
    fleetCommission +
    dailyCimCost +
    recurringDailyCosts +
    oneOffDailyCosts;

  const result = totalEarnings - totalExpenses;
  const amountManagedByFleet =
    cardEarnings + compensations + appTips - applicationCommission;
  const fleetBalance =
    fleetCommission + dailyCimCost + recurringFleetCosts - amountManagedByFleet;

  return {
    grossPlatformEarnings,
    applicationCommission,
    platformNetEarnings,
    totalEarnings,
    energyCost,
    fleetCommission,
    dailyCimCost,
    recurringDailyCosts,
    oneOffDailyCosts,
    totalExpenses,
    result,
    resultPerKm: kilometers > 0 && result !== 0 ? result / kilometers : null,
    amountManagedByFleet,
    fleetBalance,
  };
}

export function formatResultAlert(result: DailyResult) {
  if (result.result === 0) {
    return "Ai câștigat 0 RON.";
  }

  if (result.resultPerKm === null) {
    return result.result > 0
      ? "Ai încheiat ziua pe plus."
      : "Ai încheiat ziua pe minus.";
  }

  const amount = Math.abs(result.resultPerKm).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return result.result > 0
    ? `Ai câștigat ${amount} RON/km azi.`
    : `Ai pierdut ${amount} RON/km azi.`;
}

export function formatFleetAlert(fleetBalance: number) {
  const amount = Math.abs(fleetBalance).toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return fleetBalance > 0
    ? `Datorezi flotei ${amount} RON.`
    : `Flota îți datorează ${amount} RON.`;
}
