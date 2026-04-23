import { hashString } from "@/lib/pcdi/hash";
import { inferDocumentTypesFromCategoryAndStrategy } from "@/lib/pcdi/live-inferred-documents";

/** Plausible doc-control labels for prototype UI — replace with backend / model output. */
const MOCK_REFERENCE_LINES = [
  "NHBC Standards — Chapter 6.11 Weathertightness",
  "Approved Document B (Fire safety), paras 9–14",
  "BS EN 13501-1 reaction to fire — test evidence pack",
  "Manufacturer CW gasket test report TR-4412",
  "Structural engineer letter SE-REF-089",
  "Fire strategy drawing FS-03 (Rev 06)",
  "Commissioning certificate Cx-MVHR-12",
  "Approved Document L — energy efficiency evidence",
  "Drawing register Sheet A-117 façade details",
  "Witnessed hose test report HT-2024-07",
  "Site QA photographic record pack (snag closure)",
  "Approved Document F (Ventilation)",
];

function dedupeSemicolon(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.join("; ");
}

/**
 * References / Docs for live register: from **defect category + response strategy** (matrix-driven),
 * plus description citations and mock line variety for the prototype.
 */
export function buildLiveReferencesDocsColumn(opts: {
  projectId: string;
  rowIndex: number;
  defectCategory: string;
  /** From defect–response strategy matrix (default or user-selected on the register). */
  responseStrategy: string;
  extractedFromDescription: string;
}): string {
  const extracted = opts.extractedFromDescription.replace(/\s+/g, " ").trim();
  const fromMatrix = inferDocumentTypesFromCategoryAndStrategy(
    opts.defectCategory,
    opts.responseStrategy,
  );
  const h =
    parseInt(hashString(`${opts.projectId}:${opts.rowIndex}:${opts.defectCategory}`).slice(0, 8), 16) || 0;
  const m1 = MOCK_REFERENCE_LINES[h % MOCK_REFERENCE_LINES.length];
  const m2 = MOCK_REFERENCE_LINES[(h + 5) % MOCK_REFERENCE_LINES.length];
  return dedupeSemicolon([...fromMatrix, extracted, m1, m2]);
}
