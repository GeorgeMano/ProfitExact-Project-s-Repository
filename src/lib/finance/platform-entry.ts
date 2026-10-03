import {
  fleetCommissionBase,
  roundMoney,
  type FleetCommission,
} from "./daily-result";

/**
 * Defalcarea pe platformă.
 *
 * Regula stabilită: se separă numai ce se poate măsura direct pe fiecare
 * aplicație — încasările din ecranul ei, comisionul și kilometrii — plus
 * cele două costuri care decurg din ele: combustibilul (din kilometri) și
 * comisionul procentual al flotei (din încasări).
 *
 * Rămân COMUNE zilei, niciodată împărțite pe platformă: CIM-ul, chiria, RCA,
 * ITP, leasingul, telefonul, spălarea, parcarea, taxele de drum și service-ul.
 * Ele aparțin mașinii și zilei, nu aplicației. Un comision fix al flotei este
 * tot un cost comun, fiindcă este o sumă unică, nu un procent din încasări.
 *
 * Invariant important: profitul zilei este identic indiferent dacă rezultatul
 * este privit împreună sau separat. De aceea sumele derivate sunt repartizate
 * cu `distributeAmount`, care garantează că suma părților este exact totalul.
 */

/** Aplicațiile de livrări. Nu au comision de aplicație pentru curier. */
export type DeliveryPlatform = "glovo" | "wolt" | "bolt_food";
export type PlatformKey = "bolt" | "uber" | DeliveryPlatform;

export const deliveryPlatforms: DeliveryPlatform[] = ["glovo", "wolt", "bolt_food"];

export function isDeliveryPlatform(platform: PlatformKey): platform is DeliveryPlatform {
  return (deliveryPlatforms as PlatformKey[]).includes(platform);
}

/**
 * Ce introduce șoferul, rând cu rând, din ecranul „Defalcarea câștigurilor”
 * al aplicației (Bolt, Uber), plus bacșișul numerar primit în afara ei.
 *
 *   Venituri în aplicație = curse card + campanii + taxe de anulare + bacșiș
 *   Venituri în numerar   = curse cash + credite și promoții pentru utilizatori
 *   Câștigurile tale      = aplicație + numerar − costuri și taxe − comision
 *   Numerar în mână       = curse cash
 *
 * Creditele și promoțiile apar la numerar, dar le plătește aplicația: ajung la
 * flotă, nu în buzunarul șoferului. De aceea banii prin flotă sunt
 * câștigurile tale − numerarul în mână.
 */
export interface PlatformEntryInput {
  platform: PlatformKey;
  /** Venituri în aplicație → Plăți pentru curse. */
  appRidePayments: number;
  /** Venituri în aplicație → Campanii. */
  campaigns: number;
  /** Venituri în aplicație → Taxe de anulare. */
  cancellationFees: number;
  /** Venituri în aplicație → Bacșiș. */
  appTips: number;
  /** Venituri în numerar → Plăți pentru curse. */
  cashRidePayments: number;
  /** Venituri în numerar → Credite și promoții pentru utilizatori. */
  userCredits: number;
  /** „Costuri și taxe”. */
  platformCosts: number;
  /** „Comision Bolt/Uber”, exact din aplicație. `null` = încă necompletat. */
  applicationCommission: number | null;
  /** Bacșiș numerar primit în afara aplicației. Rămâne integral la șofer. */
  cashTips: number;
  kilometers: number;
  /** Livrări finalizate (delivery). Informativ: nu intră în calculul banilor. */
  deliveries?: number;
  /** Livrări anulate (Glovo). Informativ. */
  cancelledDeliveries?: number;
  /** Ore online în aplicație (Glovo), în ore cu zecimale. Informativ. */
  hoursOnline?: number;
}

/** Totalurile afișate de aplicație, calculate din rândurile introduse. */
export function platformEntryTotals(entry: PlatformEntryInput) {
  const appRevenue = roundMoney(
    nonNegative(entry.appRidePayments) +
      nonNegative(entry.campaigns) +
      nonNegative(entry.cancellationFees) +
      nonNegative(entry.appTips),
  );
  const cashRevenue = roundMoney(
    nonNegative(entry.cashRidePayments) + nonNegative(entry.userCredits),
  );
  const platformCosts = roundMoney(nonNegative(entry.platformCosts));
  const applicationCommission = roundMoney(
    nonNegative(entry.applicationCommission ?? 0),
  );

  return {
    appRevenue,
    cashRevenue,
    platformCosts,
    applicationCommission,
    netEarnings: roundMoney(
      Math.max(0, appRevenue + cashRevenue - platformCosts - applicationCommission),
    ),
    cashInHand: roundMoney(nonNegative(entry.cashRidePayments)),
  };
}

export type PlatformEnergyBasis =
  | { type: "calculated"; consumptionPer100Km: number; unitPrice: number }
  | { type: "phev"; gasolineCost: number; electricCost: number };

export interface PlatformEntryResult {
  platform: PlatformKey;
  appRevenue: number;
  cashRevenue: number;
  grossEarnings: number;
  applicationCommission: number;
  platformCosts: number;
  netEarnings: number;
  cashInHand: number;
  totalEarnings: number;
  kilometers: number;
  energyCost: number;
  fleetCommission: number;
  amountManagedByFleet: number;
  /** Rezultatul platformei înainte de cheltuielile comune ale zilei. */
  resultBeforeCommonCosts: number;
  resultPerKm: number | null;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Împarte o sumă deja rotunjită după niște ponderi, astfel încât suma părților
 * să fie exact totalul. Diferența de rotunjire merge la ponderea cea mai mare,
 * ca să nu apară un ban în plus sau în minus între „împreună” și „separat”.
 *
 * Fără nicio pondere pozitivă (de exemplu zero kilometri pe ambele platforme),
 * suma se împarte în mod egal — altfel ar dispărea din total.
 */
export function distributeAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];

  const safeWeights = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const weightSum = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const shares =
    weightSum > 0
      ? safeWeights.map((weight) => weight / weightSum)
      : safeWeights.map(() => 1 / weights.length);

  const parts = shares.map((share) => roundMoney(total * share));
  const drift = roundMoney(total - parts.reduce((sum, part) => sum + part, 0));

  if (drift !== 0) {
    let largest = 0;
    for (let index = 1; index < parts.length; index += 1) {
      if (shares[index] > shares[largest]) largest = index;
    }
    parts[largest] = roundMoney(parts[largest] + drift);
  }

  return parts;
}

/**
 * Cum ajung kilometrii în calcul când se lucrează pe două platforme.
 *
 * `per_platform` — se introduc pe fiecare aplicație. Exacți pe platformă, dar
 * nu cuprind mersul în gol: drumul până la client, între curse și spre casă.
 *
 * `shared` — se introduce un singur total real al zilei, care include și mersul
 * în gol, deci combustibilul zilei este corect. Kilometrii fiecărei platforme
 * se deduc proporțional cu încasările, ceea ce este o aproximare asumată.
 */
export type KilometerEntryMode = "per_platform" | "shared";

export interface PlatformBreakdownInput {
  entries: PlatformEntryInput[];
  energy: PlatformEnergyBasis;
  fleetCommission: FleetCommission;
  /** Totalul introdus în modul `shared`. Ignorat în modul `per_platform`. */
  sharedKilometers?: number | null;
  /**
   * La „Ambele”: comisionul fiecărei aplicații (ridesharing și delivery pot
   * avea procente diferite). Lipsă = `fleetCommission` pentru toate.
   */
  commissionFor?: (platform: PlatformKey) => FleetCommission;
}

export function calculatePlatformBreakdown(
  input: PlatformBreakdownInput,
): PlatformEntryResult[] {
  const base = input.entries.map((entry) => {
    const totals = platformEntryTotals(entry);

    return {
      entry,
      ...totals,
      grossEarnings: roundMoney(totals.appRevenue + totals.cashRevenue),
      kilometers: nonNegative(entry.kilometers),
      totalEarnings: roundMoney(totals.netEarnings + nonNegative(entry.cashTips)),
    };
  });

  // În modul „kilometri în comun” se pornește de la totalul introdus, iar
  // kilometrii fiecărei platforme se deduc proporțional cu încasările ei.
  const sharedKilometers =
    input.sharedKilometers === null || input.sharedKilometers === undefined
      ? null
      : nonNegative(input.sharedKilometers);

  const kilometersByEntry =
    sharedKilometers === null
      ? base.map((item) => item.kilometers)
      : distributeAmount(
          roundMoney(sharedKilometers),
          base.map((item) => item.totalEarnings),
        );

  const totalKilometers = kilometersByEntry.reduce((sum, value) => sum + value, 0);

  // Combustibilul zilei se calculează o singură dată, pe totalul kilometrilor,
  // apoi se repartizează după kilometrii fiecărei platforme.
  const totalEnergyCost =
    input.energy.type === "phev"
      ? roundMoney(
          nonNegative(input.energy.gasolineCost) +
            nonNegative(input.energy.electricCost),
        )
      : roundMoney(
          (totalKilometers *
            nonNegative(input.energy.consumptionPer100Km) *
            nonNegative(input.energy.unitPrice)) /
            100,
        );

  const energyParts = distributeAmount(totalEnergyCost, kilometersByEntry);

  // Comisionul flotei: procentual se repartizează după baza fiecărei platforme,
  // fix rămâne cost comun al zilei, deci zero pe platformă.
  const commissionBases = base.map((item) =>
    fleetCommissionBase(
      input.fleetCommission,
      item.netEarnings,
      item.applicationCommission,
      item.platformCosts,
    ),
  );

  const totalCommissionBase = Math.max(
    0,
    commissionBases.reduce((sum, value) => sum + value, 0),
  );

  const totalFleetCommission =
    input.fleetCommission.type === "fixed"
      ? 0
      : roundMoney(
          totalCommissionBase * (nonNegative(input.fleetCommission.value) / 100),
        );

  const fleetParts = input.commissionFor
    ? base.map((item) => {
        // Fiecare aplicație cu procentul ei; comisionul fix rămâne cost comun.
        const commission = input.commissionFor!(item.entry.platform);
        if (commission.type === "fixed") return 0;
        const itemBase = fleetCommissionBase(commission, item.netEarnings, item.applicationCommission, item.platformCosts);
        return roundMoney(Math.max(0, itemBase) * (nonNegative(commission.value) / 100));
      })
    : distributeAmount(
        totalFleetCommission,
        commissionBases.map((value) => Math.max(0, value)),
      );

  return base.map((item, index) => {
    const kilometers = kilometersByEntry[index] ?? 0;
    const energyCost = energyParts[index] ?? 0;
    const fleetCommission = fleetParts[index] ?? 0;
    const resultBeforeCommonCosts = roundMoney(
      item.totalEarnings - energyCost - fleetCommission,
    );

    return {
      platform: item.entry.platform,
      appRevenue: item.appRevenue,
      cashRevenue: item.cashRevenue,
      grossEarnings: item.grossEarnings,
      applicationCommission: item.applicationCommission,
      platformCosts: item.platformCosts,
      netEarnings: item.netEarnings,
      cashInHand: item.cashInHand,
      totalEarnings: item.totalEarnings,
      kilometers,
      energyCost,
      fleetCommission,
      amountManagedByFleet: roundMoney(item.netEarnings - item.cashInHand),
      resultBeforeCommonCosts,
      resultPerKm:
        kilometers > 0 && resultBeforeCommonCosts !== 0
          ? resultBeforeCommonCosts / kilometers
          : null,
    };
  });
}

/**
 * Totalurile zilei, obținute din intrările pe platformă.
 * În modul „kilometri în comun”, totalul introdus înlocuiește suma lor.
 */
export function combinePlatformEntries(
  entries: PlatformEntryInput[],
  sharedKilometers?: number | null,
) {
  const totals = entries.map(platformEntryTotals);
  const sum = (values: number[]) =>
    roundMoney(values.reduce((total, value) => total + value, 0));
  const hasCommission = entries.some(
    (entry) => entry.applicationCommission !== null,
  );

  return {
    appRevenue: sum(totals.map((item) => item.appRevenue)),
    cashRevenue: sum(totals.map((item) => item.cashRevenue)),
    netEarnings: sum(totals.map((item) => item.netEarnings)),
    cashInHand: sum(totals.map((item) => item.cashInHand)),
    // `null` înseamnă că nicio platformă nu are comisionul completat.
    applicationCommission: hasCommission
      ? sum(totals.map((item) => item.applicationCommission))
      : null,
    platformCosts: sum(totals.map((item) => item.platformCosts)),
    cashTips: sum(entries.map((entry) => nonNegative(entry.cashTips))),
    kilometers:
      sharedKilometers === null || sharedKilometers === undefined
        ? sum(entries.map((entry) => nonNegative(entry.kilometers)))
        : roundMoney(nonNegative(sharedKilometers)),
  };
}

function isEntered(value: number | null) {
  return value !== null && Number.isFinite(value);
}

/**
 * Ziua se poate calcula când fiecare platformă are comisionul completat exact
 * cum apare în aplicație (0 e o valoare validă). ProfitExact nu îl estimează.
 */
export function hasRequiredEarnings(entries: PlatformEntryInput[]) {
  return (
    entries.length > 0 &&
    entries.every((entry) => isEntered(entry.applicationCommission))
  );
}

/** Mesajul afișat când ziua sau perioada nu se poate calcula încă. */
export function missingEarningsMessage() {
  return "Introdu comisionul exact cum apare în aplicație.";
}

export function platformsFor(choice: "bolt" | "uber" | "bolt_uber"): PlatformKey[] {
  return choice === "bolt_uber" ? ["bolt", "uber"] : [choice];
}

/** Aplicațiile din configurație: Bolt/Uber la ridesharing, cele alese la delivery. */
export function platformsForConfig(config: {
  activity: "ridesharing" | "delivery" | "both";
  platform: "bolt" | "uber" | "bolt_uber";
  deliveryPlatforms: DeliveryPlatform[];
}): PlatformKey[] {
  const delivery = deliveryPlatforms.filter((platform) => config.deliveryPlatforms.includes(platform));
  if (config.activity === "delivery") return delivery;
  if (config.activity === "both") return [...platformsFor(config.platform), ...delivery];
  return platformsFor(config.platform);
}

export function emptyPlatformEntry(platform: PlatformKey): PlatformEntryInput {
  return {
    platform,
    appRidePayments: 0,
    campaigns: 0,
    cancellationFees: 0,
    appTips: 0,
    cashRidePayments: 0,
    userCredits: 0,
    platformCosts: 0,
    // Aplicațiile de livrări nu iau comision de la curier.
    applicationCommission: isDeliveryPlatform(platform) ? 0 : null,
    cashTips: 0,
    kilometers: 0,
  };
}
