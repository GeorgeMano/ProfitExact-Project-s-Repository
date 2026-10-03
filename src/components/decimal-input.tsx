"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * Un număr scris de un utilizator din România: „12,5”, „12.5”, „1.225,78”.
 *   - cu virgulă: virgula e separatorul zecimal, punctele sunt mii;
 *   - fără virgulă: un singur punct e zecimal, mai multe puncte sunt mii.
 * Text gol sau fără cifre → null.
 */
export function parseDecimal(text: string): number | null {
  const compact = text.replace(/\s/g, "");
  if (!/\d/.test(compact)) return null;
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".").replace(/,/g, "")
    : (compact.match(/\./g) ?? []).length > 1
      ? compact.replace(/\./g, "")
      : compact;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Afișarea unui număr, cu virgulă la zecimale, ca în aplicațiile românești. */
export function formatDecimal(value: number) {
  return String(value).replace(".", ",");
}

type DecimalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Zero se arată ca un câmp gol (cu placeholder), nu ca „0”. */
  emptyWhenZero?: boolean;
};

/**
 * Câmp numeric care acceptă virgula. Un `<input type="number">` o pierde în
 * multe browsere („123,45” devenea 12345), deci aici câmpul e text, cu
 * tastatura numerică pe telefon, iar valoarea se interpretează de mai sus.
 */
export function DecimalInput({ value, onChange, emptyWhenZero = true, ...rest }: DecimalInputProps) {
  const shown = (next: number | null) =>
    next === null || (emptyWhenZero && next === 0) ? "" : formatDecimal(next);
  const [text, setText] = useState(() => shown(value));
  const [synced, setSynced] = useState(value);

  // Valoarea s-a schimbat din afară (de exemplu din captură): textul o urmează,
  // dar nu peste ce scrie utilizatorul în acel moment („12,” rămâne „12,”).
  if (synced !== value) {
    setSynced(value);
    const typedSame = parseDecimal(text) === value || (text === "" && shown(value) === "");
    if (!typedSame) setText(shown(value));
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^\d.,\s]/g, "");
        setText(raw);
        onChange(parseDecimal(raw));
      }}
    />
  );
}
