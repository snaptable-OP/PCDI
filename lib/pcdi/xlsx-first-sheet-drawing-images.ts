import JSZip from "jszip";

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWING_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";

const EMU_PER_INCH = 914400;

/** Fallback when OOXML column / row metrics are missing (`excel-sheet-row-preview.tsx`). */
export const PREVIEW_GRID = {
  rowHeaderPx: 40,
  dataColPx: 96,
  rowHeightPx: 26,
} as const;

export function emuToPx(emu: number): number {
  return (emu / EMU_PER_INCH) * 96;
}

/** SpreadsheetML column width (character units) → px — ECMA-376 / Excel digit-width heuristic (MDW ≈ 7). */
export function excelColWidthCharsToPx(wch: number): number {
  if (!Number.isFinite(wch) || wch <= 0) return PREVIEW_GRID.dataColPx;
  const px = Math.round(Math.floor((256 * wch + Math.floor(128 / 7)) / 256) * 7);
  return Math.max(28, px);
}

/** Points → CSS px at 96dpi */
export function excelRowHeightPointsToPx(pt: number): number {
  if (!Number.isFinite(pt) || pt <= 0) return PREVIEW_GRID.rowHeightPx;
  return Math.max(14, Math.round((pt * 96) / 72));
}

/** Parsed from first-sheet worksheet XML so overlays line up with table cells. */
export type SheetGridMetrics = {
  rowHeaderPx: number;
  /** Pixel width for OOXML column indices 0 … length−1 (Excel columns A …). */
  colWidthsPx: number[];
  defaultRowHeightPx: number;
  /** 1-based worksheet row → height px when `<row ht="…"/>` is set. */
  rowHeightsPx: Map<number, number>;
};

export function createUniformPreviewGrid(maxCols: number): SheetGridMetrics {
  return {
    rowHeaderPx: PREVIEW_GRID.rowHeaderPx,
    colWidthsPx: Array.from({ length: maxCols }, () => PREVIEW_GRID.dataColPx),
    defaultRowHeightPx: PREVIEW_GRID.rowHeightPx,
    rowHeightsPx: new Map(),
  };
}

async function parseSheetGridFromZip(
  zip: JSZip,
  sheetPath: string,
  maxCols: number,
): Promise<SheetGridMetrics> {
  const text = await zip.file(sheetPath)?.async("string");
  if (!text) return createUniformPreviewGrid(maxCols);

  const doc = new DOMParser().parseFromString(text, "text/xml");
  const sheetFormat = doc.getElementsByTagName("sheetFormatPr")[0];
  let defaultRowHeightPt = 15;
  let defaultColWidthChars = 8.43;
  if (sheetFormat) {
    const dr = sheetFormat.getAttribute("defaultRowHeight");
    if (dr) {
      const v = parseFloat(dr);
      if (Number.isFinite(v) && v > 0) defaultRowHeightPt = v;
    }
    const dc = sheetFormat.getAttribute("defaultColWidth");
    if (dc) {
      const v = parseFloat(dc);
      if (Number.isFinite(v) && v > 0) defaultColWidthChars = v;
    }
  }

  const defaultRowHeightPx = excelRowHeightPointsToPx(defaultRowHeightPt);
  const defaultColWidthPx = excelColWidthCharsToPx(defaultColWidthChars);
  const colWidthsPx = Array.from({ length: maxCols }, () => defaultColWidthPx);

  const colsParent = doc.getElementsByTagName("cols")[0];
  if (colsParent) {
    for (let ci = 0; ci < colsParent.children.length; ci++) {
      const col = colsParent.children[ci];
      if (col.localName !== "col") continue;
      const min = parseInt(col.getAttribute("min") || "1", 10);
      const max = parseInt(col.getAttribute("max") || String(min), 10);
      const wAttr = col.getAttribute("width");
      if (wAttr == null || wAttr === "") continue;
      const wch = parseFloat(wAttr);
      if (!Number.isFinite(wch) || wch <= 0) continue;
      const px = excelColWidthCharsToPx(wch);
      for (let j = min; j <= max; j++) {
        const idx = j - 1;
        if (idx >= 0 && idx < maxCols) colWidthsPx[idx] = px;
      }
    }
  }

  const rowHeightsPx = new Map<number, number>();
  const sheetData = doc.getElementsByTagName("sheetData")[0];
  if (sheetData) {
    for (let ri = 0; ri < sheetData.children.length; ri++) {
      const rowEl = sheetData.children[ri];
      if (rowEl.localName !== "row") continue;
      const r = parseInt(rowEl.getAttribute("r") || "0", 10);
      if (r < 1 || !Number.isFinite(r)) continue;
      const ht = rowEl.getAttribute("ht");
      if (ht == null) continue;
      const pt = parseFloat(ht);
      if (Number.isFinite(pt) && pt > 0) {
        rowHeightsPx.set(r, excelRowHeightPointsToPx(pt));
      }
    }
  }

  return {
    rowHeaderPx: PREVIEW_GRID.rowHeaderPx,
    colWidthsPx,
    defaultRowHeightPx,
    rowHeightsPx,
  };
}

function rowHeightAt(metrics: SheetGridMetrics, row1: number): number {
  return metrics.rowHeightsPx.get(row1) ?? metrics.defaultRowHeightPx;
}

function buildColEdges(metrics: SheetGridMetrics, maxCols: number): number[] {
  const edge = new Array<number>(maxCols + 1);
  edge[0] = 0;
  for (let c = 0; c < maxCols; c++) {
    const w = metrics.colWidthsPx[c] ?? PREVIEW_GRID.dataColPx;
    edge[c + 1] = edge[c] + w;
  }
  return edge;
}

function buildRowTops(metrics: SheetGridMetrics, maxRow: number): number[] {
  const top = new Array<number>(maxRow + 2);
  top[1] = 0;
  let acc = 0;
  for (let r = 1; r <= maxRow; r++) {
    top[r] = acc;
    acc += rowHeightAt(metrics, r);
  }
  top[maxRow + 1] = acc;
  return top;
}

export type ParsedSheetImage = {
  blob: Blob;
  mime: string;
  /** OOXML col index (0 = column A); horizontal layout matches ExcelJS column numbers − 1. */
  fromCol: number;
  fromColOffEmu: number;
  /** 1-based worksheet row (converted from OOXML 0-based markers). */
  fromRow: number;
  fromRowOffEmu: number;
  toCol: number;
  toColOffEmu: number;
  /** 1-based worksheet row. */
  toRow: number;
  toRowOffEmu: number;
  kind: "twoCell" | "oneCell" | "absolute";
  /** oneCell / absolute size */
  cxEmu?: number;
  cyEmu?: number;
  absXEmu?: number;
  absYEmu?: number;
};

function numChild(parent: Element | null, local: string): number {
  if (!parent) return 0;
  for (const c of parent.children) {
    if (c.localName === local) return parseInt(c.textContent?.trim() || "0", 10) || 0;
  }
  return 0;
}

function readFromTo(anchor: Element): {
  fromCol: number;
  fromColOffEmu: number;
  fromRow: number;
  fromRowOffEmu: number;
  toCol: number;
  toColOffEmu: number;
  toRow: number;
  toRowOffEmu: number;
} {
  let fromEl: Element | null = null;
  let toEl: Element | null = null;
  for (const c of anchor.children) {
    if (c.localName === "from") fromEl = c as Element;
    if (c.localName === "to") toEl = c as Element;
  }
  return {
    fromCol: numChild(fromEl, "col"),
    fromColOffEmu: numChild(fromEl, "colOff"),
    fromRow: numChild(fromEl, "row"),
    fromRowOffEmu: numChild(fromEl, "rowOff"),
    toCol: numChild(toEl, "col"),
    toColOffEmu: numChild(toEl, "colOff"),
    toRow: numChild(toEl, "row"),
    toRowOffEmu: numChild(toEl, "rowOff"),
  };
}

function findPicBlipEmbed(anchor: Element): string | null {
  const walk = (node: Element): string | null => {
    if (node.localName === "blip") {
      const id =
        node.getAttributeNS(REL_NS, "embed") ||
        [...node.attributes].find((a) => a.localName === "embed")?.value ||
        null;
      if (id) return id;
    }
    for (const c of node.children) {
      const x = walk(c as Element);
      if (x) return x;
    }
    return null;
  };
  for (const c of anchor.getElementsByTagName("*")) {
    if (c.localName === "pic") return walk(c as Element);
  }
  return walk(anchor);
}

function extCxCy(anchor: Element): { cx: number; cy: number } {
  for (const el of anchor.getElementsByTagName("*")) {
    if (el.localName === "ext") {
      const cx = parseInt(el.getAttribute("cx") || "0", 10) || 0;
      const cy = parseInt(el.getAttribute("cy") || "0", 10) || 0;
      if (cx || cy) return { cx, cy };
    }
  }
  return { cx: 0, cy: 0 };
}

function absPos(anchor: Element): { x: number; y: number; cx: number; cy: number } {
  for (const el of anchor.getElementsByTagName("*")) {
    if (el.localName === "pos") {
      const x = parseInt(el.getAttribute("x") || "0", 10) || 0;
      const y = parseInt(el.getAttribute("y") || "0", 10) || 0;
      const ext = el.nextElementSibling;
      let cx = 0;
      let cy = 0;
      if (ext?.localName === "ext") {
        cx = parseInt(ext.getAttribute("cx") || "0", 10) || 0;
        cy = parseInt(ext.getAttribute("cy") || "0", 10) || 0;
      }
      return { x, y, cx, cy };
    }
  }
  return { x: 0, y: 0, cx: 0, cy: 0 };
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

/** Fallback: lowest sheetN.xml under xl/worksheets/. */
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

async function drawingPathFromSheet(zip: JSZip, sheetPath: string): Promise<string | null> {
  const relPath = sheetToRelsPath(sheetPath);
  if (!relPath) return null;
  const text = await zip.file(relPath)?.async("string");
  if (!text) return null;
  const doc = new DOMParser().parseFromString(text, "text/xml");
  for (const rel of doc.getElementsByTagName("Relationship")) {
    const typ = rel.getAttribute("Type") ?? "";
    if (typ !== DRAWING_REL_TYPE && !typ.endsWith("/drawing")) continue;
    let t = rel.getAttribute("Target") ?? "";
    t = t.replace(/^\//, "");
    if (t.startsWith("../")) t = `xl/${t.slice(3)}`;
    else if (!t.startsWith("xl/")) t = `xl/drawings/${t}`;
    return t;
  }
  return null;
}

function mimeFromPath(p: string): string {
  const lower = p.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

async function loadDrawingRelMap(zip: JSZip, drawingXmlPath: string): Promise<Map<string, string>> {
  const m = drawingXmlPath.match(/^xl\/drawings\/(.+)\.xml$/i);
  const relFile = m ? `xl/drawings/_rels/${m[1]}.xml.rels` : "";
  const map = new Map<string, string>();
  if (!relFile) return map;
  const text = await zip.file(relFile)?.async("string");
  if (!text) return map;
  const doc = new DOMParser().parseFromString(text, "text/xml");
  for (const rel of doc.getElementsByTagName("Relationship")) {
    const id = rel.getAttribute("Id");
    let target = rel.getAttribute("Target") ?? "";
    if (!id) continue;
    target = target.replace(/^\//, "");
    if (target.startsWith("../")) target = `xl/${target.slice(3)}`;
    else if (!target.startsWith("xl/")) target = `xl/${target}`;
    map.set(id, target);
  }
  return map;
}

async function blobForEmbed(
  zip: JSZip,
  relMap: Map<string, string>,
  embedId: string,
): Promise<{ blob: Blob; mime: string } | null> {
  const target = relMap.get(embedId);
  if (!target) return null;
  const data = await zip.file(target)?.async("arraybuffer");
  if (!data) return null;
  const mime = mimeFromPath(target);
  return { blob: new Blob([data], { type: mime }), mime };
}

async function extractDrawingImagesFromZip(zip: JSZip, sheetPath: string): Promise<ParsedSheetImage[]> {
  const drawingPath = await drawingPathFromSheet(zip, sheetPath);
  if (!drawingPath) return [];

  const drawingXml = await zip.file(drawingPath)?.async("string");
  if (!drawingXml) return [];

  const relMap = await loadDrawingRelMap(zip, drawingPath);
  const doc = new DOMParser().parseFromString(drawingXml, "text/xml");
  const out: ParsedSheetImage[] = [];

  const anchors = [...doc.getElementsByTagName("*")].filter((el) =>
    ["twoCellAnchor", "oneCellAnchor", "absoluteAnchor"].includes(el.localName),
  );

  for (const anchor of anchors) {
    const embed = findPicBlipEmbed(anchor);
    if (!embed) continue;
    const loaded = await blobForEmbed(zip, relMap, embed);
    if (!loaded) continue;

    const kind =
      anchor.localName === "twoCellAnchor"
        ? "twoCell"
        : anchor.localName === "oneCellAnchor"
          ? "oneCell"
          : "absolute";

    if (kind === "twoCell") {
      const ft = readFromTo(anchor);
      // Drawing ML markers use 0-based row/col; Excel rows in this app are 1-based like ExcelJS.
      out.push({
        ...loaded,
        kind,
        fromCol: ft.fromCol,
        fromColOffEmu: ft.fromColOffEmu,
        fromRow: ft.fromRow + 1,
        fromRowOffEmu: ft.fromRowOffEmu,
        toCol: ft.toCol,
        toColOffEmu: ft.toColOffEmu,
        toRow: ft.toRow + 1,
        toRowOffEmu: ft.toRowOffEmu,
      });
      continue;
    }

    if (kind === "oneCell") {
      let fromEl: Element | null = null;
      for (const c of anchor.children) {
        if (c.localName === "from") fromEl = c as Element;
      }
      const fromCol = numChild(fromEl, "col");
      const fromColOffEmu = numChild(fromEl, "colOff");
      const fromRow = numChild(fromEl, "row");
      const fromRowOffEmu = numChild(fromEl, "rowOff");
      const { cx, cy } = extCxCy(anchor);
      out.push({
        ...loaded,
        kind,
        fromCol,
        fromColOffEmu,
        fromRow: fromRow + 1,
        fromRowOffEmu,
        toCol: fromCol,
        toColOffEmu: fromColOffEmu,
        toRow: fromRow + 1,
        toRowOffEmu: fromRowOffEmu,
        cxEmu: cx,
        cyEmu: cy,
      });
      continue;
    }

    const { x, y, cx, cy } = absPos(anchor);
    out.push({
      ...loaded,
      kind: "absolute",
      fromCol: 0,
      fromColOffEmu: 0,
      fromRow: 0,
      fromRowOffEmu: 0,
      toCol: 0,
      toColOffEmu: 0,
      toRow: 0,
      toRowOffEmu: 0,
      absXEmu: x,
      absYEmu: y,
      cxEmu: cx,
      cyEmu: cy,
    });
  }

  return out;
}

/** Drawing blobs + worksheet column/row metrics from the same first sheet (single zip parse). */
export async function extractFirstSheetPreview(
  buf: ArrayBuffer,
  maxCols: number,
): Promise<{ images: ParsedSheetImage[]; grid: SheetGridMetrics }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return { images: [], grid: createUniformPreviewGrid(maxCols) };
  }

  let sheetPath = await resolveWorkbookFirstSheetPath(zip);
  if (!sheetPath) sheetPath = fallbackSheetPath(zip);
  if (!sheetPath) {
    return { images: [], grid: createUniformPreviewGrid(maxCols) };
  }

  const [grid, images] = await Promise.all([
    parseSheetGridFromZip(zip, sheetPath, maxCols),
    extractDrawingImagesFromZip(zip, sheetPath),
  ]);

  return { images, grid };
}

/**
 * Extract anchored pictures linked from the first workbook sheet’s drawing part (SpreadsheetML).
 * Returns metadata + raw blobs for browser `URL.createObjectURL`.
 */
export async function extractFirstSheetDrawingImages(buf: ArrayBuffer): Promise<ParsedSheetImage[]> {
  const { images } = await extractFirstSheetPreview(buf, 48);
  return images;
}

export type PreviewImageOverlay = {
  key: string;
  blob: Blob;
  mime: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Map OOXML anchors to pixel positions over the preview table (first column = row labels). */
export function buildPreviewImageOverlays(
  images: ParsedSheetImage[],
  visibleStartRow: number,
  visibleEndRow: number,
  grid: SheetGridMetrics,
): PreviewImageOverlay[] {
  const maxCols = grid.colWidthsPx.length;
  const colEdges = buildColEdges(grid, maxCols);

  let maxRow = visibleEndRow + 50;
  for (const img of images) {
    if (img.kind !== "absolute") {
      maxRow = Math.max(maxRow, img.fromRow, img.toRow);
    } else {
      const yEmu = img.absYEmu ?? 0;
      const yPx = emuToPx(yEmu);
      const guess = Math.ceil(yPx / Math.max(8, grid.defaultRowHeightPx)) + 5;
      maxRow = Math.max(maxRow, guess, visibleEndRow);
    }
  }

  const rowTop = buildRowTops(grid, maxRow);
  const winTopPx = rowTop[visibleStartRow] ?? 0;
  const winBottomPx = (rowTop[visibleEndRow] ?? 0) + rowHeightAt(grid, visibleEndRow);

  const out: PreviewImageOverlay[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];

    if (img.kind === "absolute" && img.cxEmu != null && img.cyEmu != null) {
      const sheetLeftPx = emuToPx(img.absXEmu ?? 0);
      const sheetTopPx = emuToPx(img.absYEmu ?? 0);
      const width = Math.max(24, emuToPx(img.cxEmu));
      const height = Math.max(24, emuToPx(img.cyEmu));
      const sheetBottomPx = sheetTopPx + height;
      if (sheetBottomPx <= winTopPx || sheetTopPx >= winBottomPx) continue;
      out.push({
        key: `abs-${i}`,
        blob: img.blob,
        mime: img.mime,
        left: grid.rowHeaderPx + sheetLeftPx,
        top: sheetTopPx - winTopPx,
        width,
        height,
      });
      continue;
    }

    const bottomRow = img.kind === "twoCell" ? img.toRow : img.fromRow;
    const topRow = img.fromRow;
    if (bottomRow < visibleStartRow || topRow > visibleEndRow) continue;

    const fromC = Math.min(Math.max(0, img.fromCol), maxCols - 1);
    const toC = Math.min(Math.max(0, img.toCol), maxCols - 1);

    const leftPx = colEdges[fromC] + emuToPx(img.fromColOffEmu);
    const topPx = (rowTop[img.fromRow] ?? 0) + emuToPx(img.fromRowOffEmu);

    let width: number;
    let height: number;

    if (img.kind === "oneCell" && img.cxEmu != null && img.cyEmu != null) {
      width = Math.max(24, emuToPx(img.cxEmu));
      height = Math.max(24, emuToPx(img.cyEmu));
    } else if (img.kind === "twoCell") {
      const rightPx = colEdges[toC] + emuToPx(img.toColOffEmu);
      const botPx = (rowTop[img.toRow] ?? 0) + emuToPx(img.toRowOffEmu);
      width = Math.max(28, rightPx - leftPx);
      height = Math.max(24, botPx - topPx);
    } else {
      width = 120;
      height = 80;
    }

    const left = grid.rowHeaderPx + leftPx;
    const top = topPx - winTopPx;

    out.push({
      key: `anch-${i}-${img.fromRow}-${img.fromCol}`,
      blob: img.blob,
      mime: img.mime,
      left,
      top,
      width,
      height,
    });
  }

  return out;
}
