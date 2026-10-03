"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import "./mobile-menu.css";

export interface MobileMenuItem {
  label: string;
  /** Text mic sub etichetă, de exemplu situația curentă. */
  detail?: string;
  onSelect: () => void;
  /** Elementul ales acum (de exemplu „Zilnic”). */
  current?: boolean;
  tone?: "default" | "primary" | "quiet";
}

/**
 * Meniul de pe telefon: un buton „hamburger” care deschide o listă peste
 * pagină. Se închide la alegere, la apăsarea în afara lui sau cu Escape.
 * Pe ecrane mari butonul nu apare (vezi mobile-menu.css).
 */
export function MobileMenu({
  items,
  heading,
  label = "Meniu",
}: {
  items: (MobileMenuItem | "separator")[];
  heading?: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    // Pagina din spate nu se derulează cât meniul e deschis.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className={`mobile-menu-toggle ${open ? "open" : ""}`}
        aria-label={open ? "Închide meniul" : label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      {open ? (
        <>
          <div className="mobile-menu-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
          <nav className="mobile-menu-panel" id={panelId} aria-label={label}>
            {heading ? <div className="mobile-menu-heading">{heading}</div> : null}
            <ul>
              {items.map((item, index) =>
                item === "separator" ? (
                  <li key={`separator-${index}`} className="mobile-menu-separator" aria-hidden="true" />
                ) : (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={`mobile-menu-item ${item.tone ?? "default"} ${item.current ? "current" : ""}`}
                      aria-current={item.current ? "page" : undefined}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.detail ? <small>{item.detail}</small> : null}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  );
}
