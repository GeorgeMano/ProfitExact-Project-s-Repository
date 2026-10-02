import { usesDirectPhevCosts, type OnboardingConfig } from "@/domain/onboarding";
import {
  calculateConsumptionCost,
  calculateDailyResult,
  calculateFinancialResult,
  roundMoney,
} from "./daily-result";
import {
  manualPeriodId,
  type ManualPeriodValues,
  type SavedManualPeriod,
} from "./manual-period";
import {
  calculatePlatformBreakdown,
  combinePlatformEntries,
  hasRequiredEarnings,
  type PlatformEnergyBasis,
  type PlatformEntryInput,
} from "./platform-entry";
import {
  allocateRecurringCosts,
  allocateRecurringCostsForRange,
  inclusiveDays,
} from "./recurring-cost";
import {
  toSavedPlatformEntry,
  type PeriodCalendarCosts,
  type SavedWorkDay,
  type SavedWorkDayInputs,
  type SummaryPeriod,
} from "./weekly-summary";

/**
 * Calculul unei zile și al unei perioade introduse manual, într-un singur loc.
 *
 * Îl folosesc atât formularele, cât și încărcarea din cont: o zi citită din
 * baza de date este recalculată exact ca atunci când a fost introdusă, din
 * aceleași valori, în loc să depindă de rezultate salvate separat.
 */

export interface WorkDayInput {
  date: string;
  platforms: PlatformEntryInput[];
  privateEarnings: number;
  hoursWorked: number;
  inputs: SavedWorkDayInputs;
}

function oneOffTotal(inputs: Omit<SavedWorkDayInputs, "sharedKilometers">) {
  return (
    Math.max(0, inputs.washingCost) +
    Math.max(0, inputs.parkingCost) +
    Math.max(0, inputs.roadTollCost) +
    Math.max(0, inputs.serviceCost) +
    Math.max(0, inputs.otherCost)
  );
}

function energyBasisFor(
  config: OnboardingConfig,
  values: { unitPrice: number; gasolineCost: number; electricCost: number },
): PlatformEnergyBasis {
  return usesDirectPhevCosts(config)
    ? { type: "phev", gasolineCost: values.gasolineCost, electricCost: values.electricCost }
    : {
        type: "calculated",
        consumptionPer100Km: config.consumptionPer100Km,
        unitPrice: values.unitPrice,
      };
}

/** Kilometrii în comun au sens numai când se lucrează pe două platforme. */
export function sharedKilometersFor(
  config: OnboardingConfig,
  platforms: PlatformEntryInput[],
  sharedKilometers: number,
) {
  return config.kilometerEntry === "shared" && platforms.length > 1
    ? sharedKilometers
    : null;
}

export function calculateWorkDay(config: OnboardingConfig, input: WorkDayInput) {
  const recurringCosts = allocateRecurringCosts(config.recurringCosts, input.date);
  const recurringDailyTotal = recurringCosts.reduce((sum, cost) => sum + cost.dailyAmount, 0);
  const recurringFleetTotal = recurringCosts
    .filter((cost) => cost.paidToFleet)
    .reduce((sum, cost) => sum + cost.dailyAmount, 0);
  const sharedKilometers = sharedKilometersFor(
    config,
    input.platforms,
    input.inputs.sharedKilometers,
  );
  const combined = combinePlatformEntries(input.platforms, sharedKilometers);
  const energyBasis = energyBasisFor(config, input.inputs);

  const result = calculateDailyResult({
    ...combined,
    privateEarnings: input.privateEarnings,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    weeklyCimCost: config.weeklyCimCost,
    recurringDailyCosts: recurringDailyTotal,
    recurringFleetCosts: recurringFleetTotal,
    oneOffDailyCosts: oneOffTotal(input.inputs),
  });

  const breakdown = calculatePlatformBreakdown({
    entries: input.platforms,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    sharedKilometers,
  });

  return {
    recurringCosts,
    recurringFleetTotal,
    sharedKilometers,
    combined,
    energyBasis,
    result,
    breakdown,
    canCalculate: hasRequiredEarnings(input.platforms),
  };
}

/** Ziua gata de salvat, sau `null` cât timp lipsește comisionul exact. */
export function buildSavedWorkDay(
  config: OnboardingConfig,
  input: WorkDayInput,
): SavedWorkDay | null {
  const day = calculateWorkDay(config, input);
  if (!day.canCalculate) return null;
  const { combined, result, breakdown } = day;

  return {
    date: input.date,
    // `breakdown` păstrează ordinea din `platforms`, deci indexul leagă
    // valorile introduse de cele calculate.
    platforms: breakdown.map((item, index) =>
      toSavedPlatformEntry(input.platforms[index], item),
    ),
    // Tot ce a fost introdus, ca ziua să poată fi reconstituită și corectată.
    inputs: { ...input.inputs },
    appRevenue: combined.appRevenue,
    cashRevenue: combined.cashRevenue,
    netEarnings: result.platformNetEarnings,
    cashInHand: result.cashInHand,
    applicationCommission: result.applicationCommission,
    platformCosts: result.platformCosts,
    cashTips: combined.cashTips,
    privateEarnings: input.privateEarnings,
    amountManagedByFleet: result.amountManagedByFleet,
    result: result.result,
    resultBeforeCalendarCosts: roundMoney(
      result.result + result.cimCost + result.recurringCosts,
    ),
    fleetBalance: result.fleetBalance,
    fleetBalanceBeforeCalendarCosts: roundMoney(
      result.fleetBalance - result.cimCost - day.recurringFleetTotal,
    ),
    totalEarnings: result.totalEarnings,
    energyCost: result.energyCost,
    fleetCommission: result.fleetCommission,
    oneOffCosts: result.oneOffCosts,
    hoursWorked: input.hoursWorked,
    kilometers: combined.kilometers,
  };
}

/** CIM-ul și costurile recurente repartizate pe fiecare zi a perioadei. */
export function calendarCostsForRange(
  config: OnboardingConfig,
  startDate: string,
  endDate: string,
): PeriodCalendarCosts {
  const recurring = allocateRecurringCostsForRange(config.recurringCosts, startDate, endDate);

  return {
    cimCost: roundMoney((config.weeklyCimCost / 7) * inclusiveDays(startDate, endDate)),
    recurringCosts: roundMoney(recurring.reduce((sum, cost) => sum + cost.periodAmount, 0)),
    recurringFleetCosts: roundMoney(
      recurring
        .filter((cost) => cost.paidToFleet)
        .reduce((sum, cost) => sum + cost.periodAmount, 0),
    ),
  };
}

export function calculateManualPeriod(
  config: OnboardingConfig,
  values: ManualPeriodValues,
  calendarCosts: PeriodCalendarCosts,
) {
  const sharedKilometers = sharedKilometersFor(
    config,
    values.platforms,
    values.sharedKilometers,
  );
  const combined = combinePlatformEntries(values.platforms, sharedKilometers);
  const energyCost = usesDirectPhevCosts(config)
    ? Math.max(0, values.gasolineCost) + Math.max(0, values.electricCost)
    : calculateConsumptionCost(
        combined.kilometers,
        config.consumptionPer100Km,
        values.unitPrice,
      );
  const energyBasis = energyBasisFor(config, values);
  const breakdown = calculatePlatformBreakdown({
    entries: values.platforms,
    energy: energyBasis,
    fleetCommission: config.fleetCommission,
    sharedKilometers,
  });
  const canCalculate = hasRequiredEarnings(values.platforms);
  const result = canCalculate
    ? calculateFinancialResult({
        ...combined,
        privateEarnings: values.privateEarnings,
        energyCost,
        fleetCommission: config.fleetCommission,
        cimCost: calendarCosts.cimCost,
        recurringCosts: calendarCosts.recurringCosts,
        recurringFleetCosts: calendarCosts.recurringFleetCosts,
        oneOffCosts: oneOffTotal(values),
      })
    : null;

  return { sharedKilometers, combined, energyCost, breakdown, canCalculate, result };
}

/** Perioada gata de salvat, sau `null` cât timp lipsește comisionul exact. */
export function buildManualPeriod(
  config: OnboardingConfig,
  periodType: SummaryPeriod,
  startDate: string,
  endDate: string,
  values: ManualPeriodValues,
  calendarCosts: PeriodCalendarCosts = calendarCostsForRange(config, startDate, endDate),
): SavedManualPeriod | null {
  const { combined, breakdown, result } = calculateManualPeriod(config, values, calendarCosts);
  if (!result) return null;

  return {
    id: manualPeriodId(periodType, startDate, endDate),
    periodType,
    startDate,
    endDate,
    values,
    result,
    contribution: {
      startDate,
      endDate,
      platforms: breakdown.map((item, index) =>
        toSavedPlatformEntry(values.platforms[index], item),
      ),
      appRevenue: combined.appRevenue,
      cashRevenue: combined.cashRevenue,
      netEarnings: result.platformNetEarnings,
      cashInHand: result.cashInHand,
      applicationCommission: result.applicationCommission,
      platformCosts: result.platformCosts,
      cashTips: combined.cashTips,
      privateEarnings: values.privateEarnings,
      amountManagedByFleet: result.amountManagedByFleet,
      totalEarnings: result.totalEarnings,
      energyCost: result.energyCost,
      fleetCommission: result.fleetCommission,
      oneOffCosts: result.oneOffCosts,
      resultBeforeCalendarCosts: roundMoney(
        result.result + result.cimCost + result.recurringCosts,
      ),
      fleetBalanceBeforeCalendarCosts: roundMoney(
        result.fleetBalance - result.cimCost - calendarCosts.recurringFleetCosts,
      ),
      hoursWorked: values.hoursWorked,
      kilometers: combined.kilometers,
    },
  };
}
