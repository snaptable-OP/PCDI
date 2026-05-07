import { defectCategoryFromUnknown } from "@/lib/pcdi/defect-category-display";
import {
  allCanonicalTaxonomyStrategyLabels,
  sortStrategiesByTaxonomyOrder,
} from "@/lib/pcdi/live-strategy-suggestions";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Billie often wraps entities as `{ code: 200, data: { mergeFileUrl, ... } }`.
 * Unwrap so row / merge extractors see the inner object.
 */
export function unwrapBillieDefectFilePayload(data: unknown): unknown {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;
  const inner = o.data;
  if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
    if (typeof o.code === "number" && o.code === 200) return inner;
    if (o.success === true) return inner;
  }
  return data;
}

function shallowMergeRecords(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  return { ...a, ...b };
}

/** Merge detail + status payloads so merge URL from status combines with rows from detail (or vice versa). */
export function mergeDefectFilePayloadsForHydration(a: unknown, b: unknown): unknown {
  const ua = unwrapBillieDefectFilePayload(a);
  const ub = unwrapBillieDefectFilePayload(b);
  if (ua && typeof ua === "object" && !Array.isArray(ua) && ub && typeof ub === "object" && !Array.isArray(ub)) {
    return shallowMergeRecords(ua as Record<string, unknown>, ub as Record<string, unknown>);
  }
  return ub ?? ua;
}

/** Merge file locations returned with defect-file GET/status payloads (Billie shapes). */
export function extractMergeFileInfoFromDefectFilePayload(data: unknown): {
  mergeFileUrl: string;
  mergeFileName?: string;
} | null {
  const payload = unwrapBillieDefectFilePayload(data);
  if (payload == null || typeof payload !== "object") return null;

  const tryRecord = (o: Record<string, unknown>): { mergeFileUrl: string; mergeFileName?: string } | null => {
    const rawUrl =
      o.mergeFileUrl ??
      o.merge_file_url ??
      o.mergedFileUrl ??
      o.mergeExcelUrl ??
      o.finalFileUrl ??
      o.outputFileUrl ??
      o.downloadUrl ??
      o.fileUrl ??
      o.presignedUrl ??
      o.url;
    if (typeof rawUrl === "string" && isHttpUrl(rawUrl.trim())) {
      const nameRaw = o.mergeFileName ?? o.merge_file_name ?? o.fileName ?? o.name;
      return {
        mergeFileUrl: rawUrl.trim(),
        mergeFileName: typeof nameRaw === "string" && nameRaw.trim() ? nameRaw.trim() : undefined,
      };
    }

    const nestedKeys = [
      o.defectFile,
      o.defect_file,
      o.file,
      o.latestDefectFile,
      o.record,
      o.result,
    ] as const;
    for (const nest of nestedKeys) {
      if (nest != null && typeof nest === "object" && !Array.isArray(nest)) {
        const inner = tryRecord(nest as Record<string, unknown>);
        if (inner) return inner;
      }
    }

    return null;
  };

  const root = payload as Record<string, unknown>;
  const direct = tryRecord(root);
  if (direct) return direct;

  const nests = [root.result, root.data, root.payload, root.content, root.body, root.defectFile] as const;
  for (const n of nests) {
    if (n == null) continue;
    if (Array.isArray(n) && n.length > 0) {
      const inner =
        tryRecord(n[n.length - 1] as Record<string, unknown>) ??
        tryRecord(n[0] as Record<string, unknown>);
      if (inner) return inner;
      continue;
    }
    if (typeof n === "object" && !Array.isArray(n)) {
      const inner = tryRecord(n as Record<string, unknown>);
      if (inner) return inner;
    }
  }

  return null;
}

function asRowArray(x: unknown): unknown[] | null {
  if (Array.isArray(x)) return x;
  return null;
}

/**
 * If Billie returns parsed rows in JSON (without going through merge XLSX), normalise to register rows.
 */
export function extractHistoricalRowsFromDefectFilePayload(
  data: unknown,
  projectId: string,
): HistoricalDefectTableRow[] | null {
  const unwrapped = unwrapBillieDefectFilePayload(data);
  if (unwrapped == null || typeof unwrapped !== "object") return null;
  const root = unwrapped as Record<string, unknown>;

  const candidates: unknown[] = [
    root.rows,
    root.defectRows,
    root.defects,
    root.items,
    root.records,
    root.content,
    root.resultList,
    root.defectList,
    root.dataRows,
  ];

  for (const nest of [root.result, root.data, root.payload, root.body] as const) {
    if (nest && typeof nest === "object" && !Array.isArray(nest)) {
      const o = nest as Record<string, unknown>;
      candidates.push(
        o.rows,
        o.defectRows,
        o.defects,
        o.items,
        o.records,
        o.list,
        o.resultList,
        o.defectList,
      );
    }
  }

  for (const c of candidates) {
    const arr = asRowArray(c);
    if (!arr || arr.length === 0) continue;

    const mapped: HistoricalDefectTableRow[] = [];
    for (let i = 0; i < arr.length; i++) {
      const row = mapLooseApiRowToHistorical(arr[i], projectId, i);
      if (row) mapped.push(row);
    }
    if (mapped.length > 0) return mapped;
  }

  return null;
}

function mapLooseApiRowToHistorical(
  raw: unknown,
  projectId: string,
  index: number,
): HistoricalDefectTableRow | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const defectDescription = String(
    o.defectDescription ?? o.description ?? o.defect_description ?? o.defectText ?? o.details ?? "",
  ).trim();

  const catSource =
    o.defectCategory ?? o.category ?? o.defect_category ?? o.pcdiCategory;

  const historicalResponse = String(
    o.historicalResponse ?? o.response ?? o.historical_response ?? "",
  ).trim();

  const responseCategory = String(
    o.responseCategory ?? o.response_category ?? o.aiResponseCategory ?? "",
  ).trim();

  const referenceDocuments = String(
    o.referenceDocuments ?? o.reference_documents ?? o.documents ?? o.refs ?? "",
  ).trim();

  const idRaw = o.id ?? o.uuid ?? o.defectId ?? o.defect_id;
  const id =
    typeof idRaw === "string" && idRaw.trim()
      ? idRaw.trim()
      : typeof idRaw === "number" && Number.isFinite(idRaw)
        ? String(idRaw)
        : `billie-${projectId}-${index + 1}`;

  const hasCategorySource =
    catSource != null &&
    (typeof catSource !== "string" || catSource.trim().length > 0);
  if (!defectDescription && !hasCategorySource) return null;

  const defectCategoryOut = defectCategoryFromUnknown(catSource ?? "");
  const defectDescriptionOut =
    defectDescription || defectCategoryOut || `(Row ${index + 1})`;

  function collectStrategyStrings(v: unknown): string[] {
    if (v == null) return [];
    if (typeof v === "string") {
      return v.split(/[;\n|]+/).map((x) => x.trim()).filter(Boolean);
    }
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const x of v) {
      if (typeof x === "string" && x.trim()) out.push(x.trim());
      else if (x && typeof x === "object" && !Array.isArray(x)) {
        const r = x as Record<string, unknown>;
        const s =
          r.name ?? r.label ?? r.strategy ?? r.code ?? r.value ?? r.leaf ?? r.taxonomy ?? r.defectStrategy;
        if (typeof s === "string" && s.trim()) out.push(s.trim());
      }
    }
    return out;
  }

  const fromResponseStrategyCol: string[] = [];
  for (const key of ["response_strategy", "responseStrategy"] as const) {
    fromResponseStrategyCol.push(...collectStrategyStrings(o[key]));
  }

  const aiRaw = o.aiSuggestedStrategies ?? o.suggestedStrategies ?? o.strategyTaxonomy;
  const mergedAi = collectStrategyStrings(aiRaw);
  const uniq = [...new Set(mergedAi.map((s) => s.trim()).filter(Boolean))];
  const aiSuggestedStrategies = uniq.length > 0 ? uniq : undefined;

  const responseLabelSet = new Set<string>();
  for (const s of fromResponseStrategyCol) {
    for (const label of allCanonicalTaxonomyStrategyLabels(s)) {
      responseLabelSet.add(label);
    }
  }
  const responseStrategyTaxonomy =
    responseLabelSet.size > 0 ? sortStrategiesByTaxonomyOrder([...responseLabelSet]) : undefined;

  const er =
    o.excelSheetRow ??
    o.excel_sheet_row ??
    o.sheetRow ??
    o.sheet_row ??
    o.rowNumber ??
    o.row_number ??
    o.excelRow ??
    o.sourceExcelRow;
  let excelSheetRow: number | undefined;
  if (typeof er === "number" && Number.isFinite(er) && er >= 1) {
    excelSheetRow = Math.floor(er);
  } else if (typeof er === "string" && /^\d+$/.test(er.trim())) {
    const n = parseInt(er.trim(), 10);
    if (n >= 1) excelSheetRow = n;
  }

  return {
    id,
    defectDescription: defectDescriptionOut,
    historicalResponse,
    defectCategory: defectCategoryOut,
    responseCategory,
    referenceDocuments,
    extractedDocCitations:
      typeof o.extractedDocCitations === "string" ? o.extractedDocCitations : undefined,
    aiSuggestedStrategies,
    responseStrategyTaxonomy,
    ...(excelSheetRow != null ? { excelSheetRow } : {}),
  };
}
