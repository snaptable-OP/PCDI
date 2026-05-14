"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMemo } from "react";
import { liveProjectPrimaryHref } from "@/lib/pcdi/live-project-ingest-status";
import { useLiveProjectListSync } from "@/lib/pcdi/use-live-project-list-sync";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule, HistoricalProject } from "@/lib/pcdi/types";

function formatAssetType(t: HistoricalProject["assetType"]): string {
  return t === "residential" ? "Residential" : "Commercial";
}

function formatStructural(t: HistoricalProject["structuralType"]): string {
  const map: Record<HistoricalProject["structuralType"], string> = {
    steel: "Steel",
    concrete: "Concrete",
    timber: "Timber",
    masonry: "Masonry",
    mixed: "Mixed",
  };
  return map[t];
}

/** Opens the parsed-data mind map (`/defects`); the page hydrates defect rows from the analysis server. */
function LiveProjectNameLink({
  basePath,
  project,
  className,
  children,
}: {
  basePath: string;
  project: HistoricalProject;
  className: string;
  children: React.ReactNode;
}) {
  const href = liveProjectPrimaryHref(basePath, project);
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export type AnalysisProjectsViewProps = {
  module: AnalysisModule;
  /** Route prefix e.g. `/historical` or `/live` */
  basePath: string;
  title: string;
  /** Optional; omitted or empty = no subheading under the title. */
  description?: string;
  /** When true, hide the project table (e.g. home shows stats + Create project only). */
  hideProjectTable?: boolean;
};

export function AnalysisProjectsView({
  module,
  basePath,
  title,
  description = "",
  hideProjectTable = false,
}: AnalysisProjectsViewProps) {
  const projects = useHistoricalProjectsStore((s) => s.projects);

  const { liveSyncLoading, liveSyncError } = useLiveProjectListSync(module === "live");

  const filtered = useMemo(() => {
    const list = projects.filter((p) => p.analysisModule === module);
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [projects, module]);

  const desc = description.trim();
  const titleTrim = title.trim();
  const showHeadingColumn =
    Boolean(titleTrim) ||
    Boolean(desc) ||
    (module === "live" && !hideProjectTable && liveSyncLoading && filtered.length > 0);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div
        className={
          showHeadingColumn
            ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            : "flex w-full justify-end"
        }
      >
        {showHeadingColumn ? (
          <div>
            {titleTrim ? <h1 className="text-2xl font-semibold">{titleTrim}</h1> : null}
            {desc ? <p className="mt-1 text-[var(--muted-foreground)]">{desc}</p> : null}
            {module === "live" && !hideProjectTable && liveSyncLoading && filtered.length > 0 ? (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">Refreshing project list…</p>
            ) : null}
          </div>
        ) : null}
        <Link
          href={`${basePath}/new`}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[color:var(--water-2)] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 active:brightness-95"
        >
          <Plus className="h-4 w-4" />
          Create project
        </Link>
      </div>

      {module === "live" && liveSyncError ? (
        <div
          className="mt-4 rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]"
          role="alert"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">Could not refresh from server</p>
          <p className="mt-1 text-[var(--muted-foreground)]">{liveSyncError}</p>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Showing saved projects from this browser until the next successful sync.
          </p>
        </div>
      ) : null}

      {hideProjectTable ? null : (
      <div className="mt-8 overflow-hidden rounded-xl bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <table className="qm-table w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60">
              <th className="px-4 py-3">Project</th>
              <th className="hidden px-4 py-3 sm:table-cell">Asset</th>
              <th className="hidden px-4 py-3 sm:table-cell">Location</th>
              <th className="hidden px-4 py-3 lg:table-cell">Structural</th>
              <th className="hidden px-4 py-3 sm:table-cell">Floor levels</th>
              <th className="px-4 py-3 text-right text-xs sm:text-sm">Analysis</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {module === "live" && liveSyncLoading && filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  Loading projects from the analysis server…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No projects yet. Create one to begin.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40"
                >
                  <td className="px-4 py-3">
                    {module === "live" ? (
                      <LiveProjectNameLink
                        basePath={basePath}
                        project={p}
                        className="font-medium text-link underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </LiveProjectNameLink>
                    ) : (
                      <Link
                        href={`${basePath}/${p.id}/upload`}
                        className="font-medium text-link underline-offset-2 hover:underline"
                      >
                        {p.name}
                      </Link>
                    )}
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)] md:hidden">
                      {formatAssetType(p.assetType)} · {p.location || "—"} · {p.floorLevels || "—"}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] sm:table-cell">
                    {formatAssetType(p.assetType)}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] sm:table-cell">
                    {p.location || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] lg:table-cell">
                    {formatStructural(p.structuralType)}
                  </td>
                  <td className="hidden max-w-[10rem] px-4 py-3 text-[var(--muted-foreground)] sm:table-cell">
                    {p.floorLevels || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={
                        module === "live"
                          ? liveProjectPrimaryHref(basePath, p)
                          : `${basePath}/${p.id}/defects`
                      }
                      className="qm-badge-open inline-block no-underline hover:opacity-95"
                    >
                      Open
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted-foreground)]">
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
