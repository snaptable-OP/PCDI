import type { PcdiRfEdge, PcdiRfNode } from "./store";

/** All nodes reachable from a defect: downstream responses (correlation) then references (reference_link). */
export function expandDefectCluster(defectNodeId: string, edges: PcdiRfEdge[]): Set<string> {
  const cluster = new Set<string>([defectNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of edges) {
      const kind = e.data?.kind ?? "correlation";
      if (!cluster.has(e.source)) continue;
      if (cluster.has(e.target)) continue;
      if (kind === "correlation" || kind === "reference_link") {
        cluster.add(e.target);
        changed = true;
      }
    }
  }
  return cluster;
}

/** Focus set when user selects any node — defect-centric cluster when possible. */
export function clusterFocusNodeIds(
  seedNodeId: string,
  nodes: PcdiRfNode[],
  edges: PcdiRfEdge[],
): Set<string> {
  const node = nodes.find((n) => n.id === seedNodeId);
  if (!node) return new Set();

  if (node.data.kind === "defect_category") {
    return expandDefectCluster(seedNodeId, edges);
  }

  if (node.data.kind === "response_category") {
    const incomingDefect = edges.find(
      (e) => e.target === seedNodeId && (e.data?.kind ?? "correlation") === "correlation",
    );
    if (incomingDefect?.source) {
      return expandDefectCluster(incomingDefect.source, edges);
    }
    return new Set([seedNodeId]);
  }

  if (node.data.kind === "reference_doc") {
    const incomingResp = edges.find(
      (e) => e.target === seedNodeId && e.data?.kind === "reference_link",
    );
    if (incomingResp?.source) {
      return clusterFocusNodeIds(incomingResp.source, nodes, edges);
    }
    return new Set([seedNodeId]);
  }

  return new Set([seedNodeId]);
}

export function defectClusterRoots(nodes: PcdiRfNode[]): PcdiRfNode[] {
  return nodes.filter((n) => n.data.kind === "defect_category").sort((a, b) =>
    a.data.label.localeCompare(b.data.label),
  );
}
