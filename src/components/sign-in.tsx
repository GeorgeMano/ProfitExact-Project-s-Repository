"use client";

import { useState, type FormEvent } from "react";
import {
  confirmPasswordReset,
  normalizeEmail,
  requestPasswordReset,
  signIn,
} from "@/lib/auth/session";
import { canUseSupabaseDemo, DEMO_VERIFICATION_CODE } from "@/lib/supabase/client";
import { AccountPromise } from "./account-creation";
import { BrandMark } from "./brand-mark";

type SignInPhase = "sign-in" | "reset-email" | "reset-code";

/**
 * Intrarea într-un cont existent și resetarea parolei.
 *
 * Parola nouă o alege numai utilizatorul, după un cod primit pe email.
 * Nimeni altcineva, nici proprietarul platformei, nu vede și nu setează
 * parola cuiva.
 */
export function SignIn({
  demoAccountEmail,
  onBack,
  onCreateAccount,
  onSignedIn,
}: {
  /** Contul de test salvat pe acest calculator, în modul de depanare local. */
  demoAccountEmail: string | null;
  onBack: () => void;
  onCreateAccount: () => void;
  onSignedIn: () => Promise<void> | void;
}) {
  const [phase, setPhase] = useState<SignInPhase>("sign-in");
  const [email, setEmail] = useState(demoAccountEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const demoMode = canUseSupabaseDemo();

  const showPhase = (next: SignInPhase) => {
    setError("");
    setNotice("");
    setPhase(next);
  };

  const submitSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await signIn(email, password, demoAccountEmail);
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    await onSignedIn();
    setBusy(false);
  };

  const submitResetEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setEmail(normalizeEmail(email));
    setCode("");
    showPhase("reset-code");
  };

  const resendResetCode = async () => {
    setError("");
    setBusy(true);
    const result = await requestPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setNotice(demoMode ? `Codul este ${DEMO_VERIFICATION_CODE}.` : "Am retrimis codul pe email.");
  };

  const submitNewPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const result = await confirmPasswordReset(email, code, newPassword, confirmation);
    if (!result.ok) {
      setBusy(false);
      return setError(result.message);
    }
    await onSignedIn();
    setBusy(false);
  };

  return (
    <main className="account-shell">
      <header className="account-header">
        <button className="landing-brand" type="button" onClick={onBack}><BrandMark className="landing-brand-mark" /><span>ProfitExact</span></button>
        <button className="account-back" type="button" onClick={phase === "sign-in" ? onBack : () => showPhase("sign-in")}>
          {phase === "sign-in" ? "Înapoi la prima pagină" : "Înapoi la conectare"}
        </button>
      </header>
      <div className="account-layout">
        <AccountPromise />

        {phase === "sign-in" ? (
          <section className="account-card">
            <p className="landing-kicker">Bine ai revenit</p>
            <h2>Intră în cont</h2>
            <p>Datele tale te așteaptă exact cum le-ai lăsat, pe orice dispozitiv.</p>
            {demoMode ? <p className="demo-code">Mod de depanare local: contul de test este pe acest calculator, iar parola nu se verifică.</p> : null}
            <form onSubmit={submitSignIn} noValidate>
              <label><span>Adresă de email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nume@exemplu.ro" /></label>
              <label><span>Parolă</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Parola contului" /></label>
              {error ? <p className="account-error" role="alert">{error}</p> : null}
              <button className="landing-primary account-submit" type="submit" disabled={busy}>{busy ? "Se conectează..." : "Intră în cont"}</button>
              <button className="resend-button" type="button" onClick={() => showPhase("reset-email")} disabled={busy}>Am uitat parola</button>
            </form>
            <p className="account-note">Nu ai cont? <button className="inline-link" type="button" onClick={onCreateAccount}>Creează cont gratuit</button></p>
          </section>
        ) : null}

        {phase === "reset-email" ? (
          <section className="account-card">
            <p className="landing-kicker">Parolă nouă · Pasul 1 din 2</p>
            <h2>Ai uitat parola?</h2>
            <p>Îți trimitem un cod pe email. Cu el îți alegi singur o parolă nouă.</p>
            <form onSubmit={submitResetEmail} noValidate>
              <label><span>Adresă de email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nume@exemplu.ro" /></label>
              {error ? <p className="account-error" role="alert">{error}</p> : null}
              <button className="landing-primary account-submit" type="submit" disabled={busy}>{busy ? "Se trimite..." : "Trimite codul"}</button>
            </form>
          </section>
        ) : null}

        {phase === "reset-code" ? (
          <section className="account-card verification-card">
            <p className="landing-kicker">Parolă nouă · Pasul 2 din 2</p>
            <h2>Alege parola nouă</h2>
            <p>Dacă există un cont pentru <strong>{email}</strong>, am trimis acolo un cod.</p>
            {demoMode ? <p className="demo-code">Mod de depanare local: codul este <strong>{DEMO_VERIFICATION_CODE}</strong></p> : null}
            <form onSubmit={submitNewPassword} noValidate>
              <label><span>Cod primit pe email</span><input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>
              <label><span>Parolă nouă</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Minimum 8 caractere" /></label>
              <label><span>Confirmă parola nouă</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repetă parola" /></label>
              {error ? <p className="account-error" role="alert">{error}</p> : null}
              {notice ? <p className="account-notice" role="status">{notice}</p> : null}
              <button className="landing-primary account-submit" type="submit" disabled={busy || code.length < 6}>{busy ? "Se salvează..." : "Salvează parola și intră"}</button>
              <button className="resend-button" type="button" onClick={resendResetCode} disabled={busy}>Retrimite codul</button>
            </form>
          </section>
        ) : null}
      </div>
    </main>
  );
}
