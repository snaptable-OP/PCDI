import type {
  DiscoveryCategorySuggestion,
  EnrichedDefectRow,
  PcdiGraphEdge,
  PcdiGraphNode,
} from "./types";
import { hashString } from "./hash";
import { getDiscoverySuggestions } from "./mock-data";
import { extractStandardLikeReferences } from "./standard-references";

export { hashString } from "./hash";
export type { StandardReferenceMatch } from "./standard-references";
export { STANDARD_REFERENCE_PATTERNS, extractStandardLikeReferences } from "./standard-references";

/** True if text looks like it cites a formal standard (for prompt routing copy). */
export function textHasStandardLikeReferences(text: string): boolean {
  return extractStandardLikeReferences(text).length > 0;
}

/** Suggest discovery categories — seeded by project, no network. */
export function suggestDiscoveryCategories(projectId: string): DiscoveryCategorySuggestion {
  return getDiscoverySuggestions(projectId);
}

export type EnrichRowInput = Pick<
  EnrichedDefectRow,
  "id" | "defectDescription" | "historicalResponse" | "referenceDocumentName"
>;

/**
 * Fill category columns from graph labels using deterministic hash bucketing.
 * Picks nearest graph nodes by label similarity proxy (hash modulo).
 */
export function enrichRowsFromGraph(
  rows: EnrichRowInput[],
  nodes: PcdiGraphNode[],
  edges: PcdiGraphEdge[],
): EnrichedDefectRow[] {
  const defectNodes = nodes.filter((n) => n.data.kind === "defect_category");
  const responseNodes = nodes.filter((n) => n.data.kind === "response_category");
  const refNodes = nodes.filter((n) => n.data.kind === "reference_doc");

  return rows.map((row) => {
    const h = hashString(`${row.id}|${row.defectDescription}|${row.historicalResponse}`);
    const hi = parseInt(h.slice(0, 8), 16) || 0;

    const defectCategory =
      pickDefectCategory(row, defectNodes, hi) || "Unclassified defect";
    const responseCategory =
      pickResponseCategory(row, responseNodes, edges, defectNodes, hi) ||
      "General remediation";
    const referencesRequired = buildReferencesRequired(
      row,
      refNodes,
      edges,
      responseNodes,
      hi,
    );

    return {
      id: row.id,
      defectDescription: row.defectDescription,
      historicalResponse: row.historicalResponse,
      referenceDocumentName: row.referenceDocumentName,
      defectCategory,
      responseCategory,
      referencesRequired,
    };
  });
}

function pickDefectCategory(
  row: EnrichRowInput,
  defectNodes: PcdiGraphNode[],
  seed: number,
): string {
  if (defectNodes.length === 0) return "";
  const idx = seed % defectNodes.length;
  const sorted = [...defectNodes].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[idx]?.data.label ?? "";
}

function pickResponseCategory(
  row: EnrichRowInput,
  responseNodes: PcdiGraphNode[],
  edges: PcdiGraphEdge[],
  defectNodes: PcdiGraphNode[],
  seed: number,
): string {
  if (responseNodes.length === 0) return "";
  const sorted = [...responseNodes].sort((a, b) => a.id.localeCompare(b.id));

  const defectLabel = pickDefectCategory(row, defectNodes, seed);
  const defectNode = defectNodes.find((n) => n.data.label === defectLabel);

  if (defectNode) {
    const linked = edges
      .filter(
        (e) =>
          e.data?.kind === "correlation" &&
          (e.source === defectNode.id || e.target === defectNode.id),
      )
      .map((e) => (e.source === defectNode.id ? e.target : e.source));
    const responseIds = linked.filter((id) => sorted.some((n) => n.id === id));
    if (responseIds.length > 0) {
      const pick = responseIds[seed % responseIds.length];
      const node = sorted.find((n) => n.id === pick);
      if (node) return node.data.label;
    }
  }

  return sorted[seed % sorted.length]?.data.label ?? "";
}

function buildReferencesRequired(
  row: EnrichRowInput,
  refNodes: PcdiGraphNode[],
  edges: PcdiGraphEdge[],
  responseNodes: PcdiGraphNode[],
  seed: number,
): string {
  const parts: string[] = [];

  const fromRefs = extractStandardLikeReferences(
    `${row.referenceDocumentName}\n${row.historicalResponse}`,
  );
  if (fromRefs.length > 0) {
    parts.push(...fromRefs.slice(0, 3).map((x) => x.text));
  }

  if (refNodes.length > 0) {
    const sorted = [...refNodes].sort((a, b) => a.id.localeCompare(b.id));
    const r = sorted[seed % sorted.length];
    if (r && !parts.includes(r.data.label)) {
      parts.push(r.data.label);
    }
  }

  return parts.length > 0
    ? [...new Set(parts)].join("; ")
    : "Document search only — no graph references";
}
