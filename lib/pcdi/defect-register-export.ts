import { utils, writeFile } from "xlsx";
import type { EnrichedDefectRow, HistoricalDefectTableRow } from "./types";

function firstReferenceSegment(referenceDocuments: string): string {
  const t = referenceDocuments.trim();
  if (!t) return "";
  const seg = t.split(";")[0]?.trim();
  return seg ?? t.slice(0, 200);
}

/** Map register rows into the enriched row shape so the colorful category table can reuse `EnrichedDefectsTable`. */
export function defectRegisterRowsToEnriched(rows: HistoricalDefectTableRow[]): EnrichedDefectRow[] {
  return rows.map((r) => ({
    id: r.id,
    defectDescription: r.defectDescription,
    historicalResponse: r.historicalResponse,
    referenceDocumentName: firstReferenceSegment(r.referenceDocuments),
    defectCategory: r.defectCategory,
    responseCategory: r.responseCategory,
    referencesRequired: r.referenceDocuments,
  }));
}

export function downloadDefectRegisterXlsx(
  rows: HistoricalDefectTableRow[],
  downloadBaseName: string,
): void {
  const headers = [
    "Defect description",
    "Historical response",
    "Defect category",
    "Response category",
    "Reference documents",
    "References / Docs (from defect text)",
  ];
  const aoa: string[][] = [
    headers,
    ...rows.map((r) => [
      r.defectDescription,
      r.historicalResponse,
      r.defectCategory,
      r.responseCategory,
      r.referenceDocuments,
      r.extractedDocCitations ?? "",
    ]),
  ];
  const ws = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Defect register");
  const safe = downloadBaseName.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 120);
  const name = safe.length > 0 ? `${safe}-register` : "pcdi-defect-register";
  writeFile(wb, `${name}.xlsx`);
}
