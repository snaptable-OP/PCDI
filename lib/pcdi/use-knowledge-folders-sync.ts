"use client";

import { useEffect, useRef, useState } from "react";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import { syncKnowledgeFoldersFromApi } from "@/lib/pcdi/sync-knowledge-folders-from-api";
import { syncReferenceFilesForProject } from "@/lib/pcdi/sync-reference-files-from-api";

/**
 * Loads Knowledge Folders and reference files for the selected project.
 */
export function useKnowledgeFoldersSync(projectId: string | null) {
  const [loading, setLoading] = useState(Boolean(projectId?.trim()));
  const [error, setError] = useState<string | null>(null);
  const leaderRef = useRef<AbortController | null>(null);

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
      const folderResult = await syncKnowledgeFoldersFromApi(pid, controller.signal);
      if (cancelled || leaderRef.current !== controller) return;
      if (!folderResult.ok) {
        setError(folderResult.error ?? "Could not load knowledge folders.");
        setLoading(false);
        return;
      }

      const folderIds = useKnowledgeFoldersStore
        .getState()
        .folders.filter((f) => f.projectId === pid)
        .map((f) => f.id);

      const fileResult = await syncReferenceFilesForProject(pid, folderIds, controller.signal);
      if (cancelled || leaderRef.current !== controller) return;
      if (!fileResult.ok) {
        setError(fileResult.error ?? "Could not load reference files.");
      }
      setLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
      controller.abort();
      if (leaderRef.current === controller) leaderRef.current = null;
    };
  }, [projectId]);

  const refresh = () => {
    const pid = projectId?.trim();
    if (!pid) return;
    leaderRef.current?.abort();
    const controller = new AbortController();
    leaderRef.current = controller;
    setLoading(true);
    setError(null);
    void (async () => {
      const folderResult = await syncKnowledgeFoldersFromApi(pid, controller.signal);
      if (leaderRef.current !== controller) return;
      if (!folderResult.ok) {
        setError(folderResult.error ?? "Could not load knowledge folders.");
        setLoading(false);
        return;
      }
      const folderIds = useKnowledgeFoldersStore
        .getState()
        .folders.filter((f) => f.projectId === pid)
        .map((f) => f.id);
      const fileResult = await syncReferenceFilesForProject(pid, folderIds, controller.signal);
      if (leaderRef.current !== controller) return;
      if (!fileResult.ok) setError(fileResult.error ?? "Could not load reference files.");
      setLoading(false);
    })();
  };

  return { loading, error, refresh };
}
