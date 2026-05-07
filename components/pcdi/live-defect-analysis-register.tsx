"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import { downloadDefectRegisterXlsx } from "@/lib/pcdi/defect-register-export";
import { LiveExcelRowModal } from "@/components/pcdi/live-excel-row-modal";
import { LivePivotSummary } from "@/components/pcdi/live-pivot-summary";
import { LiveStrategyTagPicker } from "@/components/pcdi/live-strategy-tag-picker";
import {
  getLiveRegisterBaseRows,
  getLiveRegisterMergedRows,
  getLiveSelectionFingerprint,
  notifyLiveSelectionsUpdated,
} from "@/lib/pcdi/live-rows";
import { clearHistoricalAiColumnMappingSession } from "@/lib/pcdi/map-session";
import { clearBillieMergeSession } from "@/lib/pcdi/billie-merge-session";
import {
  clearLiveSelectionState,
  readLiveSelectionState,
  writeLiveSelectionState,
  type LiveSelectionState,
} from "@/lib/pcdi/live-selection-session";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import { clearUploadPayload } from "@/lib/pcdi/upload-session";
import type { HistoricalProject } from "@/lib/pcdi/types";

function initialSelectionState(fpKey: string, prev: LiveSelectionState | null): LiveSelectionState {
  if (!prev || prev.fingerprint !== fpKey) {
    return { selections: {}, confirmed: false, fingerprint: fpKey };
  }
  return prev;
}

export type LiveDefectAnalysisRegisterProps = {
  projectId: string;
  project: HistoricalProject;
  basePath: string;
};

export function LiveDefectAnalysisRegister({ projectId, project, basePath }: LiveDefectAnalysisRegisterProps) {
  const router = useRouter();
  const removeProject = useHistoricalProjectsStore((s) => s.removeProject);
  const fingerprint = useMemo(() => getLiveSelectionFingerprint(projectId), [projectId]);

  const rows = useMemo(() => getLiveRegisterBaseRows(projectId), [projectId]);

  const [selections, setSelections] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [excelRowId, setExcelRowId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readLiveSelectionState(projectId);
    const init = initialSelectionState(fingerprint, stored);
    setSelections(init.selections);
    setConfirmed(init.confirmed);
  }, [projectId, fingerprint]);

  const persist = useCallback(
    (nextSel: Record<string, string>, nextConfirmed: boolean) => {
      writeLiveSelectionState(projectId, {
        selections: nextSel,
        confirmed: nextConfirmed,
        fingerprint,
      });
      notifyLiveSelectionsUpdated(projectId);
    },
    [projectId, fingerprint],
  );

  const onPickStrategy = useCallback(
    (rowId: string, value: string) => {
      setConfirmed(false);
      setSelections((prev) => {
        const next = { ...prev, [rowId]: value };
        persist(next, false);
        return next;
      });
    },
    [persist],
  );

  const allRowsResolvable = rows.length > 0;

  const onConfirm = useCallback(() => {
    if (!allRowsResolvable) return;
    setConfirmed(true);
    persist(selections, true);
  }, [allRowsResolvable, persist, selections]);

  const canExportPrompt = allRowsResolvable && confirmed;

  const onExport = useCallback(() => {
    if (!canExportPrompt) return;
    const merged = getLiveRegisterMergedRows(projectId);
    const base = project?.name?.trim() || `project-${projectId}`;
    downloadDefectRegisterXlsx(merged, base);
  }, [canExportPrompt, project?.name, projectId]);

  const onDeleteProject = useCallback(() => {
    if (
      !window.confirm(
        "Delete this project? Upload data and selections stored in this browser for this project will be removed.",
      )
    ) {
      return;
    }
    clearUploadPayload(projectId);
    clearBillieMergeSession(projectId);
    clearHistoricalAiColumnMappingSession(projectId);
    clearLiveSelectionState(projectId);
    removeProject(projectId);
    router.push(basePath);
  }, [basePath, projectId, removeProject, router]);

  const statusHint = confirmed
    ? "Selections confirmed — export and prompt are enabled."
    : "Review tags (top suggestion is highlighted by default), adjust if needed, then confirm.";

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{project.name}</h1>
        </div>
        <div className="flex min-w-0 shrink-0 flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onExport}
            disabled={!canExportPrompt || rows.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Export .xlsx
          </button>
          {canExportPrompt ? (
            <Link
              href={`${basePath}/${projectId}/prompt`}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              See prompt
            </Link>
          ) : (
            <span
              className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] opacity-60"
              title="Confirm selections below first"
            >
              <FileText className="h-4 w-4 shrink-0" aria-hidden />
              See prompt
            </span>
          )}
          <button
            type="button"
            onClick={onDeleteProject}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-500/15 dark:text-red-200 dark:hover:bg-red-500/20"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            Delete project
          </button>
        </div>
      </div>

      <LivePivotSummary
        baseRows={rows}
        selections={selections}
        bulkConfirmed={confirmed}
        projectId={projectId}
        basePath={basePath}
      />

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          No register rows for this project yet. Use{" "}
          <Link href="/live/new" className="font-medium text-link hover:underline">
            New project setup
          </Link>{" "}
          to upload a file, map columns, and run analysis.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted-foreground)]">{statusHint}</p>
            <button
              type="button"
              disabled={!allRowsResolvable}
              onClick={onConfirm}
              className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm response strategy selection
            </button>
          </div>

          <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70">
                  <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Defect description</th>
                  <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Defect category</th>
                  <th className="min-w-[260px] px-3 py-2.5 font-semibold text-[var(--foreground)]">
                    Response strategy
                  </th>
                  <th className="max-w-[14rem] px-3 py-2.5 font-semibold text-[var(--foreground)]">
                    References / Docs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="max-w-[min(28rem,40vw)] px-3 py-2.5 text-[var(--foreground)]">
                      <button
                        type="button"
                        onClick={() => setExcelRowId(row.id)}
                        className="w-full text-left hover:underline"
                      >
                        <span className="line-clamp-4 whitespace-pre-wrap text-foreground-emphasis">
                          {row.defectDescription || "—"}
                        </span>
                      </button>
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-[var(--foreground)]">
                      <span className="line-clamp-3 font-medium" title={row.defectCategory}>
                        {row.defectCategory || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <LiveStrategyTagPicker
                        row={row}
                        selections={selections}
                        confirmed={confirmed}
                        onPick={onPickStrategy}
                      />
                    </td>
                    <td className="max-w-[14rem] px-3 py-2.5 text-[var(--foreground)]">
                      <span
                        className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted-foreground)]"
                        title={row.extractedDocCitations?.trim() || undefined}
                      >
                        {row.extractedDocCitations?.trim() ? row.extractedDocCitations : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <LiveExcelRowModal
        projectId={projectId}
        registerRowId={excelRowId}
        open={excelRowId !== null}
        onClose={() => setExcelRowId(null)}
      />
    </div>
  );
}
