import { STRATEGY_TAXONOMY_V2_OPTIONS } from "@/lib/pcdi/strategy-taxonomy-v2-labels";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

function normalizeStrategyCellText(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s*->\s*/g, " → ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map a bare code (`R7`, `R7.2`, `r1.1`) to exactly one taxonomy leaf. */
function resolveStrategyCodeToLabel(code: string): string | null {
  const lc = code.toLowerCase();
  const candidates = STRATEGY_TAXONOMY_V2_OPTIONS.filter((opt) => {
    const o = opt.toLowerCase();
    return o === lc || o.startsWith(`${lc} `) || o.startsWith(`${lc}.`);
  });
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;
  return candidates.sort(
    (a, b) =>
      STRATEGY_TAXONOMY_V2_OPTIONS.indexOf(a as (typeof STRATEGY_TAXONOMY_V2_OPTIONS)[number]) -
      STRATEGY_TAXONOMY_V2_OPTIONS.indexOf(b as (typeof STRATEGY_TAXONOMY_V2_OPTIONS)[number]),
  )[0]!;
}

const R_CODE_RE = /\b(R\d+(?:\.\d+)?)\b/gi;

/** Match `R1.1 …` at start of cell text. */
function matchTaxonomyByLeadingCode(p: string): string | null {
  const m = p.match(/^(R\d+(?:\.\d+)?)\b/i);
  if (!m) return null;
  return resolveStrategyCodeToLabel(m[1]!);
}

/** First R-code anywhere in prose (e.g. “per R4.1 …”). */
function matchTaxonomyByCodeAnywhere(p: string): string | null {
  R_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = R_CODE_RE.exec(p)) !== null) {
    const label = resolveStrategyCodeToLabel(m[1]!);
    if (label) return label;
  }
  return null;
}

/**
 * Maps Billie / spreadsheet / `response_strategy` cell text onto canonical strategy_taxonomy_v2
 * labels so dropdown highlighting (`options.includes`) succeeds.
 */
export function canonicalTaxonomyStrategyLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p0 = normalizeStrategyCellText(raw);
  if (!p0) return null;
  p0 = p0.replace(/^\s*(?:\d+[.)]\s*)+/, "").replace(/^\s*(?:strategy|response)\s*:\s*/i, "");

  const exact = STRATEGY_TAXONOMY_V2_OPTIONS.find((t) => t === p0);
  if (exact) return exact;

  const ci = STRATEGY_TAXONOMY_V2_OPTIONS.find((t) => t.toLowerCase() === p0.toLowerCase());
  if (ci) return ci;

  const byCodeStart = matchTaxonomyByLeadingCode(p0);
  if (byCodeStart) return byCodeStart;

  const byCodeAny = matchTaxonomyByCodeAnywhere(p0);
  if (byCodeAny) return byCodeAny;

  const partial = STRATEGY_TAXONOMY_V2_OPTIONS.find((t) => p0.includes(t) || t.includes(p0));
  if (partial) return partial;

  const folded = p0.replace(/\s*→\s*/g, " ").replace(/\s+/g, " ");
  if (folded !== p0) {
    const partial2 = STRATEGY_TAXONOMY_V2_OPTIONS.find((t) => folded.includes(t) || t.includes(folded));
    if (partial2) return partial2;
  }

  return null;
}

/** Collect every R-code in free text (multiple strategies in one cell). */
function addAllResolvedCodesFromText(blob: string, into: Set<string>): void {
  R_CODE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = R_CODE_RE.exec(blob)) !== null) {
    const label = resolveStrategyCodeToLabel(m[1]!);
    if (label) into.add(label);
  }
}

/**
 * All taxonomy v2 labels implied by a `response_strategy` cell: comma/semicolon-separated lists,
 * multiple R-codes in one phrase, etc. (Unlike {@link canonicalTaxonomyStrategyLabel}, never stops at the first match.)
 */
export function allCanonicalTaxonomyStrategyLabels(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const blob0 = normalizeStrategyCellText(raw);
  if (!blob0) return [];
  const set = new Set<string>();

  for (const part of blob0
    .split(/[;\n|,\/]+/)
    .map((x) => x.trim())
    .filter(Boolean)) {
    const one = canonicalTaxonomyStrategyLabel(part);
    if (one) set.add(one);
  }

  addAllResolvedCodesFromText(blob0, set);

  return sortStrategiesByTaxonomyOrder([...set]);
}

export function sortStrategiesByTaxonomyOrder(labels: string[]): string[] {
  const rank = (s: string) => {
    const i = STRATEGY_TAXONOMY_V2_OPTIONS.indexOf(s as (typeof STRATEGY_TAXONOMY_V2_OPTIONS)[number]);
    return i === -1 ? 9999 : i;
  };
  return [...labels].sort((a, b) => rank(a) - rank(b));
}

function unionResponseStrategyTaxonomy(rows: HistoricalDefectTableRow[]): string[] {
  const set = new Set<string>();
  const opts = STRATEGY_TAXONOMY_V2_OPTIONS as readonly string[];
  for (const r of rows) {
    for (const s of r.responseStrategyTaxonomy ?? []) {
      const label = canonicalTaxonomyStrategyLabel(s);
      if (label) set.add(label);
      else if (opts.includes(s)) set.add(s);
    }
  }
  return sortStrategiesByTaxonomyOrder([...set]);
}

export type StrategySuggestionSplit = {
  /** Canonical labels from the `response_strategy` column only (`responseStrategyTaxonomy`). */
  dataSuggested: string[];
};

/** Bulk / category sidebar: strategies from `response_strategy` on rows in this category. */
export function getCategoryStrategySuggestionSplit(rows: HistoricalDefectTableRow[]): StrategySuggestionSplit {
  return { dataSuggested: unionResponseStrategyTaxonomy(rows) };
}

/** Per-row picker in the sidebar. */
export function getRowStrategySuggestionSplit(row: HistoricalDefectTableRow): StrategySuggestionSplit {
  const raw = row.responseStrategyTaxonomy ?? [];
  const labels = raw
    .map((s) => canonicalTaxonomyStrategyLabel(s))
    .filter((s): s is string => s != null && s.length > 0);
  return {
    dataSuggested: sortStrategiesByTaxonomyOrder([...new Set(labels)]),
  };
}
