import type { HistoricalDefectTableRow, HistoricalAiTarget, HistoricalColumnAiMapping } from "@/lib/pcdi/types";
import { extractDocCitationsFromDefectDescription } from "@/lib/pcdi/extract-doc-citations";
import {
  getDefaultResponseStrategyForDefectCategory,
  mockTopDefectCategoryForRow,
} from "@/lib/pcdi/live-correlation";
import { buildLiveReferencesDocsColumn } from "@/lib/pcdi/live-mock-reference-citations";
import { readHistoricalAiColumnMapping } from "@/lib/pcdi/map-session";
import { readUploadPayload } from "@/lib/pcdi/upload-session";
function columnsForTarget(
  mapping: HistoricalColumnAiMapping,
  columns: string[],
  target: HistoricalAiTarget,
): string[] {
  return columns.filter((c) => (mapping[c] ?? []).includes(target));
}

function joinRowCells(row: Record<string, string>, colNames: string[]): string {
  const parts = colNames.map((k) => row[k]?.trim() ?? "").filter(Boolean);
  return parts.join("\n\n").trim();
}

/**
 * Build live register rows from uploaded spreadsheet + AI column mapping (client-only).
 * Returns null if there is no usable upload payload or rows.
 */
export function buildLiveRowsFromUploadSession(projectId: string): HistoricalDefectTableRow[] | null {
  const upload = readUploadPayload(projectId);
  if (!upload?.dataRows?.length || upload.columns.length === 0) return null;

  const mapping = readHistoricalAiColumnMapping(projectId);
  if (!mapping) return null;

  const cols = upload.columns;
  const defectCols = columnsForTarget(mapping, cols, "ai_defect_category");
  if (defectCols.length === 0) return null;

  const rows: HistoricalDefectTableRow[] = upload.dataRows.map((dataRow, i) => {
    const defectDescription =
      joinRowCells(dataRow, defectCols) || joinRowCells(dataRow, cols) || `(Row ${i + 1})`;

    const categoryInput = joinRowCells(dataRow, defectCols) || defectDescription;
    const defectCategory = mockTopDefectCategoryForRow(categoryInput, i, projectId);
    const defaultStrategy = getDefaultResponseStrategyForDefectCategory(defectCategory);
    const referenceBundle = buildLiveReferencesDocsColumn({
      projectId,
      rowIndex: i,
      defectCategory,
      responseStrategy: defaultStrategy,
      extractedFromDescription: extractDocCitationsFromDefectDescription(defectDescription),
    });

    const excelSheetRow = upload.headerRow + 1 + i;

    return {
      id: `live-${projectId}-r${i}`,
      defectDescription,
      historicalResponse: "",
      defectCategory,
      responseCategory: "",
      referenceDocuments: referenceBundle,
      extractedDocCitations: referenceBundle,
      excelSheetRow,
    };
  });

  return rows;
}
