import type { WorkspaceSnapshot } from "./workspace";

/**
 * Modul în care sunt păstrate datele:
 *
 * - `demo`   — depanare locală cu codurile fixe 123456; datele stau pe calculator
 *              și rezistă la refresh, dar nu ajung în baza online;
 * - `account`— există o sesiune Supabase autentificată, deci datele aparțin
 *              contului și trec prin politicile RLS;
 * - `none`   — producție fără cont; nu se salvează nimic.
 */
export type WorkspaceMode = "demo" | "account" | "none";

export interface WorkspaceLoadResult {
  snapshot: WorkspaceSnapshot;
  /** Mesaje pentru utilizator despre ce nu a putut fi citit. Niciodată erori aruncate. */
  warnings: string[];
}

export interface WorkspaceSaveResult {
  warnings: string[];
}

export interface WorkspaceRepository {
  readonly mode: WorkspaceMode;
  load(): Promise<WorkspaceLoadResult>;
  save(snapshot: WorkspaceSnapshot): Promise<WorkspaceSaveResult>;
  clear(): Promise<void>;
}

/** Folosit în producție fără cont: aplicația merge, dar nu păstrează nimic. */
export function createNullWorkspaceRepository(): WorkspaceRepository {
  return {
    mode: "none",
    async load() {
      const { createEmptyWorkspace } = await import("./workspace");
      return { snapshot: createEmptyWorkspace(), warnings: [] };
    },
    async save() {
      return { warnings: [] };
    },
    async clear() {
      /* nimic de șters */
    },
  };
}
