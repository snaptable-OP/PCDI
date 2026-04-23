/**
 * Regex bundle for “standard-like” citations (UK + international specs).
 * Standalone module (no mock-data) so downstream imports avoid circular deps.
 */
export const STANDARD_REFERENCE_PATTERNS = [
  /\bBS\s*EN\s*\d{4,5}(?:-\d+)?(?:\s*:\s*\d{4})?\b/gi,
  /\bBS\s*\d{4,5}(?:-\d+)?\b/gi,
  /\bEN\s*\d{4,5}(?:-\d+)?\b/gi,
  /\bISO\s*\d{4,5}(?:-\d+)?\b/gi,
  /\bPD\s*\d{4,5}(?:-\d+)?\b/gi,
  /\bNHBC\b\s*(?:Chapter\s*[\d.]+|ch\.?\s*[\d.]+)?/gi,
  /\bCIBSE\b\s*(?:Guide\s*)?[A-Z]*/gi,
  /\bApproved\s+Document\s+[A-Z]/gi,
] as const;

export type StandardReferenceMatch = {
  text: string;
  start: number;
  end: number;
};

/** Extract standard-like reference spans from free text. */
export function extractStandardLikeReferences(text: string): StandardReferenceMatch[] {
  const out: StandardReferenceMatch[] = [];
  for (const re of STANDARD_REFERENCE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) !== null) {
      const matched = m[0].trim();
      if (matched.length < 2) continue;
      out.push({
        text: matched,
        start: m.index,
        end: m.index + m[0].length,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
