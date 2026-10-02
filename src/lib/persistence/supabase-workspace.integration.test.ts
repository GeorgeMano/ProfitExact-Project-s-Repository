import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { OnboardingConfig } from "@/domain/onboarding";
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import type { SavedWorkDay } from "@/lib/finance/weekly-summary";
import { createSupabaseWorkspaceRepository } from "./supabase-workspace";
import { createEmptyWorkspace } from "./workspace";
import type { WorkspaceRepository } from "./workspace-repository";

/**
 * Verificare împotriva bazei online reale.
 *
 * Sare automat dacă variabilele de mediu lipsesc, deci `npm test` rămâne
 * complet local și nu atinge Supabase. Ca să o rulezi:
 *
 *   1. creează un utilizator de test cu emailul deja confirmat
 *      (altfel trigger-ul `auth_user_create_verified_profile` nu creează
 *      profilul, iar politicile RLS resping orice scriere):
 *
 *      insert into auth.users (
 *        instance_id, id, aud, role, email, encrypted_password,
 *        email_confirmed_at,
 *        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
 *      ) values (
 *        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
 *        'authenticated', 'authenticated', 'test@profitexact.test',
 *        crypt('ParolaDeTest2026!', gen_salt('bf')),
 *        now(),
 *        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
 *        now(), now()
 *      );
 *      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
 *      select gen_random_uuid(), id, jsonb_build_object('sub', id::text, 'email', email),
 *             'email', id::text, now(), now(), now()
 *      from auth.users where email = 'test@profitexact.test';
 *
 *   2. rulează:
 *
 *      PROFITEXACT_TEST_EMAIL=test@profitexact.test \
 *      PROFITEXACT_TEST_PASSWORD='ParolaDeTest2026!' \
 *      npm test
 *
 *   3. la final, șterge utilizatorul: restul rândurilor dispar în cascadă.
 *
 *      delete from auth.users where email = 'test@profitexact.test';
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const email = process.env.PROFITEXACT_TEST_EMAIL?.trim();
const password = process.env.PROFITEXACT_TEST_PASSWORD;

const enabled = Boolean(url && key && email && password);

const config: OnboardingConfig = {
  activity: "ridesharing",
  workMode: "employee",
  platform: "bolt",
  cityName: "Pitesti",
  cityKey: "pitesti",
  profitView: "together",
  kilometerEntry: "per_platform",
  vehicleOwnership: "rented",
  fuelType: "gasoline_lpg",
  hybridType: null,
  primaryFuel: "lpg",
  consumptionPer100Km: 8.5,
  fleetCommission: { type: "percentage", value: 10, base: "gross" },
  weeklyCimCost: 900,
  effectiveFrom: "2026-09-01",
  recurringCosts: [
    {
      id: "local-1",
      category: "vehicle_rent",
      label: "Chirie mașină",
      amount: 700,
      period: "weekly",
      effectiveFrom: "2026-09-01",
      paidToFleet: true,
    },
    {
      id: "local-2",
      category: "itp",
      label: "ITP",
      amount: 180,
      period: "validity",
      validityDays: 180,
      effectiveFrom: "2026-09-01",
      paidToFleet: false,
    },
  ],
};

const day: SavedWorkDay = {
  date: "2026-09-02",
  appRevenue: 545.0,
  cashRevenue: 400,
  netEarnings: 745,
  cashInHand: 400,
  applicationCommission: 200,
  platformCosts: 0,
  cashTips: 15,
  privateEarnings: 0,
  amountManagedByFleet: 345,
  result: 431.27,
  resultBeforeCalendarCosts: 700,
  fleetBalance: -120,
  fleetBalanceBeforeCalendarCosts: -300,
  totalEarnings: 760,
  energyCost: 110.16,
  fleetCommission: 90,
  oneOffCosts: 20,
  hoursWorked: 8,
  kilometers: 180,
};

function manualPeriod(
  periodType: "week" | "month",
  startDate: string,
  endDate: string,
): SavedManualPeriod {
  return {
    id: `${periodType}:${startDate}:${endDate}`,
    periodType,
    startDate,
    endDate,
    values: {
      platforms: [
        {
          platform: "bolt" as const,
          appRidePayments: 803.9,
          campaigns: 9,
          cancellationFees: 24,
          appTips: 20,
          cashRidePayments: 566.3,
          userCredits: 198.3,
          platformCosts: 0,
          applicationCommission: 395.72,
          cashTips: 0,
          kilometers: 500,
        },
      ],
      sharedKilometers: 0,
      privateEarnings: 0,
      workedDays: periodType === "week" ? 4 : 22,
      hoursWorked: 25,
      unitPrice: 9.78,
      gasolineCost: 0,
      electricCost: 0,
      washingCost: 40,
      parkingCost: 0,
      roadTollCost: 0,
      serviceCost: 0,
      otherCost: 0,
    },
    result: {
      grossPlatformEarnings: 1621.5,
      applicationCommission: 395.72,
      platformCosts: 0,
      platformNetEarnings: 1225.78,
      cashInHand: 566.3,
      totalEarnings: 1225.78,
      energyCost: 415.65,
      fleetCommission: 137.02,
      cimCost: 900,
      recurringCosts: 700,
      recurringFleetCosts: 0,
      oneOffCosts: 40,
      totalExpenses: 2192.67,
      result: -966.89,
      resultPerKm: -1.93,
      amountManagedByFleet: 659.48,
      fleetBalance: 1077.54,
    },
    contribution: {
      startDate,
      endDate,
      appRevenue: 1055.2,
      cashRevenue: 566.3,
      netEarnings: 1225.78,
      cashInHand: 566.3,
      applicationCommission: 395.72,
      platformCosts: 0,
      cashTips: 0,
      privateEarnings: 0,
      amountManagedByFleet: 659.48,
      totalEarnings: 1225.78,
      energyCost: 415.65,
      fleetCommission: 137.02,
      oneOffCosts: 40,
      resultBeforeCalendarCosts: 633.11,
      fleetBalanceBeforeCalendarCosts: -522.46,
      hoursWorked: 25,
      kilometers: 500,
    },
  };
}

function fullSnapshot() {
  return {
    ...createEmptyWorkspace(),
    config,
    savedDays: [day],
    manualPeriods: [
      manualPeriod("week", "2026-10-12", "2026-10-18"),
      manualPeriod("month", "2026-10-01", "2026-10-31"),
    ],
  };
}

describe.skipIf(!enabled)("scrierea în contul Supabase real", () => {
  let repository: WorkspaceRepository;
  let userId: string;

  beforeAll(async () => {
    const client = createClient(url!, key!);
    const { data, error } = await client.auth.signInWithPassword({
      email: email!,
      password: password!,
    });

    if (error || !data.user) {
      throw new Error(`Autentificarea utilizatorului de test a eșuat: ${error?.message}`);
    }

    userId = data.user.id;
    repository = createSupabaseWorkspaceRepository(client, userId);
  }, 30000);

  it("salvează configurația și toate cele trei tipuri de perioadă", async () => {
    const { warnings } = await repository.save(fullSnapshot());
    expect(warnings).toEqual([]);
  }, 30000);

  it("citește înapoi aceeași configurație", async () => {
    const { snapshot, warnings } = await repository.load();

    expect(warnings).toEqual([]);
    expect(snapshot.config?.cityKey).toBe("pitesti");
    expect(snapshot.config?.platform).toBe("bolt");
    expect(snapshot.config?.fuelType).toBe("gasoline_lpg");
    expect(snapshot.config?.primaryFuel).toBe("lpg");
    expect(snapshot.config?.consumptionPer100Km).toBe(8.5);
    expect(snapshot.config?.weeklyCimCost).toBe(900);
    expect(snapshot.config?.fleetCommission).toEqual({
      type: "percentage",
      value: 10,
      base: "gross",
    });
    expect(snapshot.config?.recurringCosts).toHaveLength(2);
    expect(
      snapshot.config?.recurringCosts.find((cost) => cost.category === "itp")
        ?.validityDays,
    ).toBe(180);
  }, 30000);

  it("citește înapoi zilele și perioadele, recalculate identic", async () => {
    const { snapshot } = await repository.load();

    expect(snapshot.savedDays.map((saved) => saved.date)).toEqual([day.date]);
    expect(snapshot.manualPeriods.map((period) => period.id).sort()).toEqual(
      fullSnapshot().manualPeriods.map((period) => period.id).sort(),
    );
    const week = snapshot.manualPeriods.find((period) => period.periodType === "week");
    expect(week?.contribution.netEarnings).toBe(1225.78);
    expect(week?.contribution.amountManagedByFleet).toBe(659.48);
  }, 30000);

  it("nu dublează nimic la a doua salvare a acelorași date", async () => {
    // Cheia unică (context_id, period_type, period_start) transformă a doua
    // salvare într-o actualizare. Fără ea s-ar aduna rânduri la fiecare salvare.
    await repository.save(fullSnapshot());

    const client = createClient(url!, key!);
    await client.auth.signInWithPassword({ email: email!, password: password! });

    const counts = await Promise.all(
      ["work_entries", "recurring_costs", "context_platforms", "vehicles"].map(
        async (table) => {
          const { count } = await client
            .from(table)
            .select("*", { count: "exact", head: true });
          return [table, count] as const;
        },
      ),
    );

    expect(Object.fromEntries(counts)).toEqual({
      work_entries: 3,
      recurring_costs: 2,
      context_platforms: 1,
      vehicles: 1,
    });
  }, 30000);
});
