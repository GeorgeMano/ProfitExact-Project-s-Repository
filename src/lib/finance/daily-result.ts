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

/**
 * Modelul de încasări, după actualizarea Bolt și Uber.
 *
 * Aplicațiile afișează acum direct câștigul NET al șoferului („Câștigurile
 * tale”), după comisionul și costurile oprite de platformă. Netul cuprinde deja
 * cursele cu cardul și cu numerar, bacșișul din aplicație, campaniile, taxele
 * de anulare și creditele sau promoțiile pentru utilizatori.
 *
 * Singurii bani rămași fizic la șofer sunt „Numerar în mână”. Creditele și
 * promoțiile apar în aplicație la secțiunea de numerar, dar sunt plătite de
 * platformă, deci ajung la flotă împreună cu banii de pe card. De aceea:
 *
 *   bani gestionați de flotă = câștig net − numerar în mână
 *
 * Comisionul aplicației și costurile platformei se păstrează doar pentru
 * transparență: sunt deja scăzute din net și nu se mai scad încă o dată.
 */
export interface EarningsInput {
  /** „Câștigurile tale” din aplicație, deja după comisionul platformei. */
  netEarnings: number;
  /** „Numerar în mână”: banii rămași fizic la șofer. */
  cashInHand: number;
  /** Informativ, deja inclus în net. `null` înseamnă necunoscut. */
  applicationCommission: number | null;
  /** „Costuri și taxe” afișate de platformă, informativ, deja incluse în net. */
  platformCosts: number;
  /** Bacșiș primit cash, în afara aplicației. Rămâne integral la șofer. */
  cashTips: number;
}

export interface DailyResultInput extends EarningsInput {
  privateEarnings: number;
  kilometers: number;
  energy: DailyEnergyCost;
  fleetCommission: FleetCommission;
  weeklyCimCost: number;
  recurringDailyCosts: number;
  recurringFleetCosts: number;
  oneOffDailyCosts: number;
}

export interface FinancialResultInput extends EarningsInput {
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
  /** Net + comision + costuri platformă; folosit numai pentru comisionul „din brut”. */
  grossPlatformEarnings: number;
  applicationCommission: number;
  platformCosts: number;
  platformNetEarnings: number;
  cashInHand: number;
  totalEarnings: number;
  energyCost: number;
  fleetCommission: number;
  cimCost: number;
  recurringCosts: number;
  /** Partea din costurile recurente reținută de flotă. */
  recurringFleetCosts: number;
  oneOffCosts: number;
  totalExpenses: number;
  result: number;
  resultPerKm: number | null;
  /** Banii care ajung la flotă: câștig net − numerar în mână. */
  amountManagedByFleet: number;
  /** Pozitiv: șoferul datorează flotei. Negativ: flota datorează șoferului. */
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

/** Baza comisionului flotei: netul din aplicație sau brutul reconstituit. */
export function fleetCommissionBase(
  fleetCommission: FleetCommission,
  netEarnings: number,
  applicationCommission: number | null,
  platformCosts: number,
) {
  return fleetCommission.type === "percentage" && fleetCommission.base === "gross"
    ? netEarnings + nonNegative(applicationCommission ?? 0) + nonNegative(platformCosts)
    : netEarnings;
}

export function calculateFinancialResult(
  input: FinancialResultInput,
): FinancialResult {
  const platformNetEarnings = roundMoney(nonNegative(input.netEarnings));
  const cashInHand = roundMoney(nonNegative(input.cashInHand));
  const applicationCommission = roundMoney(
    nonNegative(input.applicationCommission ?? 0),
  );
  const platformCosts = roundMoney(nonNegative(input.platformCosts));
  const cashTips = nonNegative(input.cashTips);
  const privateEarnings = nonNegative(input.privateEarnings);
  const kilometers = nonNegative(input.kilometers);

  const grossPlatformEarnings = roundMoney(
    platformNetEarnings + applicationCommission + platformCosts,
  );

  const commissionBase = nonNegative(
    fleetCommissionBase(
      input.fleetCommission,
      platformNetEarnings,
      applicationCommission,
      platformCosts,
    ),
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
  const recurringFleetCosts = roundMoney(nonNegative(input.recurringFleetCosts));
  const oneOffCosts = roundMoney(nonNegative(input.oneOffCosts));

  const totalEarnings = roundMoney(
    platformNetEarnings + cashTips + privateEarnings,
  );

  const totalExpenses = roundMoney(
    energyCost +
      fleetCommission +
      cimCost +
      recurringCosts +
      oneOffCosts,
  );

  const result = roundMoney(totalEarnings - totalExpenses);
  const amountManagedByFleet = roundMoney(platformNetEarnings - cashInHand);
  const fleetBalance = roundMoney(
    fleetCommission + cimCost + recurringFleetCosts - amountManagedByFleet,
  );

  return {
    grossPlatformEarnings,
    applicationCommission,
    platformCosts,
    platformNetEarnings,
    cashInHand,
    totalEarnings,
    energyCost,
    fleetCommission,
    cimCost,
    recurringCosts,
    recurringFleetCosts,
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
    netEarnings: input.netEarnings,
    cashInHand: input.cashInHand,
    applicationCommission: input.applicationCommission,
    platformCosts: input.platformCosts,
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

  if (roundMoney(fleetBalance) === 0) {
    return "Nu datorezi nimic flotei și nici flota ție.";
  }

  return fleetBalance > 0
    ? `Datorezi flotei ${amount} RON.`
    : `Flota îți datorează ${amount} RON.`;
}
