"use client";

import { useState, type FormEvent } from "react";
import {
  canUseSupabaseDemo,
  DEMO_VERIFICATION_CODE,
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import {
  clearPendingRegistration,
  savePendingRegistration,
  type PendingRegistration,
} from "@/lib/persistence/pending-registration";
import { BrandMark } from "./brand-mark";

type AccountPhase = "details" | "email-code";

export function AccountPromise() {
  return (
    <section className="account-promise">
      <p className="landing-kicker light">Contul tău ProfitExact</p>
      <h1>Începi cu datele care descriu activitatea ta.</h1>
      <p>După verificarea contului urmează onboarding-ul. Configurația va fi folosită automat pentru zilele, săptămânile și lunile următoare.</p>
      <div className="account-trial"><span>Perioadă de probă</span><strong>14 zile gratuit</strong><small>Apoi 24,99 RON/lună.</small></div>
      <ul><li>Email verificat</li><li>Un singur cont pentru ridesharing și delivery</li><li>Costuri adaptate vehiculului și formei de lucru</li><li>Istoric păstrat pentru comparații viitoare</li></ul>
    </section>
  );
}

export function AccountCreation({ onBack, onContinue, onSignIn, resume }: {
  onBack: () => void;
  onContinue: (account: { email: string }) => void | Promise<void>;
  onSignIn: () => void;
  /** Înregistrarea începută anterior: se reia de la pasul codului. */
  resume?: PendingRegistration | null;
}) {
  const [phase, setPhase] = useState<AccountPhase>(resume ? "email-code" : "details");
  const [email, setEmail] = useState(resume?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [demoMode, setDemoMode] = useState(resume?.demo ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const startVerification = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.includes("@")) return setError("Introdu o adresă de email validă.");
    if (password.length < 8) return setError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (password !== confirmation) return setError("Parolele introduse nu coincid.");

    setEmail(normalizedEmail);
    setError("");
    setNotice("");

    // Local (npm run dev) sărim verificarea reală: nu se trimite emailul,
    // codul acceptat este DEMO_VERIFICATION_CODE.
    if (canUseSupabaseDemo()) {
      setDemoMode(true);
      setPhase("email-code");
      savePendingRegistration({ email: normalizedEmail, demo: true });
      return;
    }

    if (!hasSupabaseConfig()) {
      return setError("Crearea contului nu este disponibilă momentan. Încearcă mai târziu.");
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Serviciul de creare cont nu este configurat.");

    setBusy(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    setBusy(false);

    if (signUpError || data.user?.identities?.length === 0) {
      return setError("Adresa de email este deja folosită sau contul nu a putut fi creat.");
    }

    setPhase("email-code");
    savePendingRegistration({ email: normalizedEmail, demo: false });
  };

  const verifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (demoMode) {
      if (emailCode !== DEMO_VERIFICATION_CODE) {
        return setError(`În modul de depanare local, folosește codul ${DEMO_VERIFICATION_CODE}.`);
      }
      clearPendingRegistration();
      onContinue({ email });
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Serviciul de verificare nu este configurat.");

    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: emailCode,
      type: "email",
    });

    if (verifyError) {
      setBusy(false);
      return setError("Codul primit pe email este incorect sau a expirat.");
    }

    setBusy(false);
    clearPendingRegistration();
    onContinue({ email });
  };

  const resendEmail = async () => {
    setError("");
    if (demoMode) return setNotice(`Codul pentru email este ${DEMO_VERIFICATION_CODE}.`);
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (resendError) return setError("Codul nu a putut fi retrimis încă. Încearcă din nou mai târziu.");
    setNotice("Am retrimis codul pe email.");
  };

  const goBack = () => {
    setError("");
    setNotice("");
    if (phase === "details") onBack();
    else setPhase("details");
  };

  return (
    <main className="account-shell">
      <header className="account-header"><button className="landing-brand" type="button" onClick={onBack}><BrandMark className="landing-brand-mark" /><span>ProfitExact</span></button><button className="account-back" type="button" onClick={goBack}>{phase === "details" ? "Înapoi la prima pagină" : "Modifică datele contului"}</button></header>
      <div className="account-layout">
        <AccountPromise />
        {phase === "details" ? (
          <section className="account-card"><p className="landing-kicker">Pasul 1 din 2</p><h2>Creează contul</h2><p>Adresa de email identifică un singur cont ProfitExact.</p><form onSubmit={startVerification} noValidate><label><span>Adresă de email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nume@exemplu.ro" /></label><label><span>Parolă</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 caractere" /></label><label><span>Confirmă parola</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repetă parola" /></label>{error ? <p className="account-error" role="alert">{error}</p> : null}<button className="landing-primary account-submit" type="submit" disabled={busy}>{busy ? "Se creează contul..." : "Creează contul"}</button></form><p className="account-note">Un email deja folosit nu poate crea alt cont. Ai deja cont? <button className="inline-link" type="button" onClick={onSignIn}>Intră în cont</button></p></section>
        ) : null}
        {phase === "email-code" ? (
          <section className="account-card verification-card"><p className="landing-kicker">Pasul 2 din 2</p><h2>Verifică emailul</h2><p>Introdu codul trimis la <strong>{email}</strong>.</p>{demoMode ? <p className="demo-code">Mod de depanare local: codul este <strong>{DEMO_VERIFICATION_CODE}</strong></p> : null}<form onSubmit={verifyEmail}><label><span>Cod primit pe email</span><input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>{error ? <p className="account-error" role="alert">{error}</p> : null}{notice ? <p className="account-notice" role="status">{notice}</p> : null}<button className="landing-primary account-submit" type="submit" disabled={busy || emailCode.length < 6}>{busy ? "Se verifică..." : "Verifică emailul și continuă"}</button><button className="resend-button" type="button" onClick={resendEmail} disabled={busy}>Retrimite codul</button></form></section>
        ) : null}
      </div>
    </main>
  );
}
