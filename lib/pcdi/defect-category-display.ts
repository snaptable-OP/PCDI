/**
 * Normalise defect category cells that Billie/Excel store as JSON, e.g.
 * `[{"id":"PF-07","name":"Unsealed speed panel..."}]` → display title only.
 */

function labelFromParsedCategory(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return null;
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        return labelFromParsedCategory(JSON.parse(t) as unknown);
      } catch {
        return t;
      }
    }
    return t;
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      const s = labelFromParsedCategory(item);
      if (s) parts.push(s);
    }
    return parts.length ? parts.join(" · ") : null;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const name = o.name ?? o.label ?? o.title ?? o.defectCategoryName;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

/** Spreadsheet / API string cell — may be plain text or JSON-encoded category payload. */
export function formatDefectCategoryString(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      const label = labelFromParsedCategory(parsed);
      if (label) return label;
    } catch {
      /* keep raw */
    }
  }
  return t;
}

/** Stable grouping/display key for a category field (never empty — use for aggregation keys). */
export function defectCategoryDisplayKey(raw: string): string {
  return formatDefectCategoryString(raw) || "Unclassified defect";
}

/** API row where category may be string or structured object. */
export function defectCategoryFromUnknown(raw: unknown): string {
  if (raw == null) return "Unclassified defect";
  if (typeof raw === "string") return defectCategoryDisplayKey(raw);
  const label = labelFromParsedCategory(raw);
  return label ?? "Unclassified defect";
}
