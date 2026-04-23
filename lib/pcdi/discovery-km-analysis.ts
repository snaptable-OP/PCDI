import type { HistoricalDefectTableRow } from "./types";

export function normalizeCategoryKey(s: string): string {
  return s.trim().toLowerCase();
}

export type KmPartitionSide = {
  /** Display labels that match an existing knowledge-map category (case-insensitive). */
  matched: string[];
  /** Display labels not yet on the knowledge map. */
  novel: string[];
};

export type RegisterKmPartition = {
  defect: KmPartitionSide;
  response: KmPartitionSide;
};

function collectUniqueDisplayByKey(
  rows: HistoricalDefectTableRow[],
  field: "defectCategory" | "responseCategory",
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows) {
    const raw = r[field]?.trim();
    if (!raw) continue;
    const key = normalizeCategoryKey(raw);
    if (!map.has(key)) map.set(key, raw);
  }
  return map;
}

/**
 * Compare defect-register category strings to labels already present on the graph store
 * (defect_category / response_category nodes).
 */
export function partitionRegisterAgainstKnowledgeMap(
  rows: HistoricalDefectTableRow[],
  kmDefectKeys: Set<string>,
  kmResponseKeys: Set<string>,
): RegisterKmPartition {
  const defectMap = collectUniqueDisplayByKey(rows, "defectCategory");
  const responseMap = collectUniqueDisplayByKey(rows, "responseCategory");

  function split(map: Map<string, string>, kmKeys: Set<string>): KmPartitionSide {
    const matched: string[] = [];
    const novel: string[] = [];
    for (const [key, display] of map) {
      if (kmKeys.has(key)) matched.push(display);
      else novel.push(display);
    }
    matched.sort((a, b) => a.localeCompare(b));
    novel.sort((a, b) => a.localeCompare(b));
    return { matched, novel };
  }

  return {
    defect: split(defectMap, kmDefectKeys),
    response: split(responseMap, kmResponseKeys),
  };
}
