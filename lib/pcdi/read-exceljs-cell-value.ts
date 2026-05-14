import type ExcelJS from "exceljs";

/**
 * Stable string for ExcelJS `cell.value` (rich text, formula result, etc.).
 * Avoids `cell.text` which can throw when internal `_value` is null.
 */
export function readExcelJsCellValue(cell: ExcelJS.Cell): string {
  try {
    return readValue(cell.value as unknown);
  } catch {
    return "";
  }
}

function readValue(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isNaN(t) ? "" : v.toISOString().slice(0, 10);
  }
  if (typeof v !== "object") return String(v);

  const o = v as Record<string, unknown>;

  if (Array.isArray(o.richText)) {
    return (o.richText as { text?: string }[]).map((x) => (typeof x?.text === "string" ? x.text : "")).join("");
  }
  if (typeof o.text === "string") return o.text;
  if ("result" in o) return readValue(o.result);
  if (typeof o.error === "string") return `#${o.error}`;
  if (typeof o.hyperlink === "string") return o.hyperlink;
  if (o.hyperlink && typeof o.hyperlink === "object" && typeof (o.hyperlink as { text?: string }).text === "string") {
    return (o.hyperlink as { text: string }).text;
  }
  return "";
}
