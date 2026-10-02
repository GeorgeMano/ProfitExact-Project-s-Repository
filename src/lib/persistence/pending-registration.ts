/**
 * Înregistrarea începută, dar neterminată, pe acest dispozitiv.
 *
 * Păstrează doar emailul la care s-a trimis codul, ca prima pagină să poată
 * oferi „Continuă de unde ai rămas” și după o reîncărcare. Parola nu se
 * păstrează niciodată.
 */
export const PENDING_REGISTRATION_KEY = "profitexact:pending-registration:v1";

export interface PendingRegistration {
  email: string;
  /** Modul de depanare local, cu codul fix 123456. */
  demo: boolean;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readPendingRegistration(): PendingRegistration | null {
  try {
    const raw = storage()?.getItem(PENDING_REGISTRATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingRegistration>;
    if (typeof value.email !== "string" || !value.email.includes("@")) return null;
    return { email: value.email, demo: value.demo === true };
  } catch {
    return null;
  }
}

export function savePendingRegistration(value: PendingRegistration) {
  try {
    storage()?.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(value));
  } catch {
    /* fără salvare locală, reluarea pur și simplu nu va fi oferită */
  }
}

export function clearPendingRegistration() {
  try {
    storage()?.removeItem(PENDING_REGISTRATION_KEY);
  } catch {
    /* nimic de făcut */
  }
}
