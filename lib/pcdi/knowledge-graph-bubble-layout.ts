import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from "d3-force";
import type { SimulationNodeDatum } from "d3-force";
import type { PcdiRfEdge, PcdiRfNode } from "./store";

type SimNode = {
  id: string;
  kind: string;
  /** Collision radius — larger for defect “hub” bubbles */
  r: number;
} & SimulationNodeDatum;

type SimLink = {
  source: string;
  target: string;
  edgeKind: string;
};

/**
 * Force-directed bubble layout: defects spread on an outer ring, linked nodes pull together.
 * Deterministic enough for UX; re-run when graph topology changes.
 */
export function computeBubbleLayoutPositions(
  nodes: PcdiRfNode[],
  edges: PcdiRfEdge[],
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return out;

  const width = 1180;
  const height = 780;
  const cx = width / 2;
  const cy = height / 2;

  const defects = nodes.filter((n) => n.data.kind === "defect_category");
  const nDef = defects.length;

  const simNodes: SimNode[] = nodes.map((n, idx) => {
    let x = cx + (Math.random() - 0.5) * 40;
    let y = cy + (Math.random() - 0.5) * 40;

    if (n.data.kind === "defect_category" && nDef > 0) {
      const di = defects.findIndex((d) => d.id === n.id);
      const angle = (2 * Math.PI * di) / nDef - Math.PI / 2;
      const ring = 260 + (di % 4) * 35;
      x = cx + ring * Math.cos(angle);
      y = cy + ring * Math.sin(angle);
    }

    const r =
      n.data.kind === "defect_category"
        ? 56
        : n.data.kind === "response_category"
          ? 48
          : 42;

    return {
      id: n.id,
      kind: n.data.kind,
      r,
      x,
      y,
      index: idx,
    };
  });

  const simLinks: SimLink[] = edges.map((e) => ({
    source: e.source,
    target: e.target,
    edgeKind: e.data?.kind ?? "correlation",
  }));

  const linkForce = forceLink<SimNode, SimLink>(simLinks)
    .id((d) => d.id)
    .distance((l) => (l.edgeKind === "reference_link" ? 88 : 148))
    .strength((l) => (l.edgeKind === "reference_link" ? 0.62 : 0.52));

  const simulation = forceSimulation(simNodes)
    .force("link", linkForce)
    .force("charge", forceManyBody().strength(-420))
    .force("collide", forceCollide<SimNode>().radius((d) => d.r))
    .force("center", forceCenter(cx, cy));

  for (let i = 0; i < 480; i++) {
    simulation.tick();
  }
  simulation.stop();

  for (const sn of simNodes) {
    out.set(sn.id, { x: sn.x ?? cx, y: sn.y ?? cy });
  }

  return out;
}
