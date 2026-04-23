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
} from "@/lib/pcdi/live-selection-session";
import { getDefectTableRowsForModule } from "@/lib/pcdi/mock-data";
import { readUploadPayload } from "@/lib/pcdi/upload-session";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

/** Base rows: uploaded spreadsheet if available, otherwise prototype seed (cleared for live). */
export function getLiveRegisterBaseRows(projectId: string): HistoricalDefectTableRow[] {
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

/** Stable key for selection session — upload blob or fallback when using prototype seed rows. */
export function getLiveSelectionFingerprint(projectId: string): string {
  return getLiveUploadFingerprint(projectId) ?? "nofile";
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

/** Applies user-selected response strategies and regenerates reference text from category + strategy (matrix). */
export function getLiveRegisterMergedRows(projectId: string): HistoricalDefectTableRow[] {
  const base = getLiveRegisterBaseRows(projectId);
  const sel = readLiveSelectionState(projectId);
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

export function liveSelectionsComplete(projectId: string): boolean {
  const base = getLiveRegisterBaseRows(projectId);
  if (base.length === 0) return false;
  const sel = readLiveSelectionState(projectId)?.selections ?? {};
  return base.every((r) => resolveLiveResponseStrategy(r, sel).trim().length > 0);
}

export function liveExportAndPromptAllowed(projectId: string): boolean {
  const sel = readLiveSelectionState(projectId);
  if (!sel?.confirmed) return false;
  return liveSelectionsComplete(projectId);
}
