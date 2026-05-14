import * as XLSX from "xlsx";
import { defectCategoryDisplayKey } from "@/lib/pcdi/defect-category-display";
import { allCanonicalTaxonomyStrategyLabels } from "@/lib/pcdi/live-strategy-suggestions";
import { STRATEGY_TAXONOMY_V2_OPTIONS } from "@/lib/pcdi/strategy-taxonomy-v2-labels";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Extract any taxonomy labels mentioned in free text. */
export function extractTaxonomyLabelsFromText(text: string): string[] {
  const found = new Set<string>();
  const t = text.trim();
  if (!t) return [];
  for (const label of STRATEGY_TAXONOMY_V2_OPTIONS) {
    if (t.includes(label)) found.add(label);
  }
  return [...found];
}

function pickColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const h of headers) {
    const n = norm(h);
    if (patterns.some((re) => re.test(n))) return h;
  }
  return null;
}

/** Merged Billie export column that stores the 1-based row index in the **original** upload (not the merged sheet row). */
function findSourceExcelRowColumn(headers: string[]): string | null {
  const exact = pickColumn(headers, [
    /^row_number$/,
    /^row number$/,
    /^source_row$/,
    /^source row$/,
    /^original_row$/,
    /^original row$/,
    /^excel_row$/,
    /^excel row$/,
    /^sheet_row$/,
    /^sheet row$/,
  ]);
  if (exact) return exact;
  return pickColumn(headers, [
    /^row[_\s]*number$/,
    /original\s*[_\s]*(?:excel\s*)?row/,
    /source\s*[_\s]*row/,
  ]);
}

/** Merged export column used as Billie `itemId` for database updates. */
function findItemIdColumn(headers: string[]): string | null {
  const exact = pickColumn(headers, [
    /^item[_\s-]*id$/,
    /^defect[_\s-]*item[_\s-]*id$/,
    /^reference[_\s-]*id$/,
  ]);
  if (exact) return exact;
  return pickColumn(headers, [/item\s*id/i, /defect\s*ref/i]);
}

function parseSourceExcelRowCell(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const n = Math.floor(raw);
    return n >= 1 ? n : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 ? n : null;
}

/** SheetJS merges duplicate header keys into one property — duplicate Billie columns were dropping data. */
function sheetToMatrixDedupedHeaders(sheet: XLSX.WorkSheet): {
  matrix: Record<string, unknown>[];
  /** Same length as matrix: 1-based Excel row number for each kept data row. */
  excelSheetRows: number[];
} {
  const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  if (!aoa.length) return { matrix: [], excelSheetRows: [] };

  const headerCells = (aoa[0] ?? []).map((c) => String(c ?? "").trim());
  const seen = new Map<string, number>();
  const headers = headerCells.map((h, idx) => {
    const base = h.length > 0 ? h : `Column_${idx + 1}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}__${n}`;
  });

  const out: Record<string, unknown>[] = [];
  const excelSheetRows: number[] = [];

  for (let ri = 1; ri < aoa.length; ri++) {
    const cellsRaw = aoa[ri];
    const excelSheetRow = ri + 1;
    const arr = Array.isArray(cellsRaw) ? cellsRaw : [];
    const row: Record<string, unknown> = {};
    let any = false;
    for (let i = 0; i < headers.length; i++) {
      const v = arr[i];
      const str = v === undefined || v === null ? "" : String(v);
      if (str.trim()) any = true;
      row[headers[i]] = str;
    }
    if (!any) continue;
    out.push(row);
    excelSheetRows.push(excelSheetRow);
  }
  return { matrix: out, excelSheetRows };
}

function pickLargestDataSheet(wb: XLSX.WorkBook): {
  sheetName: string;
  matrix: Record<string, unknown>[];
  excelSheetRows: number[];
} {
  let best: {
    sheetName: string;
    matrix: Record<string, unknown>[];
    excelSheetRows: number[];
  } | null = null;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const { matrix, excelSheetRows } = sheetToMatrixDedupedHeaders(sheet);
    if (!best || matrix.length > best.matrix.length) {
      best = { sheetName, matrix, excelSheetRows };
    }
  }
  return best ?? { sheetName: wb.SheetNames[0] ?? "", matrix: [], excelSheetRows: [] };
}

function looksLikeIndexColumn(header: string): boolean {
  const n = norm(header).replace(/__\d+$/, "");
  return (
    /^(row|#|no\.?|item|line|index|record|seq\.?)$/i.test(n) ||
    /^column_\d+$/i.test(n) ||
    /^(defect|issue)\s*id$/i.test(n) ||
    /^id$/i.test(n)
  );
}

/** Header names that usually denote strategy / taxonomy, not defect category grouping. */
function headerSuggestsStrategyColumn(header: string): boolean {
  const n = norm(header).replace(/__\d+$/, "").replace(/_/g, " ");
  if (n === "response strategy") return true;
  if (/defect\s*category|issue\s*category|discovered\s*defect|pcdi\s*category/.test(n)) return false;
  return (
    /strategy|taxonomy\s*v2|response\s*category|suggested|ai\s*pick|leaf\s*label|r\d(\.\d)?\s/i.test(n) ||
    /^r\d[\d.]*\s/.test(n)
  );
}

/** Billie merged export: strategy_taxonomy_v2 / AI hints live in `response_strategy` — match before generic picks. */
function findResponseStrategyColumn(headers: string[]): string | null {
  for (const h of headers) {
    const n = norm(h).replace(/__\d+$/, "").replace(/_/g, " ");
    if (n === "response strategy") return h;
  }
  return null;
}

/** `response_strategy`, `response_strategy__2`, … after SheetJS dedupes duplicate Excel headers. */
function responseStrategyColumnKeys(headers: string[]): string[] {
  return headers.filter((h) => {
    const base = h.replace(/__\d+$/, "");
    const n = norm(base.replace(/_/g, " "));
    return n === "response strategy";
  });
}

/** Most cell values match strategy_taxonomy_v2 leaves — wrong column for defect **category** bubbles. */
function columnValuesLookLikeStrategyTaxonomyLeaves(matrix: Record<string, unknown>[], header: string): boolean {
  const vals = matrix.map((r) => String(r[header] ?? "").trim()).filter((v) => v.length > 0);
  if (vals.length < 4) return false;
  let taxonomyHits = 0;
  for (const v of vals) {
    if (STRATEGY_TAXONOMY_V2_OPTIONS.some((opt) => opt === v || v.includes(opt) || opt.includes(v))) {
      taxonomyHits++;
      continue;
    }
    if (/^R\d[\d.]*\s/.test(v) && v.length < 100) taxonomyHits++;
  }
  return taxonomyHits / vals.length >= 0.38;
}

type CategoryGuessOpts = {
  /** Strategy column — never use as defect category. */
  strategyCol: string | null;
  /** All `response_strategy` / duplicate header columns to skip for category heuristics. */
  strategyCols?: string[];
  /** Extra headers to skip (e.g. previously rejected category pick). */
  skip?: Set<string>;
};

function shouldSkipAsDefectCategory(
  matrix: Record<string, unknown>[],
  h: string,
  opts: CategoryGuessOpts,
): boolean {
  if (looksLikeIndexColumn(h)) return true;
  if (opts.strategyCols?.includes(h)) return true;
  if (opts.strategyCol && h === opts.strategyCol) return true;
  if (opts.skip?.has(h)) return true;
  if (headerSuggestsStrategyColumn(h)) return true;
  return columnValuesLookLikeStrategyTaxonomyLeaves(matrix, h);
}

/** Prefer columns whose values repeat across rows (typical category field vs row-unique IDs). */
function guessCategoryColumn(
  matrix: Record<string, unknown>[],
  headers: string[],
  opts: CategoryGuessOpts,
): string | null {
  if (matrix.length === 0 || headers.length === 0) return null;

  let best: string | null = null;
  let bestScore = -Infinity;

  for (const h of headers) {
    if (shouldSkipAsDefectCategory(matrix, h, opts)) continue;

    const vals = matrix.map((r) => String(r[h] ?? "").trim()).filter((v) => v.length > 0);
    if (vals.length < Math.max(3, matrix.length * 0.25)) continue;

    const numericLike = vals.filter((v) => /^\d+(\.\d+)?$/.test(v)).length;
    if (numericLike / vals.length > 0.85) continue;

    const unique = new Set(vals).size;
    const ratio = unique / vals.length;
    const avgLen = vals.reduce((s, v) => s + v.length, 0) / vals.length;
    if (avgLen > 220) continue;

    const score = vals.length * (1 - ratio) * Math.min(avgLen + 40, 200);
    if (score > bestScore) {
      bestScore = score;
      best = h;
    }
  }
  return best;
}

/** Last resort: column with the smallest unique/total ratio (repeated labels ≈ category). */
function fallbackCategoryByLowestUniqueRatio(
  matrix: Record<string, unknown>[],
  headers: string[],
  opts: CategoryGuessOpts,
): string | null {
  let best: string | null = null;
  let bestRatio = 2;
  for (const h of headers) {
    if (shouldSkipAsDefectCategory(matrix, h, opts)) continue;
    const vals = matrix.map((r) => String(r[h] ?? "").trim()).filter((v) => v.length > 0);
    if (vals.length < 3) continue;
    const ratio = new Set(vals).size / vals.length;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = h;
    }
  }
  return best;
}

function guessDescriptionColumn(
  matrix: Record<string, unknown>[],
  headers: string[],
  excludeHeader: string | null,
): string | null {
  let best: string | null = null;
  let bestAvg = -1;
  for (const h of headers) {
    if (excludeHeader && h === excludeHeader) continue;
    if (looksLikeIndexColumn(h)) continue;

    const vals = matrix.map((r) => String(r[h] ?? "").trim()).filter((v) => v.length > 0);
    if (vals.length < matrix.length * 0.2) continue;

    const avgLen = vals.reduce((s, v) => s + v.length, 0) / vals.length;
    if (avgLen > bestAvg && avgLen >= 12) {
      bestAvg = avgLen;
      best = h;
    }
  }
  return best;
}

export type ParseBillieMergeResult = {
  rows: HistoricalDefectTableRow[];
};

/**
 * Parses Billie merge XLSX buffer. Uses the sheet with the most data rows, preserves duplicate headers,
 * and picks defect category / description columns by header patterns or column-shape heuristics.
 */
export function parseBillieMergeXlsxBuffer(buf: ArrayBuffer, projectId: string): ParseBillieMergeResult {
  const wb = XLSX.read(buf, { type: "array" });
  const { matrix, excelSheetRows } = pickLargestDataSheet(wb);

  if (!matrix.length) return { rows: [] };

  const headers = Object.keys(matrix[0] ?? {}).map(String);

  const namedStrategyCols = responseStrategyColumnKeys(headers);
  const fallbackStrategyCol =
    findResponseStrategyColumn(headers) ??
    pickColumn(headers, [
      /^response_strategy$/,
      /^response strategy$/,
      /suggested.*strategy/,
      /response.*strategy/,
      /strategy_taxonomy/,
      /^strategy$/,
      /ai.*strategy/,
      /taxonomy.*v2/,
      /^r[\d]/i,
    ]) ??
    null;

  const strategyColumnKeysForRows =
    namedStrategyCols.length > 0 ? namedStrategyCols : fallbackStrategyCol ? [fallbackStrategyCol] : [];

  const catOpts: CategoryGuessOpts = {
    strategyCol: strategyColumnKeysForRows[0] ?? fallbackStrategyCol,
    strategyCols: strategyColumnKeysForRows.length > 0 ? strategyColumnKeysForRows : undefined,
  };

  let catCol =
    pickColumn(headers, [
      /defect\s*category/,
      /^category$/,
      /taxonomy.*category/,
      /ai\s*defect\s*category/,
      /discovered\s*defect/,
      /pcdi\s*category/,
      /group/,
      /cluster/,
      /defect\s*class/,
      /defect\s*type/,
      /issue\s*category/,
      /^main\s*category$/,
      /^discipline$/,
    ]) ?? null;

  if (catCol && shouldSkipAsDefectCategory(matrix, catCol, catOpts)) {
    catCol = null;
  }

  if (!catCol) {
    catCol = guessCategoryColumn(matrix, headers, catOpts);
  }
  if (!catCol) {
    catCol = fallbackCategoryByLowestUniqueRatio(matrix, headers, catOpts);
  }
  if (!catCol) {
    const fallback = headers.find((h) => !shouldSkipAsDefectCategory(matrix, h, catOpts));
    catCol = fallback ?? headers[0] ?? "Column_1";
  }

  let descCol =
    pickColumn(headers, [
      /defect\s*description/,
      /^description$/,
      /details/,
      /defect\s*text/,
      /narrative/,
      /comments?/,
      /remarks?/,
      /finding/,
      /issue\s*details?/,
    ]) ?? null;

  if (!descCol || descCol === catCol) {
    const guessed = guessDescriptionColumn(matrix, headers, catCol);
    descCol = guessed ?? headers[1] ?? headers[0] ?? catCol;
  }

  const sourceExcelRowCol = findSourceExcelRowColumn(headers);
  const itemIdCol = findItemIdColumn(headers);

  const rows: HistoricalDefectTableRow[] = matrix.map((raw, i) => {
    const catCell = String(raw[catCol] ?? "").trim();
    const descCell = String(raw[descCol] ?? "").trim();
    const defectCategory = defectCategoryDisplayKey(catCell);
    const defectDescription = descCell || catCell || `(Row ${i + 1})`;

    const strategyBlob = strategyColumnKeysForRows
      .map((k) => String(raw[k] ?? "").trim())
      .filter(Boolean)
      .join("; ");

    const parsed =
      strategyBlob.length > 0 ? allCanonicalTaxonomyStrategyLabels(strategyBlob) : [];
    const responseStrategyTaxonomy = parsed.length > 0 ? parsed : undefined;

    const id = `billie-${projectId}-${i + 1}`;
    const fromRowNumberCol =
      sourceExcelRowCol != null ? parseSourceExcelRowCell(raw[sourceExcelRowCol]) : null;
    const excelSheetRow = fromRowNumberCol ?? excelSheetRows[i];

    const itemIdCell = itemIdCol != null ? String(raw[itemIdCol] ?? "").trim() : "";
    const itemId = itemIdCell.length > 0 ? itemIdCell : undefined;

    return {
      id,
      defectDescription,
      historicalResponse: "",
      defectCategory,
      responseCategory: "",
      referenceDocuments: "",
      extractedDocCitations: "",
      responseStrategyTaxonomy,
      ...(excelSheetRow != null ? { excelSheetRow } : {}),
      ...(itemId != null ? { itemId } : {}),
    };
  });

  return { rows };
}
