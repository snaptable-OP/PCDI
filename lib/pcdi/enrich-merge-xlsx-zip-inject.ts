import JSZip from "jszip";

/** OOXML `rgb` on fgColor uses 8-hex AARRGGBB (same as Excel’s ARGB). */
const PROPOSED_FILL_RGB = "FFFFF2CC";

const PROPOSED_COLUMN_WIDTH_CHARS = 52;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function colNumberToLetters(n: number): string {
  let s = "";
  let c = Math.floor(n);
  while (c > 0) {
    const m = (c - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s || "A";
}

function colLettersToNum(letters: string): number {
  let n = 0;
  const u = letters.toUpperCase();
  for (let i = 0; i < u.length; i++) {
    n = n * 26 + (u.charCodeAt(i) - 64);
  }
  return n;
}

function parseCellRef(addr: string): { colL: string; row: number } {
  const m = addr.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return { colL: "A", row: 1 };
  return { colL: m[1].toUpperCase(), row: parseInt(m[2], 10) };
}

function findRelationshipTarget(relsXml: string, rid: string): string {
  const esc = rid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = relsXml.match(new RegExp(`<Relationship[^>]*\\bId="${esc}"[^>]*\\bTarget="([^"]+)"`, "i"));
  if (!m) {
    m = relsXml.match(new RegExp(`<Relationship[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${esc}"`, "i"));
  }
  if (!m) throw new Error(`workbook rels: could not resolve ${rid}`);
  return m[1].replace(/^\//, "");
}

/** First worksheet path inside the zip, e.g. `xl/worksheets/sheet1.xml`. */
export async function resolveFirstWorksheetPath(zip: JSZip): Promise<string> {
  const wb = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wb || !rels) throw new Error("Not a valid .xlsx (missing xl/workbook.xml or rels).");
  const sheetM = wb.match(/<sheet\b[^>]*\br:id="([^"]+)"/i);
  if (!sheetM) throw new Error("workbook.xml: no <sheet> entry.");
  const target = findRelationshipTarget(rels, sheetM[1]);
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function patchStylesXml(stylesXml: string): { xml: string; styleId: number } {
  const fillCountM = stylesXml.match(/<fills\b[^>]*\bcount="(\d+)"/i);
  if (!fillCountM) throw new Error("styles.xml: missing <fills count=…>.");
  const fillCount = parseInt(fillCountM[1], 10);
  const newFillId = fillCount;
  const newFill = `<fill><patternFill patternType="solid"><fgColor rgb="${PROPOSED_FILL_RGB}"/></patternFill></fill>`;
  let xml = stylesXml.replace(/<\/fills>/i, `${newFill}</fills>`);
  xml = xml.replace(/<fills(\s[^>]*?)\bcount="\d+"/i, (_, rest) => `<fills${rest}count="${fillCount + 1}"`);

  const xfsM = xml.match(/<cellXfs\b[^>]*\bcount="(\d+)"/i);
  if (!xfsM) throw new Error("styles.xml: missing <cellXfs count=…>.");
  const xfsCount = parseInt(xfsM[1], 10);
  const newStyleId = xfsCount;
  const newXf = `<xf numFmtId="0" fontId="0" fillId="${newFillId}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top" horizontal="left"/></xf>`;
  xml = xml.replace(/<\/cellXfs>/i, `${newXf}</cellXfs>`);
  xml = xml.replace(/<cellXfs(\s[^>]*?)\bcount="\d+"/i, (_, rest) => `<cellXfs${rest}count="${xfsCount + 1}"`);

  return { xml, styleId: newStyleId };
}

function ensureColWidth(sheetXml: string, col1Based: number, width: number): string {
  const colEl = `<col min="${col1Based}" max="${col1Based}" width="${width}" customWidth="1"/>`;
  if (/<cols[\s>]/i.test(sheetXml)) {
    return sheetXml.replace(/<cols([^>]*)>/i, `<cols$1>${colEl}`);
  }
  return sheetXml.replace(/(<sheetFormatPr\b[^>]*\/>)/i, `$1<cols>${colEl}</cols>`);
}

function computeExpandedRef(oldRef: string, newColLetters: string, lastDataRow: number): string {
  const parts = oldRef.split(":").map((p) => p.trim());
  if (parts.length === 2) {
    const tl = parseCellRef(parts[0]);
    const br = parseCellRef(parts[1]);
    const maxC = Math.max(colLettersToNum(tl.colL), colLettersToNum(br.colL), colLettersToNum(newColLetters));
    const maxR = Math.max(tl.row, br.row, lastDataRow);
    return `${tl.colL}${tl.row}:${colNumberToLetters(maxC)}${maxR}`;
  }
  const p = parseCellRef(parts[0]);
  const maxC = Math.max(colLettersToNum(p.colL), colLettersToNum(newColLetters));
  const maxR = Math.max(p.row, lastDataRow);
  return `${p.colL}${p.row}:${colNumberToLetters(maxC)}${maxR}`;
}

function patchDimensionTag(sheetXml: string, newColLetters: string, lastRow: number): string {
  return sheetXml.replace(/<dimension\b[^>]*\/>/i, (tag) => {
    const m = tag.match(/\bref="([^"]+)"/i);
    const oldRef = m ? m[1] : "A1";
    const newRef = computeExpandedRef(oldRef, newColLetters, lastRow);
    return `<dimension ref="${newRef}"/>`;
  });
}

function cellXml(addr: string, styleId: number, text: string | null): string {
  if (text != null && text.length > 0) {
    return `<c r="${addr}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
  }
  return `<c r="${addr}" s="${styleId}"/>`;
}

/** OOXML allows `r="6"` or `r='6'` and attribute order varies; rows can be omitted when empty (sparse sheet). */
function rowTagRegex(rowNum: number): RegExp {
  return new RegExp(
    `(<row\\b[^>]*\\br\\s*=\\s*["']${rowNum}["'][^>]*>)([\\s\\S]*?)(</row>)`,
    "i",
  );
}

/**
 * Inserts `<row r="…">…</row>` into `sheetData` when that row index is missing (common sparse OOXML).
 */
function insertRowInSheetData(sheetXml: string, rowNum: number, cellXml: string): string {
  const rowBlock = `<row r="${rowNum}">${cellXml}</row>`;
  const replaced = sheetXml.replace(
    /(<sheetData\b[^>]*>)([\s\S]*?)(<\/sheetData>)/i,
    (_full, open: string, body: string, close: string) => {
      let best = body.length;
      const re = /<row\b[^>]*\br\s*=\s*["'](\d+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(body)) !== null) {
        const nr = parseInt(m[1], 10);
        if (nr > rowNum && m.index < best) best = m.index;
      }
      if (best < body.length) {
        return `${open}${body.slice(0, best)}${rowBlock}${body.slice(best)}${close}`;
      }
      const lastRowEnd = body.lastIndexOf("</row>");
      if (lastRowEnd === -1) {
        return `${open}${rowBlock}${body}${close}`;
      }
      const after = lastRowEnd + "</row>".length;
      return `${open}${body.slice(0, after)}${rowBlock}${body.slice(after)}${close}`;
    },
  );
  if (replaced === sheetXml) {
    throw new Error("Worksheet has no <sheetData> block — cannot inject rows.");
  }
  return replaced;
}

function upsertRowCell(
  sheetXml: string,
  rowNum: number,
  colLetters: string,
  newCellXml: string,
  /** When false, missing `<row>` throws (avoids creating a header row that only has one cell). */
  allowInsertMissingRow = true,
): string {
  const rowRe = rowTagRegex(rowNum);
  const m = sheetXml.match(rowRe);
  const addr = `${colLetters}${rowNum}`;
  if (m) {
    const open = m[1];
    const inner = m[2];
    const close = m[3];
    const cellRe = new RegExp(
      `<c\\b[^>]*\\br\\s*=\\s*["']${addr}["']\\b[^/]*?(?:/>|>[\\s\\S]*?</c>)`,
      "i",
    );
    const nextInner = cellRe.test(inner) ? inner.replace(cellRe, newCellXml) : `${inner}${newCellXml}`;
    return sheetXml.replace(rowRe, `${open}${nextInner}${close}`);
  }
  if (!allowInsertMissingRow) {
    throw new Error(
      `Worksheet has no <row r="${rowNum}"> for the header row — file may use a different sheet or the header row setting does not match this workbook.`,
    );
  }
  return insertRowInSheetData(sheetXml, rowNum, newCellXml);
}

export type ZipInjectPatch = { sheetRow: number; proposedResponse: string };

/**
 * Injects / updates the “proposed response” column by editing OOXML inside the zip.
 * Original cells keep their existing `s="…"` style indices; only new cells use a new xf, so
 * Excel no longer shows bogus red from a full ExcelJS re-save.
 */
export async function injectProposedResponseIntoXlsxZip(
  input: ArrayBuffer,
  opts: {
    colLetters: string;
    col1Based: number;
    headerRow: number;
    patches: ZipInjectPatch[];
    /** Visible column title in row 1 (e.g. `Proposed Response [dd/mm/yyyy, HH:mm]`). */
    headerLabel: string;
  },
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(Buffer.from(input));
  const sheetPath = await resolveFirstWorksheetPath(zip);

  const stylesEntry = zip.file("xl/styles.xml");
  if (!stylesEntry) throw new Error("Missing xl/styles.xml");
  const { xml: stylesOut, styleId } = patchStylesXml(await stylesEntry.async("string"));
  zip.file("xl/styles.xml", stylesOut);

  const sheetEntry = zip.file(sheetPath);
  if (!sheetEntry) throw new Error(`Missing worksheet ${sheetPath}`);
  let sheetXml = await sheetEntry.async("string");
  if (!/<sheetData\b/i.test(sheetXml)) {
    throw new Error("Worksheet XML has no <sheetData> — unexpected .xlsx structure.");
  }

  const byRow = new Map<number, string>();
  for (const p of opts.patches) {
    const r = Math.floor(p.sheetRow);
    if (!Number.isFinite(r) || r < 1) continue;
    byRow.set(r, p.proposedResponse ?? "");
  }

  let lastRow = opts.headerRow;
  for (const r of byRow.keys()) lastRow = Math.max(lastRow, r);

  sheetXml = ensureColWidth(sheetXml, opts.col1Based, PROPOSED_COLUMN_WIDTH_CHARS);
  if (/<dimension\b[^>]*\/>/i.test(sheetXml)) {
    sheetXml = patchDimensionTag(sheetXml, opts.colLetters, lastRow);
  }

  const bodyRowNums = [...byRow.keys()]
    .filter((r) => r !== opts.headerRow)
    .sort((a, b) => a - b);
  for (const rowNum of bodyRowNums) {
    const text = byRow.get(rowNum) ?? "";
    const addr = `${opts.colLetters}${rowNum}`;
    const cx = cellXml(addr, styleId, text.trim().length > 0 ? text : null);
    sheetXml = upsertRowCell(sheetXml, rowNum, opts.colLetters, cx, true);
  }

  const headerAddr = `${opts.colLetters}${opts.headerRow}`;
  const hx = cellXml(headerAddr, styleId, opts.headerLabel);
  sheetXml = upsertRowCell(sheetXml, opts.headerRow, opts.colLetters, hx, false);

  zip.file(sheetPath, sheetXml);

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
  return Buffer.from(out);
}
