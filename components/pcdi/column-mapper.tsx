"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mergeHistoricalAiMappingWithColumns,
  readHistoricalAiColumnMapping,
  writeHistoricalAiColumnMapping,
} from "@/lib/pcdi/map-session";
import { extractDefectFileStatusFromPollPayload } from "@/lib/pcdi/defect-file-merge-info";
import {
  rowSignatureFromRows,
  writeBillieMergeSession,
} from "@/lib/pcdi/billie-merge-session";
import { notifyLiveSelectionsUpdated } from "@/lib/pcdi/live-rows";
import type { HistoricalColumnAiMapping, HistoricalDefectTableRow } from "@/lib/pcdi/types";

export type ColumnMapperProps = {
  projectId: string;
  /** When empty, nothing is rendered. */
  columns: string[];
  source?: { fileName: string; headerRow: number };
  continueHref: string;
  continueLabel: string;
  /** Live vs historical: copy only. */
  mode?: "historical" | "live";
  /** From parse / saveExcelContent; sent as `defectFileId` in `POST /api/defect-files/analyze`. */
  defectFileId?: string | null;
  /** If set, called when the user finishes instead of in-app `router.push(continueHref)` (e.g. one-page flow). */
  onFinish?: () => void;
};

function mappingToDefectColumnSelection(m: HistoricalColumnAiMapping, columns: string[]): Set<string> {
  const sel = new Set<string>();
  for (const c of columns) {
    if ((m[c] ?? []).includes("ai_defect_category")) sel.add(c);
  }
  return sel;
}

function writeSelectionToMapping(
  selected: Set<string>,
  columns: string[],
): HistoricalColumnAiMapping {
  const o: HistoricalColumnAiMapping = {};
  for (const c of columns) {
    o[c] = selected.has(c) ? ["ai_defect_category"] : [];
  }
  return o;
}

export function ColumnMapper({
  projectId,
  columns,
  source,
  continueHref,
  continueLabel,
  mode = "historical",
  defectFileId,
  onFinish,
}: ColumnMapperProps) {
  const router = useRouter();

  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** 0–100 from GET …/status while live analysis is polling; `null` before first poll or if API omits progress. */
  const [analyzeProgress, setAnalyzeProgress] = useState<number | null>(null);

  const [selectedDefectColumns, setSelectedDefectColumns] = useState<Set<string>>(() => {
    const m = mergeHistoricalAiMappingWithColumns(columns, readHistoricalAiColumnMapping(projectId));
    return mappingToDefectColumnSelection(m, columns);
  });

  const columnsKey = columns.join("\0");
  useEffect(() => {
    const m = mergeHistoricalAiMappingWithColumns(columns, readHistoricalAiColumnMapping(projectId));
    setSelectedDefectColumns(mappingToDefectColumnSelection(m, columns));
  }, [projectId, columnsKey, columns]);

  const complete = useMemo(
    () => (columns.length > 0 ? selectedDefectColumns.size > 0 : false),
    [columns.length, selectedDefectColumns.size],
  );

  const persistMapping = useCallback(
    (next: Set<string>) => {
      setSelectedDefectColumns(next);
      writeHistoricalAiColumnMapping(projectId, writeSelectionToMapping(next, columns));
    },
    [projectId, columns],
  );

  const toggleColumn = useCallback(
    (column: string) => {
      const next = new Set(selectedDefectColumns);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      persistMapping(next);
    },
    [selectedDefectColumns, persistMapping],
  );

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {source ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          From <span className="font-medium text-[var(--foreground)]">{source.fileName}</span>
          {" · "}
          header row{" "}
          <span className="font-medium text-[var(--foreground)]">{source.headerRow}</span>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid grid-cols-1 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Spreadsheet column</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-foreground-emphasis md:mt-0 md:text-right">
            Use for defect categorisation
          </p>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]" role="list">
          {columns.map((c, i) => {
            const on = selectedDefectColumns.has(c);
            return (
              <li key={`${i}-${c}`} className="grid grid-cols-1 items-center gap-3 px-4 py-3.5 md:grid-cols-[1fr_auto]">
                <span className="min-w-0 text-sm font-medium text-[var(--foreground)]">{c}</span>
                <div className="flex items-center justify-end md:pl-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleColumn(c)}
                    className="size-4 cursor-pointer rounded border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                    aria-label={`Use column ${c} for defect categorisation`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 border-t border-[var(--border-subtle)] pt-6">
        {analyzeBusy && mode === "live" ? (
          <div
            className="w-full space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-3"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-[var(--foreground)]">Analysing defects</span>
              <span className="tabular-nums text-[var(--muted-foreground)]">
                {analyzeProgress != null ? `${analyzeProgress}%` : "Starting…"}
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--border)]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={analyzeProgress ?? undefined}
              aria-label="Analysis progress"
            >
              {analyzeProgress != null ? (
                <div
                  className="h-full rounded-full bg-[color:var(--accent)] transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, analyzeProgress))}%` }}
                />
              ) : (
                <div className="h-full w-full animate-pulse rounded-full bg-[color:var(--accent)]/35" />
              )}
            </div>
          </div>
        ) : null}
        {analyzeError ? (
          <p className="max-w-full text-right text-sm text-red-600 dark:text-red-400" role="alert">
            {analyzeError}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!complete || analyzeBusy}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
            onClick={async () => {
            setAnalyzeError(null);
            const headersToMerge = columns.filter((c) => selectedDefectColumns.has(c));
            const id = defectFileId?.trim();
            if (!id) {
              setAnalyzeError(
                "Missing defect file id from the analysis server. Re-upload and parse the spreadsheet, or ensure saveExcelContent returns a defect file id.",
              );
              return;
            }
            setAnalyzeBusy(true);
            setAnalyzeProgress(null);
            try {
              const res = await fetch("/api/defect-files/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  defectFileId: id,
                  headersToMerge,
                }),
              });
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              if (!res.ok) {
                setAnalyzeError(body.error ?? `Analysis request failed (${res.status}).`);
                return;
              }

              if (mode !== "live") {
                if (onFinish) onFinish();
                else router.push(continueHref);
                return;
              }

              const maxAttempts = 200;
              const delayMs = 3000;
              let mergeFileUrl: string | null = null;
              let mergeFileName: string | undefined;

              setAnalyzeProgress(0);

              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const st = await fetch(`/api/defect-files/${encodeURIComponent(id)}/status`, {
                  cache: "no-store",
                });
                const sj = (await st.json().catch(() => ({}))) as { error?: string };
                if (!st.ok) {
                  setAnalyzeError(sj.error ?? `Status check failed (${st.status}).`);
                  return;
                }
                const polled = extractDefectFileStatusFromPollPayload(sj);
                if (polled.progressPercentage != null) {
                  setAnalyzeProgress(polled.progressPercentage);
                }
                const proc = polled.isProcessed?.toUpperCase() ?? "";
                if (proc === "SUCCESS" && polled.mergeFileUrl) {
                  mergeFileUrl = polled.mergeFileUrl;
                  mergeFileName = polled.mergeFileName;
                  setAnalyzeProgress(100);
                  break;
                }
                if (
                  proc === "FAILED" ||
                  proc === "ERROR" ||
                  proc === "FAILURE" ||
                  proc === "FAIL"
                ) {
                  setAnalyzeError("Defect analysis failed on the server.");
                  return;
                }
                await new Promise((r) => setTimeout(r, delayMs));
              }

              if (!mergeFileUrl) {
                setAnalyzeError("Analysis is taking longer than expected. Try again later.");
                return;
              }

              const parseRes = await fetch("/api/defect-files/parse-merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, mergeFileUrl }),
              });
              const pj = (await parseRes.json().catch(() => ({}))) as {
                error?: string;
                rows?: HistoricalDefectTableRow[];
              };
              if (!parseRes.ok || !pj.rows?.length) {
                setAnalyzeError(pj.error ?? "Could not parse the merged spreadsheet.");
                return;
              }

              writeBillieMergeSession({
                projectId,
                defectFileId: id,
                mergeFileUrl,
                mergeFileName,
                rows: pj.rows,
                rowSignature: rowSignatureFromRows(pj.rows),
                updatedAt: new Date().toISOString(),
              });
              if (mode === "live") notifyLiveSelectionsUpdated(projectId, id);
              else notifyLiveSelectionsUpdated(projectId);

              if (onFinish) onFinish();
              else router.push(continueHref);
            } catch {
              setAnalyzeError("Could not reach the server. Check your network and try again.");
            } finally {
              setAnalyzeBusy(false);
              setAnalyzeProgress(null);
            }
          }}
          >
            {analyzeBusy
              ? mode === "live"
                ? "Analysing defects…"
                : "Starting analysis…"
              : continueLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
