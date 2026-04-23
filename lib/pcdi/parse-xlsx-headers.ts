import { read, utils } from "xlsx";

export type ParseSheetHeadersOptions = {
  /** 1-based row index (Excel row 1 = first row in the sheet). */
  headerRow: number;
  /** Zero-based sheet index; default first sheet. */
  sheetIndex?: number;
};

/**
 * Reads the given worksheet row as column headers.
 * Empty cells in that row are stripped from the result; duplicate labels are kept.
 */
export function parseSheetColumnHeaders(
  file: ArrayBuffer,
  options: ParseSheetHeadersOptions,
): string[] {
  const { headerRow, sheetIndex = 0 } = options;
  if (!Number.isFinite(headerRow) || headerRow < 1 || headerRow > 1_000_000) {
    return [];
  }
  const rowIndex = Math.floor(headerRow) - 1;

  const wb = read(file, { type: "array" });
  if (!wb.SheetNames.length) return [];

  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
    },
  );

  if (rowIndex >= matrix.length) return [];
  const row = matrix[rowIndex];
  if (!row || !Array.isArray(row)) return [];

  return row
    .map((cell) => String(cell ?? "").trim())
    .filter((cell) => cell.length > 0);
}

/** First sheet, first row as headers (backwards-compatible shortcut). */
export function parseFirstSheetColumnHeaders(file: ArrayBuffer): string[] {
  return parseSheetColumnHeaders(file, { headerRow: 1 });
}

/**
 * Reads all data rows below the header row on the first sheet.
 * Column keys match `parseSheetColumnHeaders` for the same file (non-empty header cells only).
 * Rows where every mapped cell is empty are skipped.
 */
export function parseFirstSheetDataRows(
  file: ArrayBuffer,
  headerRow: number,
  sheetIndex = 0,
): Record<string, string>[] {
  if (!Number.isFinite(headerRow) || headerRow < 1 || headerRow > 1_000_000) {
    return [];
  }
  const rowIndex = Math.floor(headerRow) - 1;

  const wb = read(file, { type: "array" });
  if (!wb.SheetNames.length) return [];

  const sheetName = wb.SheetNames[sheetIndex] ?? wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(
    sheet,
    {
      header: 1,
      defval: "",
      raw: false,
    },
  );

  if (rowIndex >= matrix.length) return [];
  const headerCells = matrix[rowIndex];
  if (!headerCells || !Array.isArray(headerCells)) return [];

  const columnIndices: { name: string; idx: number }[] = [];
  headerCells.forEach((cell, idx) => {
    const name = String(cell ?? "").trim();
    if (name.length > 0) columnIndices.push({ name, idx });
  });

  const out: Record<string, string>[] = [];
  for (let r = rowIndex + 1; r < matrix.length; r++) {
    const line = matrix[r];
    const obj: Record<string, string> = {};
    for (const { name, idx } of columnIndices) {
      obj[name] = String(line?.[idx] ?? "").trim();
    }
    const hasAny = Object.values(obj).some((v) => v.length > 0);
    if (hasAny) out.push(obj);
  }
  return out;
}
