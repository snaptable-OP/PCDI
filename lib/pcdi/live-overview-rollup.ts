import {
  extractHistoricalRowsFromDefectFilePayload,
  unwrapBillieDefectFilePayload,
} from "@/lib/pcdi/defect-file-merge-info";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

/** Non-negative integer hints Billie sometimes exposes when embedded rows are absent. */
export function extractApproxRowCountFromDefectFilePayload(payload: unknown): number | null {
  const scan = (obj: unknown): number | null => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const o = obj as Record<string, unknown>;
    for (const key of [
      "rowCount",
      "totalRows",
      "dataRowCount",
      "defectRowCount",
      "parsedRowCount",
      "recordCount",
      "totalRecordCount",
    ] as const) {
      const v = o[key];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.floor(v);
    }
    return null;
  };

  const u = unwrapBillieDefectFilePayload(payload);
  const direct = scan(u);
  if (direct != null) return direct;
  if (u && typeof u === "object" && !Array.isArray(u)) {
    const o = u as Record<string, unknown>;
    for (const nest of [o.data, o.result, o.payload] as const) {
      const n = scan(nest);
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Rows that received AI / spreadsheet-backed response output (strategies or written response fields).
 */
export function countResponsesGeneratedFromRows(rows: HistoricalDefectTableRow[]): number {
  let n = 0;
  for (const r of rows) {
    const strategies =
      (r.aiSuggestedStrategies?.length ?? 0) > 0 || (r.responseStrategyTaxonomy?.length ?? 0) > 0;
    const text =
      Boolean(r.historicalResponse?.trim()) ||
      Boolean(r.responseCategory?.trim()) ||
      Boolean(r.referenceDocuments?.trim());
    if (strategies || text) n += 1;
  }
  return n;
}

export function defectRowsAndResponsesFromBillieDetail(
  payload: unknown,
  projectId: string,
): { defectRows: number; responses: number } {
  const rows = extractHistoricalRowsFromDefectFilePayload(payload, projectId);
  if (rows?.length) {
    return {
      defectRows: rows.length,
      responses: countResponsesGeneratedFromRows(rows),
    };
  }
  const approx = extractApproxRowCountFromDefectFilePayload(payload);
  if (approx != null) {
    return { defectRows: approx, responses: 0 };
  }
  return { defectRows: 0, responses: 0 };
}
