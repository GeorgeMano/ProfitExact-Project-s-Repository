import { formatFleetAlert } from "@/lib/finance/daily-result";

function money(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Regularizarea cu flota, pas cu pas.
 *
 * Flota primește banii care nu au rămas la șofer (câștig net − numerar în
 * mână), își oprește comisionul, CIM-ul și costurile plătite ei, iar restul îl
 * datorează șoferului. Dacă rezultatul iese pe minus, șoferul datorează flotei.
 */
export function FleetSettlement({
  title,
  balance,
  amountManagedByFleet,
  fleetCommission,
  cimCost,
  cimLabel,
  otherFleetCosts,
  note,
}: {
  title: string;
  /** Pozitiv: șoferul datorează flotei. Negativ: flota datorează șoferului. */
  balance: number;
  amountManagedByFleet: number;
  fleetCommission: number;
  cimCost: number;
  cimLabel: string;
  otherFleetCosts: number;
  note?: string;
}) {
  const owes = balance > 0;

  return (
    <section className={`fleet-card ${owes ? "owes" : "receives"}`}>
      <p className="eyebrow">{title}</p>
      <h2>{formatFleetAlert(balance)}</h2>
      <dl className="breakdown-list" aria-label="Calculul regularizării cu flota">
        <div>
          <dt>Bani pe card, ajunși la flotă</dt>
          <dd>{money(amountManagedByFleet)} RON</dd>
        </div>
        <div>
          <dt>Comision flotă</dt>
          <dd>− {money(fleetCommission)} RON</dd>
        </div>
        <div>
          <dt>{cimLabel}</dt>
          <dd>− {money(cimCost)} RON</dd>
        </div>
        {otherFleetCosts > 0 ? (
          <div>
            <dt>Alte costuri reținute de flotă</dt>
            <dd>− {money(otherFleetCosts)} RON</dd>
          </div>
        ) : null}
        <div className="total-row">
          <dt>{owes ? "Datorezi flotei" : "Flota îți datorează"}</dt>
          <dd>{money(Math.abs(balance))} RON</dd>
        </div>
      </dl>
      {note ? <p>{note}</p> : null}
    </section>
  );
}
