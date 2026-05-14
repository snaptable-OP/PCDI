import { defectCategoryDisplayKey } from "@/lib/pcdi/defect-category-display";
import { hashString } from "@/lib/pcdi/hash";
import { getLiveRegisterBaseRows } from "@/lib/pcdi/live-rows";
import { getLiveVisualisationDemoRows } from "@/lib/pcdi/live-visualisation-demo";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

export type CategoryAggregate = {
  id: string;
  categoryKey: string;
  /** Truncated display label */
  label: string;
  count: number;
  rows: HistoricalDefectTableRow[];
};

/** Register rows when present (upload / seed); otherwise rich demo graph mock so the page is never empty. */
export function getDefectRowsForVisualisation(
  projectId: string,
  defectFileId?: string | null,
): HistoricalDefectTableRow[] {
  const base = getLiveRegisterBaseRows(projectId, defectFileId);
  if (base.length > 0) return base;
  return getLiveVisualisationDemoRows(projectId);
}

/**
 * One entry per defect category: count and rows for sidebar / bulk strategy assignment.
 * Suitable for large registers (2000+ rows) because the graph plots categories only.
 */
export function aggregateDefectsByCategory(
  projectId: string,
  defectFileId?: string | null,
): CategoryAggregate[] {
  const rows = getDefectRowsForVisualisation(projectId, defectFileId);
  const map = new Map<string, HistoricalDefectTableRow[]>();

  for (const row of rows) {
    const key = defectCategoryDisplayKey(row.defectCategory);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }

  const out: CategoryAggregate[] = [];
  for (const [categoryKey, catRows] of map) {
    out.push({
      id: `hub:${hashString(categoryKey).slice(0, 18)}`,
      categoryKey,
      label: categoryKey.length > 44 ? `${categoryKey.slice(0, 42)}…` : categoryKey,
      count: catRows.length,
      rows: catRows,
    });
  }

  return out.sort((a, b) => b.count - a.count);
}
