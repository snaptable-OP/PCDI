import type { HistoricalAiTarget, HistoricalColumnAiMapping } from "./types";

export function mapSessionStorageKey(projectId: string): string {
  return `pcdi-map-${projectId}`;
}

const VALID_HISTORICAL_AI_TARGETS: ReadonlySet<HistoricalAiTarget> = new Set([
  "ai_defect_category",
  "ai_response_category",
  "ai_reference_documents",
]);

/** Stable order for display and checkbox column. */
export const HISTORICAL_AI_TARGET_ORDER: HistoricalAiTarget[] = [
  "ai_defect_category",
  "ai_response_category",
  "ai_reference_documents",
];

export const HISTORICAL_AI_TARGET_OPTIONS: { id: HistoricalAiTarget; label: string }[] = [
  { id: "ai_defect_category", label: "Defect category (AI)" },
  { id: "ai_response_category", label: "Response category (AI)" },
  { id: "ai_reference_documents", label: "Reference documents (AI)" },
];

function dedupeInOrder(targets: HistoricalAiTarget[]): HistoricalAiTarget[] {
  return HISTORICAL_AI_TARGET_ORDER.filter((t) => targets.includes(t));
}

/**
 * Normalize a cell from session storage. Only **defect category** column selection is user-controlled;
 * response strategy and references are derived from the defect–response matrix (not mapped here).
 * Legacy saved flags for other targets are ignored.
 */
export function normalizeHistoricalTargetsFromRaw(raw: unknown): HistoricalAiTarget[] {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) {
    const out: HistoricalAiTarget[] = [];
    for (const item of raw) {
      if (typeof item === "string" && VALID_HISTORICAL_AI_TARGETS.has(item as HistoricalAiTarget)) {
        out.push(item as HistoricalAiTarget);
      }
    }
    const withDefect = dedupeInOrder(out).filter((t) => t === "ai_defect_category");
    return withDefect.length ? ["ai_defect_category"] : [];
  }
  if (typeof raw === "string") {
    if (raw === "unmapped") return [];
    if (raw === "defect_description" || raw === "ai_defect_category") return ["ai_defect_category"];
    if (raw === "historical_response" || raw === "ai_response_category") return [];
    if (raw === "reference_document_name" || raw === "ai_reference_documents") return [];
    return [];
  }
  return [];
}

export function mergeHistoricalAiMappingWithColumns(
  columns: string[],
  saved: HistoricalColumnAiMapping | Record<string, unknown> | null,
): HistoricalColumnAiMapping {
  const next: HistoricalColumnAiMapping = {};
  for (const col of columns) {
    const prev = saved?.[col];
    next[col] = normalizeHistoricalTargetsFromRaw(prev);
  }
  return next;
}

/**
 * At least one column must be selected for defect-category parsing; each column’s array is only
 * `['ai_defect_category']` or `[]` (enforced in UI and normalization).
 */
export function mappingMeetsHistoricalAiRules(
  mapping: HistoricalColumnAiMapping,
  columns: string[],
): boolean {
  if (columns.length === 0) return false;
  for (const c of columns) {
    const arr = mapping[c];
    if (!Array.isArray(arr)) return false;
    for (const t of arr) {
      if (t !== "ai_defect_category") return false;
    }
  }
  const flat = columns.flatMap((c) => mapping[c] ?? []);
  return flat.includes("ai_defect_category");
}

export function mappingMeetsLiveAiRules(
  mapping: HistoricalColumnAiMapping,
  columns: string[],
): boolean {
  return mappingMeetsHistoricalAiRules(mapping, columns);
}

export function readHistoricalAiColumnMapping(projectId: string): HistoricalColumnAiMapping | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(mapSessionStorageKey(projectId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data !== "object" || data === null) return null;
    return data as HistoricalColumnAiMapping;
  } catch {
    return null;
  }
}

export function writeHistoricalAiColumnMapping(
  projectId: string,
  mapping: HistoricalColumnAiMapping,
): void {
  sessionStorage.setItem(mapSessionStorageKey(projectId), JSON.stringify(mapping));
}

export function clearHistoricalAiColumnMappingSession(projectId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(mapSessionStorageKey(projectId));
}
