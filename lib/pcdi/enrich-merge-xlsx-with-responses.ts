import type ExcelJS from "exceljs";

import {
  colNumberToLetters,
  injectProposedResponseIntoXlsxZip,
} from "@/lib/pcdi/enrich-merge-xlsx-zip-inject";

/** Legacy header (before timestamped headers); still recognised so re-exports update the same column. */
export const LEGACY_PROPOSED_RESPONSE_HEADER = "proposed response";

/**
 * Column title for the export-added column, e.g. `Proposed Response [13/05/2026, 14:05]`.
 * Uses local server time at export.
 */
export function buildProposedResponseColumnHeader(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `Proposed Response [${dd}/${mm}/${yyyy}, ${hh}:${min}]`;
}

function cellDisplayString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "richText" in v) {
    return String((v as { text?: string }).text ?? "");
  }
  return String(v);
}

/** Finds a column whose header is the legacy title or any `Proposed Response [dd/mm/yyyy, hh:mm]` variant. */
function findProposedResponseHeaderColumn(ws: ExcelJS.Worksheet, headerRow: number): number | null {
  const row = ws.getRow(headerRow);
  let found: number | null = null;
  const prefix = "proposed response";
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const norm = cellDisplayString(cell).trim().toLowerCase();
    if (norm === LEGACY_PROPOSED_RESPONSE_HEADER || norm.startsWith(`${prefix} [`)) {
      found = colNumber;
    }
  });
  return found;
}

function lastUsedColumnInRow(ws: ExcelJS.Worksheet, rowNum: number): number {
  const row = ws.getRow(rowNum);
  let max = 0;
  row.eachCell({ includeEmpty: false }, (_cell, colNumber) => {
    if (colNumber > max) max = colNumber;
  });
  return max;
}

export type ProposedResponsePatch = {
  /** 1-based worksheet row on the original upload (Billie `row_number` or derived from upload order). */
  sheetRow: number;
  proposedResponse: string;
};

/**
 * Loads an XLSX buffer (original upload workbook), adds or updates the proposed-response column
 * and fills rows by 1-based sheet row index.
 *
 * Uses OOXML zip patching so original cell style indices stay valid (avoids ExcelJS full
 * re-save painting the sheet red).
 */
export async function enrichMergeXlsxWithResponseColumns(
  input: ArrayBuffer,
  ExcelJSMod: { Workbook: new () => import("exceljs").Workbook },
  opts: {
    headerRow: number;
    patches: ProposedResponsePatch[];
    /** Defaults to {@link buildProposedResponseColumnHeader} at call time. */
    columnHeader?: string;
  },
): Promise<Buffer> {
  const wb = new ExcelJSMod.Workbook();
  // @ts-expect-error exceljs typings use a narrower Buffer than Node's generic Buffer<T>.
  await wb.xlsx.load(Buffer.from(input));

  const ws = wb.worksheets[0];
  if (!ws) {
    throw new Error("Workbook has no worksheets.");
  }

  const headerRow = opts.headerRow;
  if (headerRow < 1 || !Number.isFinite(headerRow)) {
    throw new Error("headerRow must be a positive integer.");
  }

  const columnHeader = opts.columnHeader ?? buildProposedResponseColumnHeader();

  let cProposed = findProposedResponseHeaderColumn(ws, headerRow);

  if (cProposed == null) {
    let lastCol = lastUsedColumnInRow(ws, headerRow);
    if (lastCol < 1) lastCol = ws.actualColumnCount ?? 1;
    cProposed = lastCol + 1;
  }

  const colLetters = colNumberToLetters(cProposed);

  return injectProposedResponseIntoXlsxZip(input, {
    colLetters,
    col1Based: cProposed,
    headerRow,
    patches: opts.patches,
    headerLabel: columnHeader,
  });
}
