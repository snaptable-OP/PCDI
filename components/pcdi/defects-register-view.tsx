"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { Download, FileText } from "lucide-react";
import { DefectsAnalysisProgress } from "@/components/pcdi/defects-analysis-progress";
import { EnrichedDefectsTable } from "@/components/pcdi/enriched-defects-table";
import { LiveDefectAnalysisRegister } from "@/components/pcdi/live-defect-analysis-register";
import {
  defectRegisterRowsToEnriched,
  downloadDefectRegisterXlsx,
} from "@/lib/pcdi/defect-register-export";
import { getDefectTableRowsForModule } from "@/lib/pcdi/mock-data";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule } from "@/lib/pcdi/types";

export type DefectsRegisterViewProps = {
  projectId: string;
  module: AnalysisModule;
  basePath: string;
};

export function DefectsRegisterView({ projectId, module, basePath }: DefectsRegisterViewProps) {
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const rows = useMemo(
    () => getDefectTableRowsForModule(projectId, module),
    [projectId, module],
  );

  const enrichedDisplay = useMemo(() => defectRegisterRowsToEnriched(rows), [rows]);

  const onExport = useCallback(() => {
    const base = project?.name?.trim() || `project-${projectId}`;
    downloadDefectRegisterXlsx(rows, base);
  }, [rows, project?.name, projectId]);

  const wrongModule =
    project && project.analysisModule !== module ? (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>
          This project belongs to{" "}
          <strong>{project.analysisModule === "historical" ? "Historical" : "Live"}</strong> analysis.
        </p>
        <Link
          href={project.analysisModule === "historical" ? "/historical" : "/live"}
          className="mt-2 inline-block font-medium text-teal-700 underline hover:underline dark:text-teal-300"
        >
          Open the correct project list
        </Link>
      </div>
    ) : null;

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found. It may have been removed from this browser.</p>
        <Link
          href={basePath}
          className="mt-2 inline-block font-medium text-teal-700 underline hover:underline dark:text-teal-300"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  if (wrongModule) return wrongModule;

  const isHistorical = module === "historical";

  if (!isHistorical) {
    return (
      <>
        <DefectsAnalysisProgress key={projectId} />
        <LiveDefectAnalysisRegister projectId={projectId} project={project} basePath={basePath} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <DefectsAnalysisProgress key={projectId} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{project.name}</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {isHistorical ? (
              <>
                Historical defect register — {rows.length} row{rows.length === 1 ? "" : "s"} · use Discover
                Categories to align with the knowledge map (prototype/mock data).
              </>
            ) : (
              <>
                Live defect list — {rows.length} row{rows.length === 1 ? "" : "s"}. Response and strategy fields
                are not filled yet; they are what you want AI to suggest. Export and master prompt support your
                workflow.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${basePath}/${projectId}/setup`}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Project setup
          </Link>
          {isHistorical ? (
            <Link
              href={`${basePath}/${projectId}/discovery`}
              className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
            >
              Discover Categories
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={onExport}
                disabled={rows.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Export .xlsx
              </button>
              <Link
                href={`${basePath}/${projectId}/prompt`}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                See prompt
              </Link>
            </>
          )}
        </div>
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        {isHistorical ? (
          <>
            Response categories use colour tags for scanning. This module focuses on historical data and
            knowledge-map alignment.
          </>
        ) : (
          <>
            Contractor response / strategy columns show as empty until AI suggests options — export includes the
            same table layout for handoff.
          </>
        )}
      </p>

      <EnrichedDefectsTable rows={enrichedDisplay} variant={isHistorical ? "historical" : "live"} />
    </div>
  );
}
