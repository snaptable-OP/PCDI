import type { PcdiRfEdge, PcdiRfNode } from "./store";

/**
 * Map connectivity score 0–100 from node/edge counts (mock density KPI).
 * Uses average undirected degree, capped against a nominal “full” degree of 5.
 */
export function graphMapDensityPercent(nodes: PcdiRfNode[], edges: PcdiRfEdge[]): number {
  const n = nodes.length;
  const e = edges.length;
  if (n === 0) return 0;
  const avgDegree = (2 * e) / n;
  return Math.min(100, Math.round((avgDegree / 5) * 100));
}

/** Mock rolled-up defect count derived from graph taxonomy size (no separate ingest DB). */
export function mockAggregateDefectTotal(nodes: PcdiRfNode[]): number {
  let defect = 0;
  let response = 0;
  let ref = 0;
  for (const node of nodes) {
    const k = node.data.kind;
    if (k === "defect_category") defect += 1;
    else if (k === "response_category") response += 1;
    else if (k === "reference_doc") ref += 1;
  }
  return defect * 24 + response * 9 + ref * 4;
}
