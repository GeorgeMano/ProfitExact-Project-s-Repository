"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canUseSupabaseDemo, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLocalWorkspaceRepository } from "./local-workspace";
import { createSupabaseWorkspaceRepository } from "./supabase-workspace";
import {
  createNullWorkspaceRepository,
  type WorkspaceMode,
  type WorkspaceRepository,
} from "./workspace-repository";
import { createEmptyWorkspace, type WorkspaceSnapshot } from "./workspace";

/** Scrierile dese (tastare într-un câmp) se comasează într-o singură salvare. */
const SAVE_DEBOUNCE_MS = 400;

export interface UseWorkspaceResult {
  /** `loading` până când citirea din storage se termină; evită nepotrivirea la hidratare. */
  status: "loading" | "ready";
  mode: WorkspaceMode;
  snapshot: WorkspaceSnapshot;
  warnings: string[];
  update: (recipe: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => void;
  reset: () => void;
}

/**
 * Alege unde se salvează, în această ordine:
 *   1. cont Supabase autentificat — datele aparțin utilizatorului;
 *   2. mod de depanare local (codurile 123456) — datele stau pe calculator;
 *   3. nimic — producție fără cont.
 */
async function resolveRepository(): Promise<WorkspaceRepository> {
  const client = getSupabaseBrowserClient();

  if (client) {
    try {
      const { data } = await client.auth.getUser();
      if (data.user) {
        return createSupabaseWorkspaceRepository(client, data.user.id);
      }
    } catch {
      // Fără sesiune validă mergem mai departe către modul demo.
    }
  }

  return canUseSupabaseDemo()
    ? createLocalWorkspaceRepository()
    : createNullWorkspaceRepository();
}

export function useWorkspace(): UseWorkspaceResult {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [mode, setMode] = useState<WorkspaceMode>("none");
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(createEmptyWorkspace);
  const [warnings, setWarnings] = useState<string[]>([]);

  const repositoryRef = useRef<WorkspaceRepository | null>(null);
  const pendingRef = useRef<WorkspaceSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const repository = repositoryRef.current;
    const pending = pendingRef.current;
    if (!repository || !pending) return;

    pendingRef.current = null;
    const { warnings: saveWarnings } = await repository.save(pending);
    if (saveWarnings.length > 0) setWarnings(saveWarnings);
  }, []);

  // Citirea inițială. Rulează numai în browser, după montare, ca serverul și
  // clientul să randeze același lucru la prima trecere.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const repository = await resolveRepository();
      if (cancelled) return;

      repositoryRef.current = repository;
      const { snapshot: loaded, warnings: loadWarnings } = await repository.load();
      if (cancelled) return;

      setMode(repository.mode);
      setSnapshot(loaded);
      setWarnings(loadWarnings);
      setStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Ultima salvare la închiderea paginii, ca să nu se piardă modificarea aflată
  // încă în fereastra de comasare.
  useEffect(() => {
    const handle = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };

    window.addEventListener("pagehide", handle);
    return () => {
      window.removeEventListener("pagehide", handle);
      handle();
    };
  }, [flush]);

  const update = useCallback(
    (recipe: (current: WorkspaceSnapshot) => WorkspaceSnapshot) => {
      setSnapshot((current) => {
        const next = recipe(current);
        pendingRef.current = next;

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          void flush();
        }, SAVE_DEBOUNCE_MS);

        return next;
      });
    },
    [flush],
  );

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = null;
    setWarnings([]);
    setSnapshot(createEmptyWorkspace());
    void repositoryRef.current?.clear();
  }, []);

  return { status, mode, snapshot, warnings, update, reset };
}
