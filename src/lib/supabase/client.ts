import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

/** Codul fix acceptat pentru email și telefon în modul de depanare local. */
export const DEMO_VERIFICATION_CODE = "123456";

let browserClient: SupabaseClient | null = null;

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublicKey);
}

/**
 * Modul de depanare este ACTIV IMPLICIT când aplicația rulează local
 * (`npm run dev`), indiferent dacă Supabase este configurat sau nu.
 * În acest mod nu se trimite niciun email și niciun SMS, iar codul acceptat
 * atât pentru email cât și pentru telefon este DEMO_VERIFICATION_CODE.
 *
 * Ca să testezi local fluxul real prin Supabase, pune în .env.local:
 *   NEXT_PUBLIC_DEMO_AUTH=off
 *
 * În producție (`npm run build` + `npm start`) este întotdeauna dezactivat,
 * deci nu există risc ca un cod fix să ajungă pe site-ul urcat online.
 */
export function canUseSupabaseDemo() {
  if (process.env.NODE_ENV !== "development") return false;
  return process.env.NEXT_PUBLIC_DEMO_AUTH?.trim().toLowerCase() !== "off";
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabasePublicKey) {
    return null;
  }

  browserClient ??= createBrowserClient(supabaseUrl, supabasePublicKey);
  return browserClient;
}
