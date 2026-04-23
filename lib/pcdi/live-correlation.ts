import { hashString } from "@/lib/pcdi/hash";
import {
  getCandidateStrategiesForDefectCategory,
} from "@/lib/pcdi/defect-response-strategy-matrix";
import { getDiscoverySuggestions } from "@/lib/pcdi/mock-data";

export {
  DEFECT_CATEGORY_TO_RESPONSE_STRATEGIES,
  getCandidateStrategiesForDefectCategory,
  getDefaultResponseStrategyForDefectCategory,
  NONE_APPLICABLE_STRATEGY,
} from "@/lib/pcdi/defect-response-strategy-matrix";

const TAG_MAX = 3;

/** Short list of suggested strategies shown as colored tags on the live register (typically 2–3 items). */
export function getSuggestedStrategyTags(defectCategory: string): string[] {
  const pool = getCandidateStrategiesForDefectCategory(defectCategory);
  const uniq = [...new Set(pool)];
  const out = uniq.slice(0, TAG_MAX);
  if (out.length >= 2) return out;
  for (const p of pool) {
    if (!out.includes(p)) out.push(p);
    if (out.length >= 2) break;
  }
  return out.slice(0, TAG_MAX);
}

const KEYWORD_DEFECT_HINTS: ReadonlyArray<{ re: RegExp; label: string }> = [
  { re: /\b(water|ingress|damp|fa[cç]ade|facade|weathertight|cavity)\b/i, label: "Water ingress — façade cavity" },
  { re: /\b(fire\s*stopp|penetration|barrier|intumescent)\b/i, label: "Fire stopping — service penetrations" },
  { re: /\b(acoustic|Ln,w|party\s*floor|sound)\b/i, label: "Acoustic bridging — party floor" },
  { re: /\b(steel|bolt|splice|torque|connection)\b/i, label: "Steel connection — bolt slip" },
  { re: /\b(curtain\s*wall|gasket|cw\s*spec)\b/i, label: "Curtain wall — gasket shrinkage" },
  { re: /\b(MVHR|ventilation|condensation|duct)\b/i, label: "M&E — ventilation imbalance" },
  { re: /\b(crack|finishes|plaster)\b/i, label: "Finishes — cracking" },
  { re: /\b(concrete|carbon|durability)\b/i, label: "Concrete — durability" },
];

/**
 * Prototype “AI” top defect category per row: light keyword routing, else deterministic pick from discovery pool.
 */
export function mockTopDefectCategoryForRow(text: string, rowIndex: number, projectId: string): string {
  const t = text.trim();
  const pool = getDiscoverySuggestions(projectId).defectCategories.filter((c) => c.trim().length > 0);
  const fallback = pool.length > 0 ? pool : ["Unclassified defect"];
  for (const { re, label } of KEYWORD_DEFECT_HINTS) {
    if (re.test(t)) return label;
  }
  const h = parseInt(hashString(`${t}:${rowIndex}:${projectId}`).slice(0, 8), 16) || 0;
  return fallback[h % fallback.length];
}
