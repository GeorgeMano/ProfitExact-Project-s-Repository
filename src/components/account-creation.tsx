"use client";

import { useState, type FormEvent } from "react";
import {
  getSupabaseBrowserClient,
  hasSupabaseConfig,
} from "@/lib/supabase/client";
import { BrandMark } from "./brand-mark";

type AccountPhase = "details" | "email-code" | "phone-code";

function normalizeRomanianMobile(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0040")) digits = digits.slice(2);
  if (digits.startsWith("40")) return `+${digits}`;
  if (digits.startsWith("0")) return `+40${digits.slice(1)}`;
  return `+40${digits}`;
}

function AccountPromise() {
  return (
    <section className="account-promise">
      <p className="landing-kicker light">Contul tău ProfitExact</p>
      <h1>Începi cu datele care descriu activitatea ta.</h1>
      <p>După verificarea contului urmează onboarding-ul. Configurația va fi folosită automat pentru zilele, săptămânile și lunile următoare.</p>
      <div className="account-trial"><span>Perioadă de probă</span><strong>14 zile gratuit</strong><small>Apoi 24,99 RON/lună.</small></div>
      <ul><li>Email și telefon verificate</li><li>Un singur cont pentru ridesharing și delivery</li><li>Costuri adaptate vehiculului și formei de lucru</li><li>Istoric păstrat pentru comparații viitoare</li></ul>
    </section>
  );
}

export function AccountCreation({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [phase, setPhase] = useState<AccountPhase>("details");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const startVerification = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizeRomanianMobile(phone);

    if (!normalizedEmail.includes("@")) return setError("Introdu o adresă de email validă.");
    if (!/^\+407\d{8}$/.test(normalizedPhone)) return setError("Introdu un număr mobil valid din România.");
    if (password.length < 8) return setError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (password !== confirmation) return setError("Parolele introduse nu coincid.");

    setEmail(normalizedEmail);
    setPhone(normalizedPhone);
    setError("");
    setNotice("");

    if (!hasSupabaseConfig()) {
      setDemoMode(true);
      setPhase("email-code");
      return;
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
  };

  const verifyEmail = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (demoMode) {
      if (emailCode !== "123456") return setError("În modul demonstrativ, folosește codul 123456.");
      setPhase("phone-code");
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

    const { error: phoneError } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (phoneError) return setError("Numărul de telefon este deja folosit sau nu poate primi codul.");
    setPhase("phone-code");
  };

  const verifyPhone = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (demoMode) {
      if (phoneCode !== "123456") return setError("În modul demonstrativ, folosește codul 123456.");
      onContinue();
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError("Serviciul de verificare nu este configurat.");

    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: phoneCode,
      type: "phone_change",
    });
    setBusy(false);

    if (verifyError) return setError("Codul primit prin SMS este incorect sau a expirat.");
    onContinue();
  };

  const resendEmail = async () => {
    setError("");
    if (demoMode) return setNotice("Codul demonstrativ pentru email este 123456.");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (resendError) return setError("Codul nu a putut fi retrimis încă. Încearcă din nou mai târziu.");
    setNotice("Am retrimis codul pe email.");
  };

  const resendPhone = async () => {
    setError("");
    if (demoMode) return setNotice("Codul demonstrativ pentru telefon este 123456.");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({ type: "phone_change", phone });
    setBusy(false);
    if (resendError) return setError("Codul SMS nu a putut fi retrimis încă. Încearcă din nou mai târziu.");
    setNotice("Am retrimis codul prin SMS.");
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
          <section className="account-card"><p className="landing-kicker">Pasul 1 din 3</p><h2>Creează contul</h2><p>Emailul și numărul de telefon vor identifica un singur cont ProfitExact.</p><form onSubmit={startVerification} noValidate><label><span>Adresă de email</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nume@exemplu.ro" /></label><label><span>Număr de telefon</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07xx xxx xxx" /></label><label><span>Parolă</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 8 caractere" /></label><label><span>Confirmă parola</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Repetă parola" /></label>{error ? <p className="account-error" role="alert">{error}</p> : null}<button className="landing-primary account-submit" type="submit" disabled={busy}>{busy ? "Se creează contul..." : "Creează contul"}</button></form><p className="account-note">Un email sau un telefon deja folosit nu poate crea alt cont.</p></section>
        ) : null}
        {phase === "email-code" ? (
          <section className="account-card verification-card"><p className="landing-kicker">Pasul 2 din 3</p><h2>Verifică emailul</h2><p>Introdu codul trimis la <strong>{email}</strong>.</p>{demoMode ? <p className="demo-code">Mod demonstrativ: codul este <strong>123456</strong></p> : null}<form onSubmit={verifyEmail}><label><span>Cod primit pe email</span><input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={emailCode} onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>{error ? <p className="account-error" role="alert">{error}</p> : null}{notice ? <p className="account-notice" role="status">{notice}</p> : null}<button className="landing-primary account-submit" type="submit" disabled={busy || emailCode.length < 6}>{busy ? "Se verifică..." : "Verifică emailul"}</button><button className="resend-button" type="button" onClick={resendEmail} disabled={busy}>Retrimite codul</button></form></section>
        ) : null}
        {phase === "phone-code" ? (
          <section className="account-card verification-card"><p className="landing-kicker">Pasul 3 din 3</p><h2>Verifică telefonul</h2><p>Introdu codul SMS trimis la <strong>{phone}</strong>.</p>{demoMode ? <p className="demo-code">Mod demonstrativ: codul este <strong>123456</strong></p> : null}<form onSubmit={verifyPhone}><label><span>Cod primit prin SMS</span><input className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={phoneCode} onChange={(event) => setPhoneCode(event.target.value.replace(/\D/g, ""))} placeholder="••••••" /></label>{error ? <p className="account-error" role="alert">{error}</p> : null}{notice ? <p className="account-notice" role="status">{notice}</p> : null}<button className="landing-primary account-submit" type="submit" disabled={busy || phoneCode.length < 6}>{busy ? "Se verifică..." : "Verifică telefonul și continuă"}</button><button className="resend-button" type="button" onClick={resendPhone} disabled={busy}>Retrimite codul SMS</button></form></section>
        ) : null}
      </div>
    </main>
  );
}
