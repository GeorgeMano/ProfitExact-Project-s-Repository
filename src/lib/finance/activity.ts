import type { Activity } from "@/domain/onboarding";
import type { SavedManualPeriod } from "./manual-period";
import { isDeliveryPlatform, type PlatformKey } from "./platform-entry";
import type { SavedWorkDay } from "./weekly-summary";

/**
 * Cărei activități îi aparține o zi sau un total salvat: după aplicațiile din
 * el (Bolt/Uber → ridesharing, Glovo/Wolt/Bolt Food → delivery). Datele
 * salvate înainte de defalcarea pe platformă sunt de ridesharing.
 *
 * Astfel, un cont care trece de la ridesharing la delivery (sau invers) nu
 * amestecă datele: fiecare activitate își vede doar zilele ei, iar celelalte
 * rămân salvate și revin dacă utilizatorul se întoarce.
 */
export function activityOfPlatforms(platforms: PlatformKey[] | undefined): "ridesharing" | "delivery" {
  return platforms?.some(isDeliveryPlatform) ? "delivery" : "ridesharing";
}

export function dayActivity(day: SavedWorkDay) {
  return activityOfPlatforms(day.platforms?.map((entry) => entry.platform));
}

export function periodActivity(period: SavedManualPeriod) {
  return activityOfPlatforms(period.values.platforms.map((entry) => entry.platform));
}

// La „Ambele” se văd toate datele: și cele de ridesharing, și cele de delivery.
export function daysOfActivity(days: SavedWorkDay[], activity: Activity) {
  return activity === "both" ? days : days.filter((day) => dayActivity(day) === activity);
}

export function periodsOfActivity(periods: SavedManualPeriod[], activity: Activity) {
  return activity === "both" ? periods : periods.filter((period) => periodActivity(period) === activity);
}

export interface ActivityShare {
  /** Ce rămâne din activitate după combustibil, comision și partea ei din costurile comune. */
  result: number;
  kilometers: number;
  /** Partea din costurile comune (0–1). */
  share: number;
}

/**
 * La „Ambele”, rezultatul pe activități: fiecare aplicație își aduce
 * rezultatul ei (încasări − combustibil − comision), iar costurile comune
 * (CIM, RCA, chirie, telefon, spălare, parcare…) se împart după kilometri,
 * cum a ales George. Fără kilometri, se împart după încasări.
 *
 * Alte încasări nu țin de nicio activitate și rămân separat, astfel încât
 * ridesharing + delivery + alte încasări = rezultatul total, exact.
 */
export function splitByActivity(
  items: { platform: PlatformKey; resultBeforeCommonCosts: number; kilometers: number; totalEarnings: number }[],
  totalResult: number,
  privateEarnings: number,
) {
  const round = (value: number) => Math.round(value * 100) / 100;
  const groups = (["ridesharing", "delivery"] as const).map((activity) => {
    const own = items.filter((item) => activityOfPlatforms([item.platform]) === activity);
    return {
      activity,
      before: own.reduce((sum, item) => sum + item.resultBeforeCommonCosts, 0),
      kilometers: round(own.reduce((sum, item) => sum + item.kilometers, 0)),
      earnings: own.reduce((sum, item) => sum + item.totalEarnings, 0),
    };
  });
  const commonCosts = round(groups.reduce((sum, group) => sum + group.before, 0) + privateEarnings - totalResult);
  const totalKilometers = groups.reduce((sum, group) => sum + group.kilometers, 0);
  const totalEarnings = groups.reduce((sum, group) => sum + group.earnings, 0);
  const basis: "kilometers" | "earnings" = totalKilometers > 0 ? "kilometers" : "earnings";
  const shareOf = (group: (typeof groups)[number]) =>
    basis === "kilometers"
      ? group.kilometers / totalKilometers
      : totalEarnings > 0 ? group.earnings / totalEarnings : 0.5;

  const [ride, delivery] = groups;
  const rideResult = round(ride.before - commonCosts * shareOf(ride));
  return {
    basis,
    commonCosts,
    ridesharing: { result: rideResult, kilometers: ride.kilometers, share: shareOf(ride) } satisfies ActivityShare,
    // Restul, ca suma să fie exact rezultatul total.
    delivery: { result: round(totalResult - privateEarnings - rideResult), kilometers: delivery.kilometers, share: shareOf(delivery) } satisfies ActivityShare,
  };
}
