"use client";

import {
  platformEntryTotals,
  type PlatformEntryInput,
} from "@/lib/finance/platform-entry";

/**
 * Încasările unei platforme, așezate exact ca ecranul „Defalcarea
 * câștigurilor” din aplicația șoferului: aceleași grupe, aceleași rânduri,
 * aceleași totaluri. Șoferul copiază rând cu rând, iar totalurile, câștigul
 * net și numerarul în mână se calculează singure, ca să le poată compara cu
 * ce vede în aplicație.
 */

type Update = <Key extends keyof PlatformEntryInput>(
  key: Key,
  value: PlatformEntryInput[Key],
) => void;

function money(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function AmountRow({
  label,
  note,
  ariaLabel,
  value,
  onChange,
  sign = "+",
  suffix = "RON",
  required = false,
  emphasis = false,
}: {
  label: string;
  /** Precizare scurtă sub etichetă, de exemplu unde ajung banii. */
  note?: string;
  ariaLabel: string;
  value: number | null;
  onChange: (value: number | null) => void;
  sign?: "+" | "−" | "";
  suffix?: string;
  required?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={`earnings-row ${emphasis ? "emphasis" : ""}`}>
      <span className="earnings-label">
        {label}
        {note ? <small className="earnings-note">{note}</small> : null}
      </span>
      <span className="earnings-leader" aria-hidden="true" />
      <span className={`earnings-input ${required && value === null ? "missing" : ""}`}>
        {sign ? <em aria-hidden="true">{sign}</em> : null}
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          aria-label={ariaLabel}
          required={required}
          placeholder={required ? "din aplicație" : "0,00"}
          value={value === null || (!required && value === 0) ? "" : value}
          onChange={(event) =>
            onChange(event.target.value === "" ? null : Number(event.target.value))
          }
        />
        <small>{suffix}</small>
      </span>
    </div>
  );
}

function GroupHead({ title, total }: { title: string; total?: number }) {
  return (
    <div className="earnings-head">
      <span>{title}</span>
      {total !== undefined ? <strong>+{money(total)} RON</strong> : null}
    </div>
  );
}

export function PlatformEarningsFields({
  entry,
  platformLabel,
  showKilometers,
  onChange,
}: {
  entry: PlatformEntryInput;
  platformLabel: string;
  showKilometers: boolean;
  onChange: Update;
}) {
  const totals = platformEntryTotals(entry);
  // Ce nu a rămas fizic la șofer ajunge la flotă: câștigurile − numerarul.
  const cardMoney = Math.round((totals.netEarnings - totals.cashInHand) * 100) / 100;
  const amount = (key: keyof PlatformEntryInput) => (value: number | null) =>
    onChange(key, (value ?? 0) as never);

  return (
    <div className="earnings-sheet">
      <section className="earnings-group" aria-label="Venituri în aplicație">
        <GroupHead title="Venituri în aplicație" total={totals.appRevenue} />
        <div className="earnings-rows">
          <AmountRow label="Plăți pentru curse" ariaLabel="Plăți pentru curse în aplicație" value={entry.appRidePayments} onChange={amount("appRidePayments")} />
          <AmountRow label="Campanii" ariaLabel="Campanii" value={entry.campaigns} onChange={amount("campaigns")} />
          <AmountRow label="Taxe de anulare" ariaLabel="Taxe de anulare" value={entry.cancellationFees} onChange={amount("cancellationFees")} />
          <AmountRow label="Bacșiș" ariaLabel="Bacșiș în aplicație" value={entry.appTips} onChange={amount("appTips")} />
        </div>
      </section>

      <section className="earnings-group" aria-label="Venituri în numerar">
        <GroupHead title="Venituri în numerar" total={totals.cashRevenue} />
        <div className="earnings-rows">
          <AmountRow label="Plăți pentru curse" note="Cash primit în mașină de la clienți" ariaLabel="Plăți pentru curse în numerar" value={entry.cashRidePayments} onChange={amount("cashRidePayments")} />
          <AmountRow label="Credite și promoții pentru utilizatori" note="Nu sunt bani în mână: se socotesc la card și ajung la flotă" ariaLabel="Credite și promoții pentru utilizatori" value={entry.userCredits} onChange={amount("userCredits")} />
        </div>
      </section>

      <div className="earnings-group earnings-flat">
        <AmountRow emphasis label="Costuri și taxe" ariaLabel="Costuri și taxe" sign="−" value={entry.platformCosts} onChange={amount("platformCosts")} />
        <AmountRow emphasis required label={`Comision ${platformLabel}`} ariaLabel={`Comision ${platformLabel}`} sign="−" value={entry.applicationCommission} onChange={(value) => onChange("applicationCommission", value)} />
      </div>

      <div className="earnings-total">
        <span>Câștigurile tale</span>
        <strong>{money(totals.netEarnings)} RON</strong>
      </div>
      <div className="earnings-split">
        <div className="earnings-cash-pill">
          <span>Numerar în mână<small>cash de la clienți</small></span>
          <strong>+{money(totals.cashInHand)} RON</strong>
        </div>
        <div className="earnings-cash-pill card">
          <span>Bani pe card, la flotă<small>inclusiv credite și promoții</small></span>
          <strong>+{money(cardMoney)} RON</strong>
        </div>
      </div>

      <section className="earnings-group earnings-outside" aria-label="În afara aplicației">
        <GroupHead title="În afara aplicației" />
        <div className="earnings-rows">
          <AmountRow label="Bacșiș numerar" ariaLabel="Bacșiș numerar" value={entry.cashTips} onChange={amount("cashTips")} />
        </div>
      </section>

      {showKilometers ? (
        <div className="earnings-group earnings-flat">
          <AmountRow emphasis sign="" suffix="km" label="Kilometri parcurși" ariaLabel="Kilometri parcurși" value={entry.kilometers} onChange={amount("kilometers")} />
        </div>
      ) : null}
    </div>
  );
}

/** Rubrica pentru banii care nu apar în nicio aplicație de ridesharing. */
export function OtherEarningsFields({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="earnings-sheet">
      <div className="earnings-group earnings-flat">
        <AmountRow
          emphasis
          label="Curse private / alte încasări"
          ariaLabel="Curse private / alte încasări"
          value={value}
          onChange={(next) => onChange(next ?? 0)}
        />
      </div>
    </div>
  );
}

/** Explicația scurtă afișată deasupra rândurilor fiecărei platforme. */
export function platformEarningsHelp(platformLabel: string, period: string) {
  return `Copiază rând cu rând din ${platformLabel} → Defalcarea câștigurilor, pentru ${period}. Totalurile se calculează singure, ca să le poți compara cu aplicația.`;
}
