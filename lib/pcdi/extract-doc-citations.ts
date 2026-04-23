import { extractStandardLikeReferences } from "@/lib/pcdi/standard-references";

/**
 * Deduped, human-readable list of standard-like citations extracted from defect description (mock — replace with model output).
 */
export function extractDocCitationsFromDefectDescription(text: string): string {
  const matches = extractStandardLikeReferences(text);
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of matches) {
    const t = m.text.replace(/\s+/g, " ").trim();
    if (t.length < 2 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    ordered.push(t);
    if (ordered.length >= 14) break;
  }
  return ordered.join("; ");
}
