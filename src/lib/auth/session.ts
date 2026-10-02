import {
  canUseSupabaseDemo,
  DEMO_VERIFICATION_CODE,
  getSupabaseBrowserClient,
} from "@/lib/supabase/client";

/**
 * Conectarea, resetarea parolei și ieșirea din cont.
 *
 * Cu Supabase configurat, totul trece prin Supabase Auth: parola nu ajunge
 * niciodată în baza aplicației și nimeni, nici proprietarul, nu o poate vedea.
 *
 * În modul de depanare local (codul 123456) nu există server de autentificare:
 * contul de test stă numai pe acest calculator, deci conectarea verifică doar
 * emailul, iar ieșirea din cont este reținută local.
 */

export type AuthResult = { ok: true } | { ok: false; message: string };

const DEMO_SIGNED_OUT_KEY = "profitexact:demo-signed-out:v1";
const MIN_PASSWORD_LENGTH = 8;

function localStore(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Contul de test local este marcat ca „ieșit” până la o nouă conectare. */
export function isDemoSignedOut() {
  try {
    return localStore()?.getItem(DEMO_SIGNED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoSignedOut(value: boolean) {
  try {
    if (value) localStore()?.setItem(DEMO_SIGNED_OUT_KEY, "1");
    else localStore()?.removeItem(DEMO_SIGNED_OUT_KEY);
  } catch {
    /* fără salvare locală, contul de test rămâne conectat */
  }
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function validatePassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Parola trebuie să aibă cel puțin ${MIN_PASSWORD_LENGTH} caractere.`;
  }
  if (password !== confirmation) return "Parolele introduse nu coincid.";
  return null;
}

/**
 * @param demoAccountEmail emailul contului de test salvat pe acest calculator,
 *   folosit numai în modul de depanare local.
 */
export async function signIn(
  email: string,
  password: string,
  demoAccountEmail: string | null,
): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return { ok: false, message: "Introdu o adresă de email validă." };
  if (!password) return { ok: false, message: "Introdu parola." };

  if (canUseSupabaseDemo()) {
    if (!demoAccountEmail || normalizeEmail(demoAccountEmail) !== normalized) {
      return { ok: false, message: "Nu există niciun cont cu acest email pe acest calculator." };
    }
    setDemoSignedOut(false);
    return { ok: true };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, message: "Conectarea nu este disponibilă momentan." };

  const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
  if (error) {
    return {
      ok: false,
      message: /confirm/i.test(error.message)
        ? "Emailul nu este confirmat încă. Creează contul din nou ca să primești un cod nou."
        : "Emailul sau parola nu sunt corecte.",
    };
  }
  return { ok: true };
}

/** Trimite codul pentru parola nouă. Nu spune dacă emailul există, ca să nu-l dezvăluie. */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) return { ok: false, message: "Introdu o adresă de email validă." };
  if (canUseSupabaseDemo()) return { ok: true };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, message: "Resetarea parolei nu este disponibilă momentan." };

  const { error } = await supabase.auth.resetPasswordForEmail(normalized);
  if (error && /rate|seconds|many/i.test(error.message)) {
    return { ok: false, message: "Ai cerut deja un cod. Așteaptă puțin și încearcă din nou." };
  }
  return { ok: true };
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  password: string,
  confirmation: string,
): Promise<AuthResult> {
  const passwordError = validatePassword(password, confirmation);
  if (passwordError) return { ok: false, message: passwordError };

  if (canUseSupabaseDemo()) {
    if (code !== DEMO_VERIFICATION_CODE) {
      return { ok: false, message: `În modul de depanare local, folosește codul ${DEMO_VERIFICATION_CODE}.` };
    }
    setDemoSignedOut(false);
    return { ok: true };
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, message: "Resetarea parolei nu este disponibilă momentan." };

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: code,
    type: "recovery",
  });
  if (verifyError) return { ok: false, message: "Codul este incorect sau a expirat." };

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return {
      ok: false,
      message: /different|same/i.test(updateError.message)
        ? "Parola nouă trebuie să fie diferită de cea veche."
        : "Parola nu a putut fi schimbată. Încearcă din nou.",
    };
  }
  return { ok: true };
}

export async function signOut() {
  if (canUseSupabaseDemo()) {
    setDemoSignedOut(true);
    return;
  }
  await getSupabaseBrowserClient()?.auth.signOut();
}
