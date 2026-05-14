"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { ConnectivityMindGraphD3 } from "@/components/pcdi/connectivity-mind-graph-d3";
import {
  hydrateBillieSessionFromDefectFile,
  hydrateBillieSessionFromProjectDefectFilesQuery,
} from "@/lib/pcdi/hydrate-billie-session-from-defect-file";
import { readBillieMergeSession, type BillieMergeSessionPayload } from "@/lib/pcdi/billie-merge-session";
import type { HistoricalProject } from "@/lib/pcdi/types";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";

function formatAnalysisTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
  } catch {
    return iso;
  }
}

function useBillieMergeSession(projectId: string, defectFileId: string | null): BillieMergeSessionPayload | null {
  const [session, setSession] = useState<BillieMergeSessionPayload | null>(null);
  useEffect(() => {
    function refresh() {
      setSession(readBillieMergeSession(projectId, defectFileId));
    }
    refresh();
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent<{ projectId?: string; defectFileId?: string | null }>).detail;
      if (d?.projectId !== projectId) return;
      const scope = defectFileId?.trim() ?? null;
      const incoming = d.defectFileId ?? null;
      if (scope && incoming != null && incoming !== scope) return;
      refresh();
    };
    window.addEventListener("pcdi-live-selections-updated", onUpdate);
    return () => window.removeEventListener("pcdi-live-selections-updated", onUpdate);
  }, [projectId, defectFileId]);
  return session;
}

/** Bubble legend typography: claystone / weathered-rock */
const CAPTION_STRONG = "#4A3F32";
const CAPTION_MUTED = "#6B5E4E";

function LiveVisualisationInner({
  projectId,
  basePath,
  defectFileFromQuery = null,
}: {
  projectId: string;
  basePath: string;
  /** When set, load this Billie defect file (one analysis) instead of the project’s default resolution. */
  defectFileFromQuery?: string | null;
}) {
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const upsertProject = useHistoricalProjectsStore((s) => s.upsertProject);
  const [scopeDefectFileId, setScopeDefectFileId] = useState<string | null>(() =>
    defectFileFromQuery?.trim() ? defectFileFromQuery.trim() : null,
  );
  const billie = useBillieMergeSession(projectId, scopeDefectFileId);
  const [remoteSynced, setRemoteSynced] = useState(false);
  const [defectFileHydrate, setDefectFileHydrate] = useState<{
    loading: boolean;
    error: string | null;
  }>({ loading: false, error: null });

  useEffect(() => {
    setScopeDefectFileId(defectFileFromQuery?.trim() ? defectFileFromQuery.trim() : null);
  }, [defectFileFromQuery, projectId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const detailRes = await fetch(`/api/defect-projects/${encodeURIComponent(projectId)}`, {
          cache: "no-store",
        });
        const detailBody = (await detailRes.json().catch(() => ({}))) as {
          project?: HistoricalProject | null;
        };
        if (!cancelled && detailRes.ok && detailBody.project && detailBody.project.id === projectId) {
          upsertProject(detailBody.project);
        }

        const res = await fetch("/api/defect-projects", { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as {
          projects?: HistoricalProject[];
        };
        if (!cancelled && res.ok && Array.isArray(body.projects)) {
          const match = body.projects.find((p) => p.id === projectId);
          if (match) upsertProject(match);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setRemoteSynced(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, upsertProject]);

  useEffect(() => {
    if (!remoteSynced) return;

    let cancelled = false;

    void (async () => {
      const p = useHistoricalProjectsStore.getState().projects.find((x) => x.id === projectId);
      if (!p || p.analysisModule !== "live") {
        if (!cancelled) setDefectFileHydrate({ loading: false, error: null });
        return;
      }

      if (!cancelled) setDefectFileHydrate({ loading: true, error: null });

      const queryFid = defectFileFromQuery?.trim();
      if (queryFid) {
        const byId = await hydrateBillieSessionFromDefectFile(projectId, queryFid);
        if (cancelled) return;
        if (byId.ok) {
          setScopeDefectFileId(queryFid);
          if (!cancelled) setDefectFileHydrate({ loading: false, error: null });
          return;
        }
        if (!cancelled) setDefectFileHydrate({ loading: false, error: byId.error });
        return;
      }

      /** Same browser session: prefer the defect file we last loaded so home → Open does not replace it with another file on the project. */
      const persisted = readBillieMergeSession(projectId);
      const preferredFid = persisted?.defectFileId?.trim();
      if (preferredFid && !preferredFid.startsWith("project:")) {
        const reused = await hydrateBillieSessionFromDefectFile(projectId, preferredFid);
        if (cancelled) return;
        if (reused.ok) {
          setScopeDefectFileId(preferredFid);
          if (!cancelled) setDefectFileHydrate({ loading: false, error: null });
          return;
        }
      }

      const byProject = await hydrateBillieSessionFromProjectDefectFilesQuery(projectId);
      if (cancelled) return;
      if (byProject.ok) {
        const leg = readBillieMergeSession(projectId);
        const resolved = leg?.defectFileId?.trim();
        if (resolved && !resolved.startsWith("project:")) {
          setScopeDefectFileId(resolved);
        }
        if (!cancelled) setDefectFileHydrate({ loading: false, error: null });
        return;
      }

      const defectFileId = p.defectFileId?.trim();
      if (defectFileId) {
        const byId = await hydrateBillieSessionFromDefectFile(projectId, defectFileId);
        if (cancelled) return;
        if (byId.ok) {
          setScopeDefectFileId(defectFileId);
          if (!cancelled) setDefectFileHydrate({ loading: false, error: null });
          return;
        }
        if (!cancelled) {
          setDefectFileHydrate({
            loading: false,
            error: [byProject.error, byId.error].filter(Boolean).join(" · "),
          });
        }
        return;
      }

      if (!cancelled) setDefectFileHydrate({ loading: false, error: byProject.error });
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, remoteSynced, defectFileFromQuery]);

  if (!project && !remoteSynced) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[var(--muted-foreground)]">
        <p>Loading project from analysis server…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found. Open it from the live analysis list, or check that the analysis server returned this id.</p>
        <Link href={basePath} className="mt-2 inline-block font-medium text-link underline">
          Back to analyses
        </Link>
      </div>
    );
  }

  if (project.analysisModule !== "live") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        This visualisation is for live analysis projects only.
      </div>
    );
  }

  const backHref = basePath;
  const scopeLabel = scopeDefectFileId ? scopeDefectFileId.slice(0, 8) : null;

  return (
    <div className="fixed inset-0 left-0 top-0 z-[300] flex h-[100dvh] w-screen max-w-none flex-col bg-white">
      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(22rem,calc(100vw-1.5rem))]">
          <div className="pointer-events-auto rounded-lg border border-[rgba(107,142,160,0.2)] bg-white/92 px-3 py-2.5 shadow-md backdrop-blur-sm">
            <Link
              href={backHref}
              className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold outline-none ring-[var(--ring)] transition hover:opacity-90 focus-visible:ring-2"
              style={{ color: CAPTION_STRONG }}
            >
              <ArrowLeft className="h-5 w-5 shrink-0" style={{ color: CAPTION_MUTED }} aria-hidden />
              <span className="hidden sm:inline">Analyses</span>
            </Link>
            <p className="mt-1 truncate text-xs font-medium" style={{ color: CAPTION_STRONG }}>
              Live analysis
              <span className="font-normal" style={{ color: CAPTION_MUTED }}>
                {" "}
                · {project.name}
              </span>
            </p>
            {scopeLabel ? (
              <p className="mt-0.5 truncate text-[10px] font-mono" style={{ color: CAPTION_MUTED }} title={scopeDefectFileId ?? ""}>
                Defect file · {scopeLabel}…
              </p>
            ) : null}
            {defectFileHydrate.loading ? (
              <p className="mt-1 truncate text-[11px] md:text-xs" style={{ color: CAPTION_MUTED }}>
                Loading defect data from analysis server…
              </p>
            ) : defectFileHydrate.error ? (
              <p
                className="mt-1 truncate text-[11px] text-amber-800 md:text-xs dark:text-amber-200/90"
                title={defectFileHydrate.error}
              >
                Could not load defect data
                {scopeLabel ? ` (${scopeLabel}…)` : project.defectFileId ? ` (${project.defectFileId.slice(0, 8)}…)` : ""} —{" "}
                {defectFileHydrate.error}
              </p>
            ) : billie?.rows?.length ? (
              <p className="mt-1 truncate text-[11px] md:text-xs" style={{ color: CAPTION_MUTED }} title={billie.mergeFileName}>
                <span className="font-medium" style={{ color: CAPTION_STRONG }}>
                  Loaded
                </span>
                <span> · </span>
                {formatAnalysisTimestamp(billie.updatedAt)}
                <span> · </span>
                {billie.rows.length} defect{billie.rows.length === 1 ? "" : "s"}
                {billie.mergeFileName ? (
                  <>
                    <span> · </span>
                    <span>{billie.mergeFileName}</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 truncate text-[11px] text-amber-800/95 md:text-xs dark:text-amber-200/85">
                {project.defectFileId
                  ? "No rows loaded yet — graph uses upload or demo data until the defect file can be parsed."
                  : "No merged analysis yet — graph uses your upload or demo data. Run Analyse Defects after mapping columns to load the latest Billie merge file."}
              </p>
            )}
          </div>
        </div>

        <ConnectivityMindGraphD3 projectId={projectId} defectFileId={scopeDefectFileId} />
      </div>
    </div>
  );
}

export function LiveDataVisualisationDraft({
  projectId,
  basePath = "/live",
  defectFileFromQuery = null,
}: {
  projectId: string;
  basePath?: string;
  defectFileFromQuery?: string | null;
}) {
  /** Render in-tree (no portal) so SSR/client hydration stay aligned with the route. */
  return (
    <LiveVisualisationInner
      projectId={projectId}
      basePath={basePath}
      defectFileFromQuery={defectFileFromQuery}
    />
  );
}
