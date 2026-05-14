"use client";

import Link from "next/link";
import { Files, FolderKanban, ListChecks, Plus, Sparkles, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateLiveProjectDialog } from "@/components/pcdi/create-live-project-dialog";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import { useLiveProjectListSync } from "@/lib/pcdi/use-live-project-list-sync";

const CREATE_PROJECT_BTN_CLASS =
  "inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--water-2)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 active:brightness-95 sm:w-auto";

type StatsPayload = {
  ok: boolean;
  stats?: {
    projectsTotal: number;
    analysesTotal: number;
    defectItemsAnalysed: number;
    responsesGenerated: number;
  };
  meta?: {
    capped?: boolean;
    skipped?: boolean;
    detailFetches?: number;
    defectFilesListed?: number;
  };
  error?: string;
};

function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function MiniRing({
  pct,
  color,
  trackColor,
}: {
  pct: number;
  color: string;
  trackColor: string;
}) {
  const p = Math.min(100, Math.max(0, pct));
  const dash = `${p} ${100 - p}`;
  return (
    <svg className="size-14 shrink-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r="15.5" fill="none" stroke={trackColor} strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r="15.5"
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeDasharray={dash}
        strokeLinecap="round"
        pathLength={100}
      />
    </svg>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  ringPct,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint?: string;
  accent: { ring: string; track: string };
  ringPct: number;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      style={{ boxShadow: `inset 0 1px 0 0 ${accent.track}` }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full opacity-[0.12]"
        style={{ background: accent.ring }}
      />
      <div className="relative flex items-start gap-3">
        <MiniRing pct={ringPct} color={accent.ring} trackColor={accent.track} />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
            {formatBig(value)}
          </p>
          {hint ? <p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p> : null}
        </div>
        <Icon className="size-5 shrink-0 opacity-40" style={{ color: accent.ring }} aria-hidden />
      </div>
    </div>
  );
}

export type HomeOverviewStatsProps = {
  /** Same dialog as sidebar “New project…” (metadata form). Preferred over `createProjectHref`. */
  embedCreateProjectDialog?: boolean;
  /** Alternative: navigate to this path instead of opening the dialog. */
  createProjectHref?: string;
};

export function HomeOverviewStats({
  embedCreateProjectDialog = false,
  createProjectHref,
}: HomeOverviewStatsProps = {}) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const showCreateControl = embedCreateProjectDialog || Boolean(createProjectHref?.trim());

  const { liveSyncError } = useLiveProjectListSync(showCreateControl);

  const historicalCount = useHistoricalProjectsStore(
    (s) => s.projects.filter((p) => p.analysisModule === "historical").length,
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/live-overview-stats", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as StatsPayload;
        if (!res.ok && !json.error) {
          if (!cancelled) setData({ ok: false, error: `Overview request failed (${res.status}).` });
        } else if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ok: false, error: "Could not load overview statistics." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = data?.stats;
  const projectsTotal = (stats?.projectsTotal ?? 0) + historicalCount;
  const analysesTotal = stats?.analysesTotal ?? 0;
  const defectItems = stats?.defectItemsAnalysed ?? 0;
  const responses = stats?.responsesGenerated ?? 0;

  const maxVal = useMemo(
    () => Math.max(projectsTotal, analysesTotal, defectItems, responses, 1),
    [projectsTotal, analysesTotal, defectItems, responses],
  );

  const ring = (v: number) => Math.round((v / maxVal) * 100);

  const accents = useMemo(
    () => ({
      projects: {
        ring: "rgb(59 130 246)",
        track: "rgb(191 219 254)",
      },
      analyses: {
        ring: "rgb(13 148 136)",
        track: "rgb(153 246 228)",
      },
      defects: {
        ring: "rgb(245 158 11)",
        track: "rgb(253 230 138)",
      },
      responses: {
        ring: "rgb(139 92 246)",
        track: "rgb(221 214 254)",
      },
    }),
    [],
  );

  if (loading) {
    return (
      <section className="mx-auto mb-8 w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--surface-muted)]/60 p-6 shadow-[var(--card-shadow)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-6 w-48 animate-pulse rounded-md bg-[var(--surface-muted)]" />
          {showCreateControl ? (
            <div className="h-10 w-36 animate-pulse rounded-lg bg-[var(--surface-muted)] sm:ml-auto" />
          ) : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]/80" />
          ))}
        </div>
      </section>
    );
  }

  const err = !data?.ok && data?.error;
  const skipped = data?.meta?.skipped;
  const capped = data?.meta?.capped;

  return (
    <>
    <section className="mx-auto mb-8 w-full max-w-5xl rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[color-mix(in_srgb,var(--surface-muted)_65%,transparent)] p-5 shadow-[var(--card-shadow)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Platform overview</h2>
          <p className="mt-1 max-w-prose text-sm text-[var(--muted-foreground)]">
            Live totals from the analysis server; projects include historical workspaces saved in this browser.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          {embedCreateProjectDialog ? (
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className={CREATE_PROJECT_BTN_CLASS}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create project
            </button>
          ) : createProjectHref ? (
            <Link href={createProjectHref} className={CREATE_PROJECT_BTN_CLASS}>
              <Plus className="h-4 w-4" aria-hidden />
              Create project
            </Link>
          ) : null}
          {err ? (
            <p className="text-right text-sm text-amber-800 dark:text-amber-200">{err}</p>
          ) : skipped ? (
            <p className="text-right text-xs text-[var(--muted-foreground)]">Backend handoff off — counts unavailable.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatBlock
          icon={FolderKanban}
          label="Projects"
          value={projectsTotal}
          hint={
            historicalCount > 0
              ? `${stats?.projectsTotal?.toLocaleString() ?? "0"} live on server · ${historicalCount} historical here`
              : "Live defect projects on the analysis server"
          }
          accent={accents.projects}
          ringPct={ring(projectsTotal)}
        />
        <StatBlock
          icon={Files}
          label="Analyses"
          value={analysesTotal}
          hint="Spreadsheet ingests (defect files) across projects"
          accent={accents.analyses}
          ringPct={ring(analysesTotal)}
        />
        <StatBlock
          icon={ListChecks}
          label="Defect items"
          value={defectItems}
          hint={
            capped
              ? `Approximate — capped at ${data?.meta?.detailFetches ?? "?"} detail lookups`
              : "Rows counted from completed analysis payloads"
          }
          accent={accents.defects}
          ringPct={ring(defectItems)}
        />
        <StatBlock
          icon={Sparkles}
          label="Responses"
          value={responses}
          hint="Rows with AI strategies or filled response fields"
          accent={accents.responses}
          ringPct={ring(responses)}
        />
      </div>

      {showCreateControl && liveSyncError ? (
        <div
          className="mt-6 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]"
          role="alert"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">Could not refresh from server</p>
          <p className="mt-1 text-[var(--muted-foreground)]">{liveSyncError}</p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Showing saved projects from this browser until the next successful sync.
          </p>
        </div>
      ) : null}
    </section>
    {embedCreateProjectDialog ? (
      <CreateLiveProjectDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
    ) : null}
    </>
  );
}
