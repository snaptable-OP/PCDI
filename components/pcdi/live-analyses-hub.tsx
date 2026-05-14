"use client";

import Link from "next/link";
import { MoreHorizontal, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractDefectFileListFromProjectQueryBody } from "@/lib/pcdi/extract-backend-columns";
import type { DefectFileListItem } from "@/lib/pcdi/extract-backend-columns";
import { useLiveSelectedProjectStore } from "@/lib/pcdi/live-selected-project-store";
import { syncLiveProjectsFromApi } from "@/lib/pcdi/sync-live-projects-from-api";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";

function statusLabel(isProcessed?: string): string {
  const s = isProcessed?.toUpperCase() ?? "";
  if (s === "SUCCESS") return "Ready";
  if (s === "PROCESSING") return "Processing";
  if (s === "FAIL") return "Failed";
  return isProcessed ?? "—";
}

function AnalysisRowActionsMenu({
  defectFileId,
  analysisLabel,
  onDeleted,
}: {
  defectFileId: string;
  analysisLabel: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onDelete = async () => {
    if (
      !window.confirm(
        `Delete analysis "${analysisLabel}"? This removes the defect file on the analysis server and cannot be undone.`,
      )
    ) {
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/defect-files/${encodeURIComponent(defectFileId)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? "Could not delete this analysis.");
        return;
      }
      onDeleted();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-[var(--muted-foreground)] outline-none hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-50"
        title="More actions"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
        <span className="sr-only">More actions</span>
      </button>
      {err ? <p className="max-w-[12rem] text-right text-xs text-red-600 dark:text-red-400">{err}</p> : null}
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void onDelete()}
            className="w-full px-3 py-2 text-left text-sm text-red-600 outline-none hover:bg-[var(--surface-muted)] disabled:opacity-50 dark:text-red-400"
          >
            {busy ? "Deleting…" : "Delete analysis"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function LiveAnalysesHub({ basePath }: { basePath: string }) {
  const allProjects = useHistoricalProjectsStore((s) => s.projects);
  const removeProject = useHistoricalProjectsStore((s) => s.removeProject);
  const projects = useMemo(
    () => allProjects.filter((p) => p.analysisModule === "live"),
    [allProjects],
  );
  const selectedId = useLiveSelectedProjectStore((s) => s.selectedProjectId);
  const setSelected = useLiveSelectedProjectStore((s) => s.setSelectedProjectId);

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncErr, setSyncErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const persistApi = useHistoricalProjectsStore.persist;

    const run = async () => {
      setSyncBusy(true);
      setSyncErr(null);
      const result = await syncLiveProjectsFromApi();
      if (cancelled) return;
      setSyncBusy(false);
      if (!result.ok) setSyncErr(result.error ?? null);
    };

    let unsub: (() => void) | undefined;
    if (persistApi.hasHydrated()) {
      void run();
    } else {
      unsub = persistApi.onFinishHydration(() => {
        void run();
      });
    }
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const list = [...projects].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    if (list.length === 0) return;
    if (!selectedId || !list.some((p) => p.id === selectedId)) {
      setSelected(list[0]!.id);
    }
  }, [projects, selectedId, setSelected]);

  const project = selectedId ? projects.find((p) => p.id === selectedId) : undefined;

  const [filesLoading, setFilesLoading] = useState(false);
  const [filesErr, setFilesErr] = useState<string | null>(null);
  const [files, setFiles] = useState<DefectFileListItem[]>([]);
  const [deleteProjectBusy, setDeleteProjectBusy] = useState(false);
  const [deleteProjectErr, setDeleteProjectErr] = useState<string | null>(null);

  const refetchAnalysesQuiet = useCallback(() => {
    if (!selectedId) return;
    void (async () => {
      const res = await fetch(`/api/defect-files?projectId=${encodeURIComponent(selectedId)}`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setFiles(extractDefectFileListFromProjectQueryBody(body));
    })();
  }, [selectedId]);

  const onDeleteProject = useCallback(async () => {
    if (!selectedId || !project) return;
    setDeleteProjectErr(null);
    if (
      !window.confirm(
        `Delete project "${project.name}"? This removes the project and all defect files on the analysis server. This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleteProjectBusy(true);
    try {
      const res = await fetch(`/api/defect-projects/${encodeURIComponent(selectedId)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteProjectErr(body.error ?? "Could not delete this project.");
        return;
      }
      removeProject(selectedId);
      const live = [...useHistoricalProjectsStore.getState().projects]
        .filter((p) => p.analysisModule === "live")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setSelected(live[0]?.id ?? null);
      void syncLiveProjectsFromApi();
    } finally {
      setDeleteProjectBusy(false);
    }
  }, [selectedId, project, removeProject, setSelected]);

  useEffect(() => {
    if (!selectedId) {
      setFiles([]);
      return;
    }
    let cancelled = false;

    const fetchFiles = (quiet = false) => {
      void (async () => {
        if (!quiet) {
          setFilesLoading(true);
          setFilesErr(null);
        }
        const res = await fetch(`/api/defect-files?projectId=${encodeURIComponent(selectedId)}`, {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          const msg =
            typeof body === "object" && body !== null && "error" in body && typeof (body as { error: unknown }).error === "string"
              ? (body as { error: string }).error
              : "Could not load analyses for this project.";
          setFilesErr(msg);
          setFiles([]);
          if (!quiet) setFilesLoading(false);
          return;
        }
        setFiles(extractDefectFileListFromProjectQueryBody(body));
        if (!quiet) setFilesLoading(false);
      })();
    };

    fetchFiles(false);

    function onVisibility() {
      if (document.visibilityState === "visible") fetchFiles(true);
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [selectedId]);

  const displayName = (f: DefectFileListItem) =>
    f.mergeFileName?.trim() || f.sourceFileName?.trim() || `Analysis ${f.id.slice(0, 8)}…`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Live analysis</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Analyses belong to the project chosen in the sidebar. Each analysis is a Billie defect file (spreadsheet ingest)
            under that project.
          </p>
          {syncBusy && projects.length > 0 ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Refreshing projects…</p>
          ) : null}
        </div>
        {selectedId ? (
          <Link
            href={`${basePath}/${selectedId}/upload`}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--water-2)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 active:brightness-95"
          >
            <Plus className="h-4 w-4" />
            Create analysis
          </Link>
        ) : (
          <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-foreground-muted">
            Select or create a project first
          </span>
        )}
      </div>

      {syncErr ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]"
          role="alert"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">Could not refresh from server</p>
          <p className="mt-1 text-[var(--muted-foreground)]">{syncErr}</p>
        </div>
      ) : null}

      {!selectedId ? (
        <p className="mt-8 rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
          Choose a project from the selector at the top of the sidebar, or create one from the selector menu.
        </p>
      ) : null}

      {selectedId && project ? (
        <div className="mt-8 overflow-hidden rounded-xl bg-[var(--surface)] shadow-[var(--card-shadow)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--foreground)]">{project.name}</p>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {project.location || "—"} · {project.floorLevels || "—"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {deleteProjectErr ? (
                <p className="text-xs text-red-600 dark:text-red-400">{deleteProjectErr}</p>
              ) : null}
              <button
                type="button"
                disabled={deleteProjectBusy}
                onClick={() => void onDeleteProject()}
                className="rounded-lg border border-red-300/80 bg-transparent px-3 py-2 text-sm font-medium text-red-700 outline-none hover:bg-red-500/10 disabled:opacity-50 dark:border-red-800/80 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {deleteProjectBusy ? "Deleting…" : "Delete project"}
              </button>
            </div>
          </div>
          <table className="qm-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60">
                <th className="px-4 py-3">Analysis</th>
                <th className="hidden px-4 py-3 sm:table-cell">Defect file id</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Open</th>
                <th className="w-12 px-2 py-3 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filesLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    Loading analyses…
                  </td>
                </tr>
              ) : filesErr ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    {filesErr}
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    No analyses yet. Start with <strong>Create analysis</strong> to upload an Excel workbook.
                  </td>
                </tr>
              ) : (
                files.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40">
                    <td className="px-4 py-3 font-medium">{displayName(f)}</td>
                    <td className="hidden max-w-[14rem] truncate px-4 py-3 font-mono text-xs text-[var(--muted-foreground)] sm:table-cell">
                      {f.id}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted-foreground)]">{statusLabel(f.isProcessed)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`${basePath}/${selectedId}/defects?defectFile=${encodeURIComponent(f.id)}`}
                        className="qm-badge-open inline-block no-underline hover:opacity-95"
                      >
                        Open
                      </Link>
                    </td>
                    <td className="px-2 py-2 text-right align-middle">
                      <AnalysisRowActionsMenu
                        defectFileId={f.id}
                        analysisLabel={displayName(f)}
                        onDeleted={refetchAnalysesQuiet}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
