import {
  createEmptyWorkspace,
  deserializeWorkspace,
  serializeWorkspace,
  type WorkspaceSnapshot,
} from "./workspace";
import type { WorkspaceRepository } from "./workspace-repository";

/**
 * Salvarea de test, pe calculatorul care rulează aplicația.
 *
 * Este folosită numai în modul de depanare local (codurile fixe 123456), unde
 * nu există sesiune Supabase autentificată, deci nicio scriere în baza online
 * nu ar trece oricum de politicile RLS. Scopul ei este ca onboarding-ul, zilele
 * și perioadele să supraviețuiască unui refresh în timpul testării.
 */
export const DEMO_WORKSPACE_KEY = "profitexact:demo-workspace:v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * `localStorage` poate lipsi (randare pe server) sau poate arunca (mod privat,
 * cookie-uri de site blocate). În ambele cazuri aplicația trebuie să meargă mai
 * departe fără salvare, nu să se oprească.
 */
function getStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    const probe = window.localStorage;
    const key = "profitexact:probe";
    probe.setItem(key, "1");
    probe.removeItem(key);
    return probe;
  } catch {
    return null;
  }
}

export function createLocalWorkspaceRepository(
  key: string = DEMO_WORKSPACE_KEY,
): WorkspaceRepository {
  return {
    mode: "demo",

    async load() {
      const storage = getStorage();
      if (!storage) return { snapshot: createEmptyWorkspace(), warnings: [] };

      let raw: string | null = null;
      try {
        raw = storage.getItem(key);
      } catch {
        return { snapshot: createEmptyWorkspace(), warnings: [] };
      }

      const snapshot = deserializeWorkspace(raw);
      if (raw && !snapshot) {
        // Date vechi sau stricate: pornim curat, dar spunem de ce.
        try {
          storage.removeItem(key);
        } catch {
          /* nimic de făcut */
        }
        return {
          snapshot: createEmptyWorkspace(),
          warnings: [
            "Datele salvate anterior pe acest calculator aveau altă structură și au fost ignorate.",
          ],
        };
      }

      return { snapshot: snapshot ?? createEmptyWorkspace(), warnings: [] };
    },

    async save(snapshot: WorkspaceSnapshot) {
      const storage = getStorage();
      if (!storage) {
        return {
          warnings: ["Browserul nu permite salvarea locală, deci datele nu vor rezista la refresh."],
        };
      }

      try {
        storage.setItem(key, serializeWorkspace(snapshot));
        return { warnings: [] };
      } catch {
        return {
          warnings: ["Spațiul de salvare al browserului este plin sau blocat."],
        };
      }
    },

    async clear() {
      const storage = getStorage();
      if (!storage) return;
      try {
        storage.removeItem(key);
      } catch {
        /* nimic de făcut */
      }
    },
  };
}
