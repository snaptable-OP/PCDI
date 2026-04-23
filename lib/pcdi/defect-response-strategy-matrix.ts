import { hashString } from "@/lib/pcdi/hash";
import { STRATEGY_LABELS } from "@/lib/pcdi/strategy-labels";

/**
 * Defect category → candidate response strategies (mock matrix).
 * See also live correlation UI — no imports from mock-data to avoid circular bundles.
 */
export const DEFECT_CATEGORY_TO_RESPONSE_STRATEGIES: Record<string, string[]> = {
  "Water ingress — façade cavity": [
    "Citation of test reports / standards",
    "Evidence provided",
    "Compliant with design / code",
  ],
  "Fire stopping — service penetrations": [
    "Evidence provided",
    "Citation of test reports / standards",
    "Compliant with design / code",
    "Referred to engineer",
  ],
  "Acoustic bridging — party floor": [
    "Evidence provided",
    "Compliant with design / code",
    "Citation of test reports / standards",
  ],
  "Steel connection — bolt slip": [
    "Referred to engineer",
    "Evidence provided",
    "Citation of test reports / standards",
  ],
  "Curtain wall — gasket shrinkage": [
    "Compliant with design / code",
    "Citation of test reports / standards",
    "Evidence provided",
  ],
  "Finishes — cracking": [
    "Referred to engineer",
    "Evidence provided",
    "Compliant with design / code",
  ],
  "M&E — ventilation imbalance": [
    "Citation of test reports / standards",
    "Evidence provided",
    "Compliant with design / code",
  ],
  "Concrete — durability": [
    "Referred to engineer",
    "Evidence provided",
    "Citation of test reports / standards",
  ],
  "Unclassified defect": [...STRATEGY_LABELS.slice(0, 5)],
};

function diversifiedStrategies(seed: string, count = 5): string[] {
  const labels = [...STRATEGY_LABELS];
  const h = parseInt(hashString(seed).slice(0, 8), 16) || 0;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(labels[(h + i * 7) % labels.length]);
  }
  return [...new Set(out)];
}

/** Response strategies for a defect category (matrix + fallback pool). */
export function getCandidateStrategiesForDefectCategory(defectCategory: string): string[] {
  const key = defectCategory.trim();
  if (!key) return diversifiedStrategies("empty", 5);
  const direct = DEFECT_CATEGORY_TO_RESPONSE_STRATEGIES[key];
  if (direct && direct.length > 0) return [...direct];
  return diversifiedStrategies(key, 5);
}

export const NONE_APPLICABLE_STRATEGY = "N/A";

export function getDefaultResponseStrategyForDefectCategory(defectCategory: string): string {
  const pool = getCandidateStrategiesForDefectCategory(defectCategory);
  return pool[0] ?? NONE_APPLICABLE_STRATEGY;
}
