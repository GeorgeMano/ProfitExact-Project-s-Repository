import { splitByActivity } from "@/lib/finance/activity";
import type { PlatformKey } from "@/lib/finance/platform-entry";

function money(value: number) {
  return value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

/**
 * La „Ambele”, în vederea separată: ce rămâne din ridesharing și din
 * delivery, cu costurile comune împărțite după kilometri.
 */
export function ActivitySplitCard({
  items,
  totalResult,
  privateEarnings,
  periodLabel,
}: {
  items: { platform: PlatformKey; resultBeforeCommonCosts: number; kilometers: number; totalEarnings: number }[];
  totalResult: number;
  privateEarnings: number;
  periodLabel: string;
}) {
  const split = splitByActivity(items, totalResult, privateEarnings);

  return (
    <section className="breakdown-card activity-split-card">
      <div className="card-heading"><div><p className="eyebrow">Pe activități</p><h2>Ridesharing și delivery</h2></div></div>
      <dl className="breakdown-list" aria-label="Rezultatul pe activități">
        <div><dt>Ridesharing · {split.ridesharing.kilometers.toLocaleString("ro-RO")} km</dt><dd>{money(split.ridesharing.result)} RON</dd></div>
        <div><dt>Delivery · {split.delivery.kilometers.toLocaleString("ro-RO")} km</dt><dd>{money(split.delivery.result)} RON</dd></div>
        {privateEarnings > 0 ? <div><dt>Alte încasări</dt><dd>{money(privateEarnings)} RON</dd></div> : null}
        <div className="total-row"><dt>Îți rămân {periodLabel}</dt><dd>{money(totalResult)} RON</dd></div>
      </dl>
      <p className="helper">
        Costurile comune ({money(split.commonCosts)} RON: CIM, RCA, chirie, telefon, spălare și celelalte) sunt împărțite{" "}
        {split.basis === "kilometers"
          ? `după kilometri: ${percent(split.ridesharing.share)} ridesharing, ${percent(split.delivery.share)} delivery.`
          : `după încasări, pentru că nu sunt kilometri: ${percent(split.ridesharing.share)} ridesharing, ${percent(split.delivery.share)} delivery.`}
      </p>
    </section>
  );
}
