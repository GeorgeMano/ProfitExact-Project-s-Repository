import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnboardingConfig, PlatformChoice } from "@/domain/onboarding";
import type { SavedManualPeriod } from "@/lib/finance/manual-period";
import { platformsFor } from "@/lib/finance/platform-entry";
import type { SavedWorkDay } from "@/lib/finance/weekly-summary";
import {
  createEmptyWorkspace,
  parseOnboardingConfig,
  type WorkspaceSnapshot,
} from "./workspace";
import type {
  WorkspaceLoadResult,
  WorkspaceRepository,
  WorkspaceSaveResult,
} from "./workspace-repository";

/**
 * Salvarea în contul real, prin Supabase.
 *
 * Aceleași date ca în modul demo, dar desfăcute în tabelele normalizate. Nimic
 * din acest fișier nu rulează în modul de depanare cu codurile 123456: fără o
 * sesiune autentificată, politicile RLS ar respinge oricum scrierea.
 *
 * Ce este acoperit:
 *   - configurația de onboarding, complet (context, platforme, vehicul,
 *     comision flotă, costuri recurente);
 *   - perioadele de lucru în `work_entries`, cu instantaneul de calcul;
 *   - încasările pe platformă în `platform_earnings`, rând cu rând ca în
 *     ecranul aplicației, plus câștigul net și numerarul în mână calculate.
 *
 *   - combustibilul în `energy_entries` și cheltuielile punctuale în `expenses`,
 *     pentru zile și pentru perioadele introduse manual.
 *
 * Zilele salvate înainte de extinderea instantaneului nu au `inputs`, deci
 * pentru ele nu se scrie combustibil și nici cheltuieli: valorile nu există,
 * iar inventarea lor ar strica auditul.
 */

const AUTOMATIC_ENTRY_SOURCE = "manual";

interface ContextRow {
  id: string;
}

interface EntryRow {
  id: string;
  period_type: string;
  period_start: string;
}

function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}

/** Rândul din `work_entries` pentru o zi salvată. */
function dayEntryRow(
  day: SavedWorkDay,
  config: OnboardingConfig,
  userId: string,
  contextId: string,
) {
  return {
    user_id: userId,
    context_id: contextId,
    city_name: config.cityName,
    city_key: config.cityKey,
    period_type: "day" as const,
    period_start: day.date,
    period_end: day.date,
    source_type: AUTOMATIC_ENTRY_SOURCE,
    confirmation_status: "confirmed" as const,
    worked_days: 1,
    worked_hours: Math.max(0, day.hoursWorked),
    total_kilometers: Math.max(0, day.kilometers),
    private_earnings: Math.max(0, day.privateEarnings),
    private_kilometers: 0,
    reported_net_earnings: Math.max(0, day.netEarnings),
    cash_in_hand: Math.max(0, day.cashInHand),
    platform_costs: Math.max(0, day.platformCosts),
    computed_total_earnings: day.totalEarnings >= 0 ? day.totalEarnings : null,
    computed_total_expenses: Math.max(0, day.totalEarnings - day.result),
    computed_result: day.result,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/** Rândul din `work_entries` pentru o săptămână sau lună introdusă manual. */
function manualEntryRow(
  entry: SavedManualPeriod,
  config: OnboardingConfig,
  userId: string,
  contextId: string,
) {
  const maxWorkedDays = entry.periodType === "week" ? 7 : 31;

  return {
    user_id: userId,
    context_id: contextId,
    city_name: config.cityName,
    city_key: config.cityKey,
    period_type: entry.periodType,
    period_start:
      entry.periodType === "month" ? monthStart(entry.startDate) : entry.startDate,
    period_end: entry.endDate,
    source_type: AUTOMATIC_ENTRY_SOURCE,
    confirmation_status: "confirmed" as const,
    worked_days: Math.min(
      maxWorkedDays,
      Math.max(0, Math.round(entry.values.workedDays)),
    ),
    worked_hours: Math.max(0, entry.values.hoursWorked),
    total_kilometers: Math.max(0, entry.contribution.kilometers),
    private_earnings: Math.max(0, entry.values.privateEarnings),
    private_kilometers: 0,
    reported_net_earnings: Math.max(0, entry.contribution.netEarnings),
    cash_in_hand: Math.max(0, entry.contribution.cashInHand),
    platform_costs: Math.max(0, entry.contribution.platformCosts),
    computed_total_earnings:
      entry.result.totalEarnings >= 0 ? entry.result.totalEarnings : null,
    computed_total_expenses: Math.max(0, entry.result.totalExpenses),
    computed_result: entry.result.result,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function createSupabaseWorkspaceRepository(
  client: SupabaseClient,
  userId: string,
): WorkspaceRepository {
  /** Găsește contextul de lucru al utilizatorului, fără să îl creeze. */
  async function findContext(): Promise<ContextRow | null> {
    const { data } = await client
      .from("work_contexts")
      .select("id")
      .eq("user_id", userId)
      .eq("activity", "ridesharing")
      .maybeSingle();
    return (data as ContextRow | null) ?? null;
  }

  async function upsertContext(config: OnboardingConfig) {
    const { data, error } = await client
      .from("work_contexts")
      .upsert(
        {
          user_id: userId,
          activity: "ridesharing",
          work_mode: "employee",
          legal_form: null,
          city_name: config.cityName,
          city_key: config.cityKey,
          profit_view: config.profitView,
          kilometer_entry: config.kilometerEntry,
          onboarding_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,activity" },
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Contextul de lucru nu a putut fi salvat.");
    }

    return (data as ContextRow).id;
  }

  async function saveConfig(config: OnboardingConfig, contextId: string) {
    // Platformele alese: se rescriu integral, ca să dispară cele deselectate.
    await client.from("context_platforms").delete().eq("context_id", contextId);
    await client.from("context_platforms").insert(
      platformsFor(config.platform).map((platform) => ({
        context_id: contextId,
        user_id: userId,
        platform,
      })),
    );

    // Vehiculul curent: există un index unic pe un singur vehicul activ per
    // context, deci actualizăm rândul existent în loc să inserăm unul nou.
    const vehiclePayload = {
      user_id: userId,
      context_id: contextId,
      ownership_type: config.vehicleOwnership,
      fuel_type: config.fuelType,
      hybrid_type: config.hybridType,
      primary_fuel: config.primaryFuel,
      consumption_per_100: Math.max(0, config.consumptionPer100Km),
      effective_from: config.effectiveFrom,
      effective_to: null,
      updated_at: new Date().toISOString(),
    };

    const { data: currentVehicle } = await client
      .from("vehicles")
      .select("id")
      .eq("context_id", contextId)
      .is("effective_to", null)
      .maybeSingle();

    if (currentVehicle) {
      await client
        .from("vehicles")
        .update(vehiclePayload)
        .eq("id", (currentVehicle as ContextRow).id);
    } else {
      await client.from("vehicles").insert(vehiclePayload);
    }

    // Comisionul flotei și CIM-ul: versionate pe data de intrare în vigoare.
    await client.from("fleet_config_versions").upsert(
      {
        user_id: userId,
        context_id: contextId,
        commission_type: config.fleetCommission.type,
        commission_value: Math.max(0, config.fleetCommission.value),
        commission_base:
          config.fleetCommission.type === "percentage"
            ? config.fleetCommission.base
            : null,
        weekly_cim_cost: Math.max(0, config.weeklyCimCost),
        effective_from: config.effectiveFrom,
        effective_to: null,
      },
      { onConflict: "context_id,effective_from" },
    );

    // Costurile recurente: rescrise integral, ca lista din onboarding să fie
    // exact lista din bază. Identificatorii sunt generați de Postgres.
    await client
      .from("recurring_costs")
      .delete()
      .eq("context_id", contextId)
      .is("effective_to", null);

    if (config.recurringCosts.length > 0) {
      await client.from("recurring_costs").insert(
        config.recurringCosts.map((cost) => ({
          user_id: userId,
          context_id: contextId,
          vehicle_id: null,
          category: cost.category,
          label: cost.label,
          amount: Math.max(0, cost.amount),
          period: cost.period,
          validity_days: cost.period === "validity" ? (cost.validityDays ?? null) : null,
          paid_to_fleet: cost.paidToFleet,
          effective_from: cost.effectiveFrom,
          effective_to: null,
        })),
      );
    }
  }

  async function saveEntries(snapshot: WorkspaceSnapshot, contextId: string) {
    const config = snapshot.config;
    if (!config) return [] as string[];

    const warnings: string[] = [];
    const rows = [
      ...snapshot.savedDays.map((day) =>
        dayEntryRow(day, config, userId, contextId),
      ),
      ...snapshot.manualPeriods.map((entry) =>
        manualEntryRow(entry, config, userId, contextId),
      ),
    ];

    if (rows.length === 0) return warnings;

    const { data, error } = await client
      .from("work_entries")
      .upsert(rows, { onConflict: "context_id,period_type,period_start" })
      .select("id, period_type, period_start");

    if (error) {
      warnings.push(`Perioadele nu au putut fi salvate în cont: ${error.message}`);
      return warnings;
    }

    const entryRows = (data as EntryRow[] | null) ?? [];
    await savePlatformEarnings(snapshot, entryRows, warnings);
    await saveEnergyAndExpenses(snapshot, entryRows, contextId, warnings);
    return warnings;
  }

  /**
   * Combustibilul și cheltuielile punctuale, acum că instantaneul păstrează
   * prețul unitar și defalcarea, nu doar totalurile.
   */
  async function saveEnergyAndExpenses(
    snapshot: WorkspaceSnapshot,
    entryRows: EntryRow[],
    contextId: string,
    warnings: string[],
  ) {
    const config = snapshot.config;
    if (!config) return;

    const byPeriod = new Map(
      entryRows.map((row) => [`${row.period_type}:${row.period_start}`, row.id]),
    );
    const isPhev = config.hybridType === "phev";

    const sources = [
      ...snapshot.savedDays
        .filter((day) => day.inputs)
        .map((day) => ({
          key: `day:${day.date}`,
          date: day.date,
          periodType: "day" as const,
          inputs: day.inputs!,
        })),
      ...snapshot.manualPeriods.map((period) => ({
        key: `${period.periodType}:${
          period.periodType === "month"
            ? monthStart(period.startDate)
            : period.startDate
        }`,
        date:
          period.periodType === "month"
            ? monthStart(period.startDate)
            : period.startDate,
        periodType: period.periodType,
        inputs: {
          unitPrice: period.values.unitPrice,
          gasolineCost: period.values.gasolineCost,
          electricCost: period.values.electricCost,
          washingCost: period.values.washingCost,
          parkingCost: period.values.parkingCost,
          roadTollCost: period.values.roadTollCost,
          serviceCost: period.values.serviceCost,
          otherCost: period.values.otherCost,
        },
      })),
    ].flatMap((source) => {
      const workEntryId = byPeriod.get(source.key);
      return workEntryId ? [{ ...source, workEntryId }] : [];
    });

    if (sources.length === 0) return;

    const energyRows = sources.map((source) => ({
      user_id: userId,
      work_entry_id: source.workEntryId,
      calculation_type: isPhev ? "phev_direct" : "calculated",
      consumption_per_100: isPhev ? null : Math.max(0, config.consumptionPer100Km),
      unit_price: isPhev ? null : Math.max(0, source.inputs.unitPrice),
      gasoline_cost: isPhev ? Math.max(0, source.inputs.gasolineCost) : 0,
      electric_cost: isPhev ? Math.max(0, source.inputs.electricCost) : 0,
      updated_at: new Date().toISOString(),
    }));

    const { error: energyError } = await client
      .from("energy_entries")
      .upsert(energyRows, { onConflict: "work_entry_id" });

    if (energyError) {
      warnings.push(
        `Datele de combustibil nu au putut fi salvate: ${energyError.message}`,
      );
    }

    // Cheltuielile punctuale se rescriu integral: o categorie ștearsă trebuie
    // să dispară din bază, nu să rămână cu valoarea veche.
    const categories = [
      ["washing", "washingCost"],
      ["parking", "parkingCost"],
      ["road_toll", "roadTollCost"],
      ["service", "serviceCost"],
      ["other", "otherCost"],
    ] as const;

    const expenseRows = sources.flatMap((source) =>
      categories
        .map(([category, field]) => ({
          user_id: userId,
          context_id: contextId,
          work_entry_id: source.workEntryId,
          vehicle_id: null,
          category,
          expense_date: source.date,
          period_type: source.periodType,
          amount: Math.max(0, source.inputs[field]),
        }))
        .filter((row) => row.amount > 0),
    );

    await client
      .from("expenses")
      .delete()
      .in(
        "work_entry_id",
        sources.map((source) => source.workEntryId),
      );

    if (expenseRows.length === 0) return;

    const { error: expenseError } = await client.from("expenses").insert(expenseRows);

    if (expenseError) {
      warnings.push(
        `Cheltuielile punctuale nu au putut fi salvate: ${expenseError.message}`,
      );
    }
  }

  /**
   * Încasările pe platformă. Există numai pentru zilele salvate după
   * introducerea defalcării; zilele mai vechi nu au ce scrie aici.
   */
  async function savePlatformEarnings(
    snapshot: WorkspaceSnapshot,
    entryRows: EntryRow[],
    warnings: string[],
  ) {
    const byPeriod = new Map(
      entryRows.map((row) => [`${row.period_type}:${row.period_start}`, row.id]),
    );

    const payload = [
      ...snapshot.savedDays.flatMap((day) =>
        (day.platforms ?? []).map((entry) => ({ key: `day:${day.date}`, entry })),
      ),
      ...snapshot.manualPeriods.flatMap((period) =>
        (period.contribution.platforms ?? []).map((entry) => ({
          key: `${period.periodType}:${
            period.periodType === "month"
              ? monthStart(period.startDate)
              : period.startDate
          }`,
          entry,
        })),
      ),
    ];

    const rows = payload
      .map(({ key, entry }) => {
        const workEntryId = byPeriod.get(key);
        if (!workEntryId) return null;

        return {
          user_id: userId,
          work_entry_id: workEntryId,
          platform: entry.platform,
          // Rândurile din ecranul aplicației, plus totalurile calculate din ele
          // (migrările 202609140001 și 202610020001).
          card_earnings: Math.max(0, entry.appRidePayments),
          campaigns: Math.max(0, entry.campaigns),
          cancellation_fees: Math.max(0, entry.cancellationFees),
          app_tips: Math.max(0, entry.appTips),
          cash_earnings: Math.max(0, entry.cashRidePayments),
          user_credits: Math.max(0, entry.userCredits),
          compensations: 0,
          platform_costs: Math.max(0, entry.platformCosts),
          application_commission: Math.max(0, entry.applicationCommission),
          reported_net_earnings: Math.max(0, entry.netEarnings),
          cash_in_hand: Math.max(0, entry.cashInHand),
          cash_tips: Math.max(0, entry.cashTips),
          kilometers: Math.max(0, entry.kilometers),
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) return;

    const { error } = await client
      .from("platform_earnings")
      .upsert(rows, { onConflict: "work_entry_id,platform" });

    if (error) {
      warnings.push(
        `Încasările pe platformă nu au putut fi salvate: ${error.message}`,
      );
    }
  }

  return {
    mode: "account",

    async load(): Promise<WorkspaceLoadResult> {
      const snapshot = createEmptyWorkspace();
      const warnings: string[] = [];

      const context = await findContext();
      if (!context) return { snapshot, warnings };

      const [platforms, vehicle, fleet, recurring] = await Promise.all([
        client.from("context_platforms").select("platform").eq("context_id", context.id),
        client
          .from("vehicles")
          .select(
            "ownership_type, fuel_type, hybrid_type, primary_fuel, consumption_per_100, effective_from",
          )
          .eq("context_id", context.id)
          .is("effective_to", null)
          .maybeSingle(),
        client
          .from("fleet_config_versions")
          .select("commission_type, commission_value, commission_base, weekly_cim_cost, effective_from")
          .eq("context_id", context.id)
          .order("effective_from", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("recurring_costs")
          .select("id, category, label, amount, period, validity_days, paid_to_fleet, effective_from")
          .eq("context_id", context.id)
          .is("effective_to", null),
      ]);

      const { data: contextRow } = await client
        .from("work_contexts")
        .select("city_name, city_key, profit_view, kilometer_entry")
        .eq("id", context.id)
        .maybeSingle();

      const vehicleRow = vehicle.data as Record<string, unknown> | null;
      const fleetRow = fleet.data as Record<string, unknown> | null;
      const contextData = contextRow as Record<string, unknown> | null;

      if (!vehicleRow || !fleetRow || !contextData) {
        warnings.push("Configurația din cont este incompletă și nu a putut fi încărcată.");
        return { snapshot, warnings };
      }

      const chosen = ((platforms.data as { platform: string }[] | null) ?? []).map(
        (row) => row.platform,
      );
      const platform: PlatformChoice =
        chosen.includes("bolt") && chosen.includes("uber")
          ? "bolt_uber"
          : chosen.includes("uber")
            ? "uber"
            : "bolt";

      snapshot.config = parseOnboardingConfig({
        activity: "ridesharing",
        workMode: "employee",
        platform,
        cityName: contextData.city_name,
        cityKey: contextData.city_key,
        profitView: contextData.profit_view,
        kilometerEntry: contextData.kilometer_entry,
        vehicleOwnership: vehicleRow.ownership_type,
        fuelType: vehicleRow.fuel_type,
        hybridType: vehicleRow.hybrid_type,
        primaryFuel: vehicleRow.primary_fuel,
        consumptionPer100Km: Number(vehicleRow.consumption_per_100),
        fleetCommission:
          fleetRow.commission_type === "percentage"
            ? {
                type: "percentage",
                value: Number(fleetRow.commission_value),
                base: fleetRow.commission_base,
              }
            : { type: "fixed", value: Number(fleetRow.commission_value) },
        weeklyCimCost: Number(fleetRow.weekly_cim_cost),
        effectiveFrom: vehicleRow.effective_from,
        recurringCosts: ((recurring.data as Record<string, unknown>[] | null) ?? []).map(
          (cost) => ({
            id: String(cost.id),
            category: cost.category,
            label: cost.label,
            amount: Number(cost.amount),
            period: cost.period,
            validityDays: cost.validity_days ?? undefined,
            effectiveFrom: cost.effective_from,
            paidToFleet: cost.paid_to_fleet === true,
          }),
        ),
      });

      if (!snapshot.config) {
        warnings.push("Configurația din cont nu a trecut validarea și a fost ignorată.");
      }

      // Istoricul detaliat al perioadelor se reconstruiește după decizia despre
      // defalcarea pe platformă; până atunci se încarcă numai configurația.
      return { snapshot, warnings };
    },

    async save(snapshot: WorkspaceSnapshot): Promise<WorkspaceSaveResult> {
      if (!snapshot.config) {
        // Fără onboarding nu există context, deci nu există unde ancora datele.
        return { warnings: [] };
      }

      try {
        const contextId = await upsertContext(snapshot.config);
        await saveConfig(snapshot.config, contextId);
        const warnings = await saveEntries(snapshot, contextId);
        return { warnings };
      } catch (error) {
        return {
          warnings: [
            `Salvarea în cont nu a reușit: ${
              error instanceof Error ? error.message : "eroare necunoscută"
            }`,
          ],
        };
      }
    },

    async clear() {
      const context = await findContext();
      if (!context) return;
      await client.from("work_entries").delete().eq("context_id", context.id);
    },
  };
}
