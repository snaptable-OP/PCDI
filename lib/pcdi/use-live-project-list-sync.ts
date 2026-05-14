"use client";

import { useEffect, useRef, useState } from "react";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import { syncLiveProjectsFromApi } from "@/lib/pcdi/sync-live-projects-from-api";

/**
 * Keeps live defect projects in sync with GET /api/defect-projects (Billie).
 * Used by the live project table and the home overview when Create project is shown.
 */
export function useLiveProjectListSync(enabled: boolean) {
  const [liveSyncLoading, setLiveSyncLoading] = useState(enabled);
  const [liveSyncError, setLiveSyncError] = useState<string | null>(null);
  const liveFetchLeaderRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const persistApi = useHistoricalProjectsStore.persist;

    async function syncLiveProjects() {
      liveFetchLeaderRef.current?.abort();
      const controller = new AbortController();
      liveFetchLeaderRef.current = controller;

      setLiveSyncLoading(true);
      setLiveSyncError(null);
      const timeoutId = window.setTimeout(() => controller.abort(), 18_000);
      try {
        const result = await syncLiveProjectsFromApi(controller.signal);
        window.clearTimeout(timeoutId);
        if (liveFetchLeaderRef.current !== controller) return;
        if (!cancelled && !result.ok) {
          setLiveSyncError(result.error ?? "Could not load projects from the analysis server.");
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (liveFetchLeaderRef.current === controller) {
          setLiveSyncLoading(false);
        }
      }
    }

    let unsubHydration: (() => void) | undefined;
    const kickSync = () => void syncLiveProjects();

    if (persistApi.hasHydrated()) {
      kickSync();
    } else {
      unsubHydration = persistApi.onFinishHydration(kickSync);
    }
    const hydrationFallbackId = window.setTimeout(() => {
      if (!persistApi.hasHydrated()) kickSync();
    }, 750);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void syncLiveProjects();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearTimeout(hydrationFallbackId);
      unsubHydration?.();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      liveFetchLeaderRef.current?.abort();
      liveFetchLeaderRef.current = null;
      setLiveSyncLoading(false);
    };
  }, [enabled]);

  return { liveSyncLoading, liveSyncError };
}
