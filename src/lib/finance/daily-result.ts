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
  /** Suma exactă oprită de aplicație, introdusă din screenshot sau manual. */
  applicationCommission: number | null;
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

export interface FinancialResultInput {
  cardEarnings: number;
  cashEarnings: number;
  applicationCommission: number | null;
  compensations: number;
  appTips: number;
  cashTips: number;
  privateEarnings: number;
  kilometers: number;
  energyCost: number;
  fleetCommission: FleetCommission;
  cimCost: number;
  recurringCosts: number;
  recurringFleetCosts: number;
  oneOffCosts: number;
}

export interface FinancialResult {
  grossPlatformEarnings: number;
  applicationCommission: number;
  platformNetEarnings: number;
  totalEarnings: number;
  energyCost: number;
  fleetCommission: number;
  cimCost: number;
  recurringCosts: number;
  oneOffCosts: number;
  totalExpenses: number;
  result: number;
  resultPerKm: number | null;
  amountManagedByFleet: number;
  fleetBalance: number;
}

export interface DailyResult extends FinancialResult {
  dailyCimCost: number;
  recurringDailyCosts: number;
  oneOffDailyCosts: number;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateConsumptionCost(
  kilometers: number,
  consumptionPer100Km: number,
  unitPrice: number,
) {
  return roundMoney(
    (nonNegative(kilometers) *
      nonNegative(consumptionPer100Km) *
      nonNegative(unitPrice)) /
      100,
  );
}

export function calculateFinancialResult(
  input: FinancialResultInput,
): FinancialResult {
  const cardEarnings = nonNegative(input.cardEarnings);
  const cashEarnings = nonNegative(input.cashEarnings);
  const compensations = nonNegative(input.compensations);
  const appTips = nonNegative(input.appTips);
  const cashTips = nonNegative(input.cashTips);
  const privateEarnings = nonNegative(input.privateEarnings);
  const kilometers = nonNegative(input.kilometers);

  const grossPlatformEarnings = roundMoney(cardEarnings + cashEarnings);
  const applicationCommission = roundMoney(
    nonNegative(input.applicationCommission ?? 0),
  );
  const platformNetEarnings = roundMoney(
    grossPlatformEarnings - applicationCommission,
  );

  const commissionBase = nonNegative(
    input.fleetCommission.type === "percentage" &&
    input.fleetCommission.base === "gross"
      ? grossPlatformEarnings
      : platformNetEarnings,
  );

  const fleetCommission =
    input.fleetCommission.type === "fixed"
      ? roundMoney(nonNegative(input.fleetCommission.value))
      : roundMoney(
          commissionBase *
            (nonNegative(input.fleetCommission.value) / 100),
        );

  const energyCost = roundMoney(nonNegative(input.energyCost));
  const cimCost = roundMoney(nonNegative(input.cimCost));
  const recurringCosts = roundMoney(nonNegative(input.recurringCosts));
  const recurringFleetCosts = nonNegative(input.recurringFleetCosts);
  const oneOffCosts = roundMoney(nonNegative(input.oneOffCosts));

  const totalEarnings = roundMoney(
    platformNetEarnings +
      compensations +
      appTips +
      cashTips +
      privateEarnings,
  );

  const totalExpenses = roundMoney(
    energyCost +
      fleetCommission +
      cimCost +
      recurringCosts +
      oneOffCosts,
  );

  const result = roundMoney(totalEarnings - totalExpenses);
  const amountManagedByFleet = roundMoney(
    cardEarnings + compensations + appTips - applicationCommission,
  );
  const fleetBalance = roundMoney(
    fleetCommission + cimCost + recurringFleetCosts - amountManagedByFleet,
  );

  return {
    grossPlatformEarnings,
    applicationCommission,
    platformNetEarnings,
    totalEarnings,
    energyCost,
    fleetCommission,
    cimCost,
    recurringCosts,
    oneOffCosts,
    totalExpenses,
    result,
    resultPerKm: kilometers > 0 && result !== 0 ? result / kilometers : null,
    amountManagedByFleet,
    fleetBalance,
  };
}

export function calculateDailyResult(input: DailyResultInput): DailyResult {
  const kilometers = nonNegative(input.kilometers);
  const energyCost =
    input.energy.type === "phev"
      ? nonNegative(input.energy.gasolineCost) +
        nonNegative(input.energy.electricCost)
      : calculateConsumptionCost(
          kilometers,
          input.energy.consumptionPer100Km,
          input.energy.unitPrice,
        );

  const result = calculateFinancialResult({
    cardEarnings: input.cardEarnings,
    cashEarnings: input.cashEarnings,
    applicationCommission: input.applicationCommission,
    compensations: input.compensations,
    appTips: input.appTips,
    cashTips: input.cashTips,
    privateEarnings: input.privateEarnings,
    kilometers,
    energyCost,
    fleetCommission: input.fleetCommission,
    cimCost: nonNegative(input.weeklyCimCost) / 7,
    recurringCosts: input.recurringDailyCosts,
    recurringFleetCosts: input.recurringFleetCosts,
    oneOffCosts: input.oneOffDailyCosts,
  });

  return {
    ...result,
    dailyCimCost: result.cimCost,
    recurringDailyCosts: result.recurringCosts,
    oneOffDailyCosts: result.oneOffCosts,
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
