"use client";

import { useEffect, useRef, useState } from "react";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import { syncResponseAgentsFromApi } from "@/lib/pcdi/sync-response-agents-from-api";

/**
 * Loads response agents for the selected project (via agents on each knowledge folder).
 */
export function useResponseAgentsSync(projectId: string | null) {
  const [loading, setLoading] = useState(Boolean(projectId?.trim()));
  const [error, setError] = useState<string | null>(null);
  const leaderRef = useRef<AbortController | null>(null);
  const folderCount = useKnowledgeFoldersStore((s) =>
    projectId ? s.folders.filter((f) => f.projectId === projectId).length : 0,
  );

  useEffect(() => {
    const pid = projectId?.trim() ?? "";
    if (!pid) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    leaderRef.current?.abort();
    const controller = new AbortController();
    leaderRef.current = controller;

    async function run() {
      setLoading(true);
      setError(null);
      const result = await syncResponseAgentsFromApi(pid, controller.signal);
      if (cancelled || leaderRef.current !== controller) return;
      if (!result.ok) setError(result.error ?? "Could not load response agents.");
      setLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (leaderRef.current === controller) leaderRef.current = null;
    };
  }, [projectId, folderCount]);

  const refresh = () => {
    const pid = projectId?.trim();
    if (!pid) return;
    leaderRef.current?.abort();
    const controller = new AbortController();
    leaderRef.current = controller;
    setLoading(true);
    setError(null);
    void syncResponseAgentsFromApi(pid, controller.signal).then((result) => {
      if (leaderRef.current !== controller) return;
      if (!result.ok) setError(result.error ?? "Could not load response agents.");
      setLoading(false);
    });
  };

  return { loading, error, refresh };
}
