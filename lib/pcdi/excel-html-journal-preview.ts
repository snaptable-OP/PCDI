/**
 * HTML table preview for the first worksheet + embedded cell images (Journal-style OOXML parse).
 * Ported from JournalExcelPreview.tsx — uses JSZip + drawing anchors so previews match Excel more closely
 * than overlay-only approaches.
 */
import JSZip from "jszip";
import type ExcelJS from "exceljs";
import { readExcelJsCellValue } from "@/lib/pcdi/read-exceljs-cell-value";

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWING_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";

/** 96 dpi: 914400 / 96 — matches common OOXML px conversions */
const EMU_PER_PX = 9525;

const EXCEL_PREVIEW_CELL_IMAGE_MAX_WIDTH_PX = 240;
const EXCEL_PREVIEW_CELL_IMAGE_MAX_HEIGHT_PX = 200;

export type CellImageData = { url: string; width?: number; height?: number };

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function emuToPx(emu: number): number {
  return Math.round(emu / EMU_PER_PX);
}

function parseDrawingAnchors(
  drawingXml: string,
): Array<{ col: number; row: number; rId: string; width?: number; height?: number }> {
  const result: Array<{ col: number; row: number; rId: string; width?: number; height?: number }> = [];
  const anchorRegex =
    /<(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/(?:xdr:)?(?:twoCellAnchor|oneCellAnchor)>/gi;
  const anchorBlocks = drawingXml.match(anchorRegex) ?? [];
  for (const block of anchorBlocks) {
    const colMatch = block.match(/<(?:xdr:)?col>(\d+)<\/(?:xdr:)?col>/i);
    const rowMatch = block.match(/<(?:xdr:)?row>(\d+)<\/(?:xdr:)?row>/i);
    const embedMatch = block.match(/r:embed="([^"]+)"/i) ?? block.match(/embed="([^"]+)"/i);
    const extMatchCxFirst =
      block.match(/<(?:xdr:)?ext\s+[^>]*cx="(\d+)"[^>]*cy="(\d+)"[^>]*\/?>/i) ??
      block.match(/<(?:a:)?ext\s+[^>]*cx="(\d+)"[^>]*cy="(\d+)"[^>]*\/?>/i);
    const extMatchCyFirst =
      block.match(/<(?:xdr:)?ext[^>]*cy="(\d+)"[^>]*cx="(\d+)"[^>]*\/?>/i) ??
      block.match(/<(?:a:)?ext[^>]*cy="(\d+)"[^>]*cx="(\d+)"[^>]*\/?>/i);
    const cx = extMatchCxFirst?.[1] ?? extMatchCyFirst?.[2];
    const cy = extMatchCxFirst?.[2] ?? extMatchCyFirst?.[1];
    if (colMatch && rowMatch && embedMatch) {
      const item: { col: number; row: number; rId: string; width?: number; height?: number } = {
        col: parseInt(colMatch[1], 10),
        row: parseInt(rowMatch[1], 10),
        rId: embedMatch[1],
      };
      if (cx != null && cy != null) {
        item.width = emuToPx(parseInt(cx, 10));
        item.height = emuToPx(parseInt(cy, 10));
      }
      result.push(item);
    }
  }
  return result;
}

function parseDrawingRels(relsXml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const relMatches = relsXml.matchAll(/<Relationship\s+[^>]*>/gi);
  for (const rel of relMatches) {
    const tag = rel[0];
    const idMatch = tag.match(/Id="([^"]+)"/i);
    const targetMatch = tag.match(/Target="([^"]+)"/i);
    if (idMatch?.[1] && targetMatch?.[1]) {
      const target = targetMatch[1].replace(/^\.\.\//, "");
      map[idMatch[1]] = target.startsWith("xl/") ? target : `xl/${target}`;
    }
  }
  return map;
}

function getDrawingPathFromSheetRels(relsXml: string): string | null {
  const relMatches = relsXml.matchAll(/<Relationship\s+[^>]*>/gi);
  for (const rel of relMatches) {
    const tag = rel[0];
    const typeMatch = tag.match(/Type="([^"]+)"/i);
    const targetMatch = tag.match(/Target="([^"]+)"/i);
    const typ = typeMatch?.[1] ?? "";
    if (
      targetMatch?.[1] &&
      (typ === DRAWING_REL_TYPE || typ.endsWith("/drawing") || typ.includes("drawing"))
    ) {
      let target = targetMatch[1].replace(/^\.\.\//, "");
      if (target.startsWith("../")) target = `xl/${target.slice(3)}`;
      else if (!target.startsWith("xl/")) target = `xl/drawings/${target}`;
      return target.startsWith("xl/") ? target : `xl/${target}`;
    }
  }
  return null;
}

async function resolveWorkbookFirstSheetPath(zip: JSZip): Promise<string | null> {
  const wbText = await zip.file("xl/workbook.xml")?.async("string");
  if (!wbText) return null;
  const doc = new DOMParser().parseFromString(wbText, "text/xml");
  const sheets = [...doc.getElementsByTagName("sheet")];
  if (sheets.length === 0) return null;
  const first = sheets[0];
  const rid =
    first.getAttributeNS(REL_NS, "id") ||
    first.getAttribute("r:id") ||
    [...first.attributes].find((a) => a.localName === "id")?.value ||
    null;
  if (!rid) return null;
  const relsText = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!relsText) return null;
  const relDoc = new DOMParser().parseFromString(relsText, "text/xml");
  for (const rel of relDoc.getElementsByTagName("Relationship")) {
    if (rel.getAttribute("Id") !== rid) continue;
    let t = rel.getAttribute("Target") ?? "";
    t = t.replace(/^\//, "");
    if (t.startsWith("worksheets/")) t = `xl/${t}`;
    else if (!t.startsWith("xl/")) t = `xl/${t}`;
    return t;
  }
  return null;
}

function fallbackSheetPath(zip: JSZip): string | null {
  const keys = Object.keys(zip.files).filter(
    (k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k) && !zip.files[k]?.dir,
  );
  keys.sort((a, b) => {
    const na = parseInt(a.match(/sheet(\d+)/i)?.[1] ?? "0", 10);
    const nb = parseInt(b.match(/sheet(\d+)/i)?.[1] ?? "0", 10);
    return na - nb;
  });
  return keys[0] ?? null;
}

function sheetToRelsPath(sheetPath: string): string {
  const m = sheetPath.match(/^xl\/worksheets\/(.+)\.xml$/i);
  if (!m) return "";
  return `xl/worksheets/_rels/${m[1]}.xml.rels`;
}

async function extractImagesFromZip(
  ab: ArrayBuffer,
  cellToImages: Map<string, CellImageData[]>,
  urlRef: string[],
): Promise<void> {
  const zip = await JSZip.loadAsync(ab);
  const mediaPrefix = "xl/media/";
  const pathToUrl: Record<string, string> = {};
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!path.startsWith(mediaPrefix) || entry.dir) continue;
    const blob = await entry.async("blob");
    const url = URL.createObjectURL(blob);
    pathToUrl[path] = url;
    urlRef.push(url);
  }

  let sheetPath = await resolveWorkbookFirstSheetPath(zip);
  if (!sheetPath) sheetPath = fallbackSheetPath(zip);
  if (!sheetPath) return;

  const sheetRelsPath = sheetToRelsPath(sheetPath);
  if (!sheetRelsPath) return;

  const sheetRelsEntry = zip.files[sheetRelsPath];
  if (!sheetRelsEntry) return;

  const sheetRelsXml = await sheetRelsEntry.async("string");
  const drawingPath = getDrawingPathFromSheetRels(sheetRelsXml);
  if (!drawingPath) return;

  const drawingEntry = zip.files[drawingPath];
  const drawingRelsPath =
    drawingPath.replace(/\/[^/]+$/, "/_rels/") + (drawingPath.split("/").pop() ?? "") + ".rels";
  const drawingRelsEntry = zip.files[drawingRelsPath];
  if (drawingEntry && drawingRelsEntry) {
    const drawingXml = await drawingEntry.async("string");
    const drawingRelsXml = await drawingRelsEntry.async("string");
    const rIdToPath = parseDrawingRels(drawingRelsXml);
    const anchors = parseDrawingAnchors(drawingXml);
    for (const { col, row, rId, width, height } of anchors) {
      const mediaPath = rIdToPath[rId];
      const url = mediaPath ? pathToUrl[mediaPath] : undefined;
      if (url) {
        const key = `${row},${col}`;
        const list = cellToImages.get(key) ?? [];
        list.push({ url, width, height });
        cellToImages.set(key, list);
      }
    }
  }
  if (cellToImages.size === 0 && urlRef.length > 0) {
    urlRef.forEach((url, i) => cellToImages.set(`0,${i}`, [{ url }]));
  }
}

function excelColWidthToPx(charWidth: number | undefined): number {
  const w = charWidth ?? 10;
  return Math.round(7 * w + 5);
}

function colLettersToIndex1Based(letters: string): number {
  let n = 0;
  const u = letters.toUpperCase();
  for (let i = 0; i < u.length; i++) {
    n = n * 26 + (u.charCodeAt(i) - 64);
  }
  return n;
}

function parseCellRef(ref: string): { row: number; col: number } | null {
  const s = ref
    .replace(/^[^!]*!/, "")
    .trim()
    .toUpperCase();
  const m = s.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { col: colLettersToIndex1Based(m[1]), row: parseInt(m[2], 10) };
}

function parseMergeRangeString(range: string): {
  top: number;
  left: number;
  bottom: number;
  right: number;
} | null {
  const parts = range.replace(/^[^!]*!/, "").split(":");
  if (parts.length !== 2) return null;
  const a = parseCellRef(parts[0]);
  const b = parseCellRef(parts[1]);
  if (!a || !b) return null;
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

function getWorksheetMergeRanges(worksheet: ExcelJS.Worksheet): string[] {
  const model = (worksheet as unknown as { model?: { merges?: string[] } }).model;
  if (model && Array.isArray(model.merges)) return model.merges;
  return [];
}

function buildMergeMaps(worksheet: ExcelJS.Worksheet): {
  covered: Set<string>;
  master: Map<string, { rowspan: number; colspan: number }>;
} {
  const covered = new Set<string>();
  const master = new Map<string, { rowspan: number; colspan: number }>();
  const merges = getWorksheetMergeRanges(worksheet);
  for (const range of merges) {
    const box = parseMergeRangeString(range);
    if (!box) continue;
    const rowspan = box.bottom - box.top + 1;
    const colspan = box.right - box.left + 1;
    master.set(`${box.top},${box.left}`, { rowspan, colspan });
    for (let r = box.top; r <= box.bottom; r++) {
      for (let c = box.left; c <= box.right; c++) {
        if (r === box.top && c === box.left) continue;
        covered.add(`${r},${c}`);
      }
    }
  }
  return { covered, master };
}

function getCellBackgroundStyle(cell: ExcelJS.Cell): string {
  const styleFill = (cell as ExcelJS.Cell & { style?: { fill?: { fgColor?: { argb?: string } } } }).style?.fill;
  const fill = styleFill ?? (cell as ExcelJS.Cell).fill;
  const argb =
    fill && typeof fill === "object" && "fgColor" in fill
      ? (fill as { fgColor?: { argb?: string } }).fgColor?.argb
      : undefined;
  if (!argb || typeof argb !== "string") return "";
  const hex = argb.trim();
  if (hex.length === 8) {
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const r = parseInt(hex.slice(2, 4), 16);
    const g = parseInt(hex.slice(4, 6), 16);
    const b = parseInt(hex.slice(6, 8), 16);
    if (a === 0) return "";
    if (a >= 1) return `background-color:#${hex.slice(2)};`;
    return `background-color:rgba(${r},${g},${b},${a});`;
  }
  if (hex.length === 6) return `background-color:#${hex};`;
  return "";
}

export function buildTableHtmlFromWorksheet(worksheet: ExcelJS.Worksheet): string {
  let rowCount = worksheet.rowCount ?? 0;
  let columnCount = worksheet.columnCount ?? 0;
  if (rowCount === 0 || columnCount === 0) {
    let maxRow = 0;
    let maxCol = 0;
    worksheet.eachRow({ includeEmpty: true }, (row: ExcelJS.Row, rowNumber: number) => {
      maxRow = Math.max(maxRow, rowNumber);
      row.eachCell({ includeEmpty: true }, (_cell: ExcelJS.Cell, colNumber: number) => {
        maxCol = Math.max(maxCol, colNumber);
      });
    });
    rowCount = maxRow || 1;
    columnCount = maxCol || 1;
  }
  const { covered, master } = buildMergeMaps(worksheet);
  const colWidths: number[] = [];
  for (let c = 1; c <= columnCount; c++) {
    const col = worksheet.getColumn(c);
    colWidths.push(excelColWidthToPx(col.width));
  }
  const colgroup =
    colWidths.length > 0
      ? `<colgroup>${colWidths.map((px) => `<col style="width:${px}px;min-width:${px}px">`).join("")}</colgroup>`
      : "";
  const rows: string[] = [];
  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= columnCount; c++) {
      if (covered.has(`${r},${c}`)) continue;

      const cell = row.getCell(c);
      const tag = r === 1 ? "th" : "td";
      const text = readExcelJsCellValue(cell);
      const bgStyle = getCellBackgroundStyle(cell);
      const styleAttr = bgStyle ? ` style="${bgStyle}"` : "";
      const dataAttr = ` data-excel-row="${r - 1}" data-excel-col="${c - 1}"`;

      const m = master.get(`${r},${c}`);
      let spanAttr = "";
      if (m) {
        if (m.rowspan > 1) spanAttr += ` rowspan="${m.rowspan}"`;
        if (m.colspan > 1) spanAttr += ` colspan="${m.colspan}"`;
      }

      cells.push(`<${tag}${spanAttr}${dataAttr}${styleAttr}>${escapeHtml(text)}</${tag}>`);
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table>${colgroup}${rows.join("")}</table>`;
}

export function injectImagesIntoTableHtml(html: string, cellToImages: Map<string, CellImageData[]>): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return html;
  const imgStyle = `max-width:min(100%,${EXCEL_PREVIEW_CELL_IMAGE_MAX_WIDTH_PX}px);max-height:${EXCEL_PREVIEW_CELL_IMAGE_MAX_HEIGHT_PX}px;width:auto;height:auto;object-fit:contain;display:block;vertical-align:middle;`;
  let rowIdx = 0;
  table.querySelectorAll("tr").forEach((tr) => {
    let colIdx = 0;
    tr.querySelectorAll("td, th").forEach((cell) => {
      const er = cell.getAttribute("data-excel-row");
      const ec = cell.getAttribute("data-excel-col");
      const key = er != null && ec != null ? `${er},${ec}` : `${rowIdx},${colIdx}`;
      const images = cellToImages.get(key);
      if (images?.length) {
        images.forEach((data, i) => {
          if (i > 0) cell.appendChild(doc.createElement("br"));
          const img = doc.createElement("img");
          img.setAttribute("src", data.url);
          img.setAttribute("alt", "");
          img.setAttribute("class", "xlsx-cell-image");
          img.setAttribute("style", imgStyle);
          cell.appendChild(img);
        });
      }
      colIdx++;
    });
    rowIdx++;
  });
  return table.outerHTML;
}

export type ExcelHtmlPreviewResult = {
  html: string;
  /** Revoke with URL.revokeObjectURL when discarding preview */
  objectUrls: string[];
};

/**
 * Build sanitised HTML for the first worksheet + embedded images (object URLs).
 */
export async function buildExcelHtmlJournalPreview(
  arrayBuffer: ArrayBuffer,
  worksheet: ExcelJS.Worksheet,
): Promise<ExcelHtmlPreviewResult> {
  const objectUrls: string[] = [];
  let html = buildTableHtmlFromWorksheet(worksheet);
  const cellToImages = new Map<string, CellImageData[]>();
  try {
    await extractImagesFromZip(arrayBuffer, cellToImages, objectUrls);
  } catch {
    /* images optional */
  }
  html = injectImagesIntoTableHtml(html, cellToImages);
  return { html, objectUrls };
}
