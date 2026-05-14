import { extractDocCitationsFromDefectDescription } from "@/lib/pcdi/extract-doc-citations";
import {
  getDefaultResponseStrategyForDefectCategory,
  getSuggestedStrategyTags,
} from "@/lib/pcdi/live-correlation";
import { buildLiveReferencesDocsColumn } from "@/lib/pcdi/live-mock-reference-citations";
import { buildLiveRowsFromUploadSession } from "@/lib/pcdi/live-register-from-upload";
import {
  liveUploadFingerprint,
  readLiveSelectionState,
  writeLiveSelectionState,
} from "@/lib/pcdi/live-selection-session";
import { getDefectTableRowsForModule } from "@/lib/pcdi/mock-data";
import { readBillieMergeSession } from "@/lib/pcdi/billie-merge-session";
import { readUploadPayload } from "@/lib/pcdi/upload-session";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

/** Base rows: Billie merge output if present, else uploaded spreadsheet, else prototype seed (live). */
export function getLiveRegisterBaseRows(
  projectId: string,
  defectFileId?: string | null,
): HistoricalDefectTableRow[] {
  if (typeof window !== "undefined") {
    const billie = readBillieMergeSession(projectId, defectFileId);
    if (billie?.rows?.length) return billie.rows;
  }
  return buildLiveRowsFromUploadSession(projectId) ?? getDefectTableRowsForModule(projectId, "live");
}

export function getLiveUploadFingerprint(projectId: string): string | null {
  const up = readUploadPayload(projectId);
  if (!up?.dataRows?.length) return null;
  return liveUploadFingerprint({
    fileName: up.fileName,
    headerRow: up.headerRow,
    rowCount: up.dataRows.length,
    columnKey: up.columns.join("\0"),
  });
}

/** Stable key for selection session — upload blob, Billie merge rows, or prototype seed. */
export function getLiveSelectionFingerprint(projectId: string, defectFileId?: string | null): string {
  const upload = getLiveUploadFingerprint(projectId) ?? "nofile";
  if (typeof window === "undefined") return `${upload}:nobillie`;
  const b = readBillieMergeSession(projectId, defectFileId);
  const billie =
    b?.rowSignature && b.defectFileId ? `billie:${b.defectFileId}:${b.rowSignature}` : "nobillie";
  return `${upload}:${billie}`;
}

/**
 * Writes the same strategy for every listed row id (sessionStorage — matches live defect register).
 * Use an empty `strategy` to clear overrides (“None Selected”) so the row falls back to AI suggestions.
 */
export function bulkApplyLiveStrategyForRows(
  projectId: string,
  rowIds: string[],
  strategy: string,
  defectFileId?: string | null,
): void {
  const fp = getLiveSelectionFingerprint(projectId, defectFileId);
  const prev = readLiveSelectionState(projectId, defectFileId);
  const selections =
    prev && prev.fingerprint === fp ? { ...prev.selections } : ({} as Record<string, string>);
  for (const id of rowIds) {
    if (!strategy.trim()) delete selections[id];
    else selections[id] = strategy;
  }
  writeLiveSelectionState(
    projectId,
    {
      selections,
      confirmed: false,
      fingerprint: fp,
    },
    defectFileId,
  );
}

/** Fire after mutating selections so the mind graph can refresh breakdown labels. */
export function notifyLiveSelectionsUpdated(projectId: string, defectFileId?: string | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pcdi-live-selections-updated", {
      detail: { projectId, defectFileId: defectFileId ?? null },
    }),
  );
}

/** Effective response strategy: explicit user choice, otherwise top suggested tag for the row. */
export function resolveLiveResponseStrategy(
  row: HistoricalDefectTableRow,
  explicitByRowId: Record<string, string>,
): string {
  const ex = explicitByRowId[row.id]?.trim();
  if (ex) return ex;
  const tags = getSuggestedStrategyTags(row.defectCategory);
  return tags[0] ?? "";
}

export type StrategyBreakdownSegment = { label: string; count: number };

/** Sorted counts per effective strategy label (for chart chips + summaries). */
export function getCategoryStrategyBreakdownSegments(
  rows: HistoricalDefectTableRow[],
  selections: Record<string, string>,
): StrategyBreakdownSegment[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = resolveLiveResponseStrategy(row, selections).trim();
    const label = raw.length > 0 ? raw : "None / default";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** One-line summary for category bubble labels, e.g. `Evidence provided: 40; Referred to engineer: 3`. */
export function formatCategoryStrategyBreakdownSummary(
  rows: HistoricalDefectTableRow[],
  selections: Record<string, string>,
  maxLen = 200,
): string {
  const parts = getCategoryStrategyBreakdownSegments(rows, selections).map(({ label, count }) => {
    const short = label.length > 32 ? `${label.slice(0, 30)}…` : label;
    return `${short}: ${count}`;
  });
  let out = parts.join("; ");
  if (out.length > maxLen) out = `${out.slice(0, Math.max(0, maxLen - 1))}…`;
  return out;
}

/**
 * Mind map strategy chips: only counts rows where the user chose a strategy in session.
 * No inferred defaults — bubbles stay category-only until selections exist.
 */
export function getExplicitStrategyBreakdownSegments(
  rows: HistoricalDefectTableRow[],
  selections: Record<string, string>,
): StrategyBreakdownSegment[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = selections[row.id]?.trim();
    if (!raw) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function formatExplicitStrategyBreakdownSummary(
  rows: HistoricalDefectTableRow[],
  selections: Record<string, string>,
  maxLen = 200,
): string {
  const parts = getExplicitStrategyBreakdownSegments(rows, selections).map(({ label, count }) => {
    const short = label.length > 32 ? `${label.slice(0, 30)}…` : label;
    return `${short}: ${count}`;
  });
  let out = parts.join("; ");
  if (out.length > maxLen) out = `${out.slice(0, Math.max(0, maxLen - 1))}…`;
  return out;
}

/** Applies user-selected response strategies and regenerates reference text from category + strategy (matrix). */
export function getLiveRegisterMergedRows(
  projectId: string,
  defectFileId?: string | null,
): HistoricalDefectTableRow[] {
  const base = getLiveRegisterBaseRows(projectId, defectFileId);
  const sel = readLiveSelectionState(projectId, defectFileId);
  const map = sel?.selections ?? {};
  return base.map((r, i) => {
    const responseCategory = resolveLiveResponseStrategy(r, map);
    const strategyForRefs =
      responseCategory.trim().length > 0
        ? responseCategory
        : getDefaultResponseStrategyForDefectCategory(r.defectCategory);
    const references = buildLiveReferencesDocsColumn({
      projectId,
      rowIndex: i,
      defectCategory: r.defectCategory,
      responseStrategy: strategyForRefs,
      extractedFromDescription: extractDocCitationsFromDefectDescription(r.defectDescription),
    });
    return {
      ...r,
      responseCategory,
      referenceDocuments: references,
      extractedDocCitations: references,
    };
  });
}

export function liveSelectionsComplete(projectId: string, defectFileId?: string | null): boolean {
  const base = getLiveRegisterBaseRows(projectId, defectFileId);
  if (base.length === 0) return false;
  const sel = readLiveSelectionState(projectId, defectFileId)?.selections ?? {};
  return base.every((r) => resolveLiveResponseStrategy(r, sel).trim().length > 0);
}

export function liveExportAndPromptAllowed(projectId: string, defectFileId?: string | null): boolean {
  const sel = readLiveSelectionState(projectId, defectFileId);
  if (!sel?.confirmed) return false;
  return liveSelectionsComplete(projectId, defectFileId);
}
