"use client";

import "@xyflow/react/dist/style.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  type XYPosition,
} from "@xyflow/react";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import {
  categoryBubbleFill,
  MIND_MAP_BUBBLE_FILLS,
  mindMapBubbleFillForNodeId,
} from "@/lib/pcdi/mind-map-palette";
import { computeBubbleLayoutPositions } from "@/lib/pcdi/knowledge-graph-bubble-layout";
import {
  clusterFocusNodeIds,
  defectClusterRoots,
  expandDefectCluster,
} from "@/lib/pcdi/knowledge-graph-cluster";
import { usePcdiGraphStore, type PcdiRfEdge, type PcdiRfNode } from "@/lib/pcdi/store";
import { useGraphStoreHydrated } from "@/lib/pcdi/use-graph-store-hydrated";
import type { PcdiEdgeType, PcdiNodeData } from "@/lib/pcdi/types";

const NODE_STROKE = "#ffffff";

const NODE_SIZE: Record<PcdiNodeData["kind"], number> = {
  defect_category: 48,
  response_category: 44,
  reference_doc: 40,
};

function kindLabel(kind: PcdiNodeData["kind"]): string {
  switch (kind) {
    case "defect_category":
      return "Defect category";
    case "response_category":
      return "Response category";
    case "reference_doc":
      return "Reference";
    default:
      return "Node";
  }
}

/** All whitespace-separated terms must appear as substrings (case-insensitive). */
function labelsMatchSearchQuery(label: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const terms = q.split(/\s+/).filter(Boolean);
  const hay = label.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

function PcdiFlowNode({ data, id }: NodeProps<Node<PcdiNodeData, "pcdi">>) {
  const fill = data.bubbleFill ?? mindMapBubbleFillForNodeId(id);
  const sizePx = NODE_SIZE[data.kind];
  const px = `${sizePx}px`;

  return (
    <div className="flex max-w-[220px] flex-col items-center gap-1.5 select-none">
      <div className="relative shrink-0 cursor-grab active:cursor-grabbing" style={{ width: px, height: px }}>
        {data.kind === "defect_category" ? (
          <Handle
            type="source"
            position={Position.Right}
            id="src"
            className="opacity-0"
            style={{ borderColor: NODE_STROKE, backgroundColor: fill }}
          />
        ) : null}
        {data.kind === "response_category" ? (
          <>
            <Handle
              type="target"
              position={Position.Left}
              id="tgt"
              className="opacity-0"
              style={{ borderColor: NODE_STROKE, backgroundColor: fill }}
            />
            <Handle
              type="source"
              position={Position.Right}
              id="src"
              className="opacity-0"
              style={{ borderColor: NODE_STROKE, backgroundColor: fill }}
            />
          </>
        ) : null}
        {data.kind === "reference_doc" ? (
          <Handle
            type="target"
            position={Position.Left}
            id="tgt"
            className="opacity-0"
            style={{ borderColor: NODE_STROKE, backgroundColor: fill }}
          />
        ) : null}
        <div
          className="absolute inset-0 rounded-full border-2 transition-[transform,box-shadow] duration-200"
          style={{
            borderColor: NODE_STROKE,
            backgroundColor: fill,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        />
      </div>
      <div
        className={`line-clamp-4 w-full max-w-[210px] text-center text-[11px] leading-snug text-[var(--table-header)] ${
          data.kind === "defect_category" ? "font-bold" : "font-medium"
        }`}
        title={data.label}
      >
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = { pcdi: PcdiFlowNode };

function normalizeNodes(nodes: Node<PcdiNodeData>[]): Node<PcdiNodeData, "pcdi">[] {
  return nodes.map((n) => ({
    ...n,
    type: n.type === "pcdi" || n.type === "default" || !n.type ? "pcdi" : (n.type as "pcdi"),
  })) as Node<PcdiNodeData, "pcdi">[];
}

function layoutTopologyKey(nodes: PcdiRfNode[], edges: PcdiRfEdge[]): string {
  const ns = nodes
    .map((n) => n.id)
    .sort()
    .join("|");
  const es = edges
    .map((e) => `${e.source}->${e.target}:${e.data?.kind ?? ""}`)
    .sort()
    .join("|");
  return `${ns}__${es}`;
}

function KnowledgeGraphCanvasInner() {
  const graphHydrated = useGraphStoreHydrated();
  const nodes = usePcdiGraphStore((s) => s.nodes);
  const edges = usePcdiGraphStore((s) => s.edges);
  const applyNodeChangesFromFlow = usePcdiGraphStore((s) => s.applyNodeChangesFromFlow);
  const applyEdgeChangesFromFlow = usePcdiGraphStore((s) => s.applyEdgeChangesFromFlow);
  const mergeNodes = usePcdiGraphStore((s) => s.mergeNodes);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const topologyKey = useMemo(() => layoutTopologyKey(nodes, edges), [nodes, edges]);

  const bubbleLayout = useMemo(
    () => computeBubbleLayoutPositions(nodes, edges),
    [topologyKey, nodes, edges],
  );

  const [dragOverrides, setDragOverrides] = useState<Map<string, XYPosition>>(new Map());

  useEffect(() => {
    setDragOverrides(new Map());
  }, [topologyKey]);

  const positionedNodes = useMemo(() => {
    return nodes.map((n) => ({
      ...n,
      position: dragOverrides.get(n.id) ?? bubbleLayout.get(n.id) ?? n.position,
    }));
  }, [nodes, dragOverrides, bubbleLayout]);

  const [clusterSeedId, setClusterSeedId] = useState<string | null>(null);

  useEffect(() => {
    setClusterSeedId(null);
  }, [topologyKey]);

  const clusterIds = useMemo(() => {
    if (!clusterSeedId) return null as Set<string> | null;
    return clusterFocusNodeIds(clusterSeedId, nodes, edges);
  }, [clusterSeedId, nodes, edges]);

  const defectRoots = useMemo(() => defectClusterRoots(nodes), [nodes]);

  useEffect(() => {
    if (!graphHydrated || positionedNodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      fitView({ padding: 0.18, duration: 260, maxZoom: 1.2 });
    });
    return () => cancelAnimationFrame(id);
  }, [graphHydrated, topologyKey, fitView]);

  useEffect(() => {
    if (!clusterSeedId || !clusterIds?.size) return;
    const clusterNodes = positionedNodes.filter((n) => clusterIds.has(n.id));
    if (clusterNodes.length === 0) return;
    const id = requestAnimationFrame(() => {
      fitView({ nodes: clusterNodes, padding: 0.45, duration: 380, maxZoom: 1.65 });
    });
    return () => cancelAnimationFrame(id);
  }, [clusterSeedId, clusterIds, positionedNodes, fitView]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setClusterSeedId(null);
        setHoverId(null);
        setTip(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle: string;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const searchActive = searchQuery.trim().length > 0;

  /** D3-style hover: highlight node + neighbors when not using cluster focus. */
  const hoverNeighborIds = useMemo(() => {
    if (!hoverId) return null;
    const s = new Set<string>([hoverId]);
    for (const e of edges) {
      if (e.source === hoverId) s.add(e.target);
      if (e.target === hoverId) s.add(e.source);
    }
    return s;
  }, [hoverId, edges]);

  const hoverDimActive = Boolean(hoverId && !clusterSeedId);

  const labelByNodeId = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of positionedNodes) {
      m.set(n.id, n.data.label);
    }
    return m;
  }, [positionedNodes]);

  const matchCount = useMemo(() => {
    if (!searchActive) return positionedNodes.length;
    return positionedNodes.filter((n) =>
      labelsMatchSearchQuery(n.data.label, searchQuery),
    ).length;
  }, [positionedNodes, searchQuery, searchActive]);

  const bubbleFillByNodeId = useMemo(() => {
    const sorted = [...positionedNodes].sort((a, b) => a.id.localeCompare(b.id));
    const total = sorted.length;
    const m = new Map<string, string>();
    sorted.forEach((node, i) => {
      m.set(node.id, categoryBubbleFill(i, total));
    });
    return m;
  }, [positionedNodes]);

  const flowNodes = useMemo(() => {
    const normalized = normalizeNodes(positionedNodes as Node<PcdiNodeData>[]);
    return normalized.map((n) => {
      const matchSearch =
        !searchActive || labelsMatchSearchQuery(n.data.label, searchQuery);
      const inCluster = !clusterIds || clusterIds.has(n.id);
      const inHoverNet =
        !hoverDimActive || (hoverNeighborIds?.has(n.id) ?? true);

      let opacity = 1;
      if (clusterIds && !inCluster) opacity = 0.08;
      else if (searchActive && !matchSearch) opacity = 0.1;
      else if (hoverDimActive && !inHoverNet) opacity = 0.22;

      const match = matchSearch && inCluster && inHoverNet;
      return {
        ...n,
        data: {
          ...n.data,
          bubbleFill: bubbleFillByNodeId.get(n.id),
        },
        style: {
          ...n.style,
          opacity,
        },
        zIndex: match ? 2 : clusterIds && !inCluster ? 0 : searchActive ? 1 : 0,
        className: [n.className, match ? "brightness-110" : ""].filter(Boolean).join(" "),
      };
    });
  }, [
    positionedNodes,
    bubbleFillByNodeId,
    searchQuery,
    searchActive,
    clusterIds,
    hoverDimActive,
    hoverNeighborIds,
  ]);

  const flowEdges = useMemo(() => {
    return edges.map((e) => {
      const hiCluster =
        clusterSeedId && clusterIds?.has(e.source) && clusterIds?.has(e.target);
      const hiHoverEdge = hoverDimActive && (e.source === hoverId || e.target === hoverId);

      const srcLabel = labelByNodeId.get(e.source) ?? "";
      const tgtLabel = labelByNodeId.get(e.target) ?? "";
      const edgeMatchesSearch =
        !searchActive ||
        labelsMatchSearchQuery(srcLabel, searchQuery) ||
        labelsMatchSearchQuery(tgtLabel, searchQuery);

      const edgeInCluster =
        !clusterIds ||
        (clusterIds.has(e.source) && clusterIds.has(e.target));

      const kind = (e.data?.kind ?? "correlation") as PcdiEdgeType;
      const isRefLink = kind === "reference_link";

      let stroke = isRefLink ? "#A08060" : "#687E88";
      let strokeWidth = 2;
      let opacity = 0.62;

      if (hiCluster || hiHoverEdge) {
        stroke = hiHoverEdge ? "#4A6A7A" : isRefLink ? "#C89858" : "#6B8EA0";
        strokeWidth = hiHoverEdge ? 3 : 2.25;
        opacity = 1;
      }

      if ((searchActive && !edgeMatchesSearch) || !edgeInCluster) {
        opacity = clusterIds && !edgeInCluster ? 0.05 : searchActive ? 0.08 : 0.12;
      } else if (hoverDimActive && !hiHoverEdge) {
        opacity = 0.14;
        strokeWidth = 2;
      }

      return {
        ...e,
        type: "straight" as const,
        style: {
          ...e.style,
          stroke,
          strokeWidth,
          opacity,
        },
        className: "pointer-events-auto",
        zIndex: hiCluster || hiHoverEdge ? 2 : 0,
      } as Edge;
    });
  }, [
    edges,
    clusterSeedId,
    clusterIds,
    hoverId,
    hoverDimActive,
    labelByNodeId,
    searchQuery,
    searchActive,
  ]);

  const fitMatchingNodes = useCallback(() => {
    if (!searchActive || matchCount === 0) return;
    const matching = flowNodes.filter((n) =>
      labelsMatchSearchQuery(n.data.label, searchQuery),
    );
    if (matching.length === 0) return;
    fitView({ nodes: matching, padding: 0.35, duration: 320, maxZoom: 1.5 });
  }, [fitView, flowNodes, matchCount, searchQuery, searchActive]);

  const onNodesChange: OnNodesChange<Node<PcdiNodeData>> = useCallback(
    (changes) => {
      setDragOverrides((prev) => {
        const next = new Map(prev);
        for (const ch of changes) {
          if (ch.type === "position" && ch.position && typeof ch.id === "string") {
            next.set(ch.id, ch.position);
          }
        }
        return next;
      });
      applyNodeChangesFromFlow(changes as NodeChange<PcdiRfNode>[]);
    },
    [applyNodeChangesFromFlow],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      applyEdgeChangesFromFlow(changes as EdgeChange<PcdiRfEdge>[]);
    },
    [applyEdgeChangesFromFlow],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<PcdiNodeData>) => {
      setClusterSeedId((prev) => (prev === node.id ? null : node.id));
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    setClusterSeedId(null);
  }, []);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(({ nodes: sel }) => {
    setSelectedIds(sel.map((n) => n.id));
  }, []);

  const onMerge = useCallback(() => {
    if (selectedIds.length < 2) return;
    mergeNodes(selectedIds);
    setSelectedIds([]);
    setClusterSeedId(null);
  }, [mergeNodes, selectedIds]);

  const focusDefectCluster = useCallback(
    (defectId: string) => {
      setClusterSeedId((prev) => (prev === defectId ? null : defectId));
    },
    [],
  );

  if (!graphHydrated) {
    return (
      <div className="flex min-h-[420px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-muted/60 px-6 py-16 text-center backdrop-blur-sm">
        <p className="text-sm font-medium text-foreground">Loading knowledge map…</p>
        <p className="max-w-md text-xs text-foreground-muted">
          Restoring from{" "}
          <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-foreground">
            pcdi-graph-v1
          </code>
        </p>
      </div>
    );
  }

  return (
    <section className="w-full rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-7">
      <h2 className="mb-1 text-center text-xl font-light tracking-tight text-foreground sm:text-2xl">
        Connectivity graph
      </h2>
      <p className="mb-4 text-center text-sm text-foreground-muted">
        Scroll to zoom · Drag to pan · Hover neighbors · Click a node to focus a cluster ·{" "}
        <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 text-xs text-foreground">
          Esc
        </kbd>{" "}
        clears focus
      </p>

      <div className="mb-4 rounded-xl border border-border bg-surface-muted/50 p-3 sm:p-4">
        <label htmlFor="km-node-search" className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Search className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
          Search nodes
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            id="km-node-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchQuery("");
            }}
            placeholder="Filter by label…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-accent/30 placeholder:text-foreground-muted focus:ring-2"
            aria-describedby="km-search-hint"
          />
          <button
            type="button"
            disabled={!searchActive}
            onClick={() => setSearchQuery("")}
            className="shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            disabled={!searchActive || matchCount === 0}
            onClick={fitMatchingNodes}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
          >
            Fit matches
          </button>
        </div>
        <p id="km-search-hint" className="mt-2 text-[11px] text-foreground-muted">
          {searchActive ? (
            <>
              <span className="font-medium text-foreground">{matchCount}</span> of {positionedNodes.length} match
            </>
          ) : (
            <>
              {positionedNodes.length} node{positionedNodes.length === 1 ? "" : "s"} in graph
            </>
          )}
        </p>
      </div>

      <div className="relative h-[min(72vh,700px)] min-h-[480px] w-full overflow-hidden rounded-lg border border-border bg-white">
        {tip ? (
          <div
            className="pointer-events-none fixed z-[200] max-w-xs rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-foreground shadow-xl"
            style={{
              left: tip.x + 12,
              top: tip.y + 8,
            }}
          >
            <div className="font-semibold leading-snug">{tip.title}</div>
            <div className="mt-0.5 text-xs text-foreground-muted">{tip.subtitle}</div>
          </div>
        ) : null}

        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={(e, n) => {
            setHoverId(n.id);
            setTip({
              x: e.clientX,
              y: e.clientY,
              title: n.data.label,
              subtitle: kindLabel(n.data.kind),
            });
          }}
          onNodeMouseMove={(e, n) => {
            setTip({
              x: e.clientX,
              y: e.clientY,
              title: n.data.label,
              subtitle: kindLabel(n.data.kind),
            });
          }}
          onNodeMouseLeave={() => {
            setHoverId(null);
            setTip(null);
          }}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          multiSelectionKeyCode="Shift"
          selectionOnDrag
          panOnDrag={[1, 2]}
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          minZoom={0.1}
          maxZoom={4}
          fitView={false}
          defaultEdgeOptions={{
            type: "straight",
            style: { stroke: "#687E88", strokeWidth: 2, opacity: 0.62 },
          }}
          proOptions={{ hideAttribution: true }}
          className="knowledge-map-flow h-full w-full cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: "#ffffff" }}
        >
          <MiniMap
            position="bottom-left"
            className="z-[10] !m-3"
            nodeStrokeWidth={2}
            maskColor="rgba(224, 221, 212, 0.72)"
            zoomable
            pannable
          />

          <Panel
            position="top-left"
            className="pointer-events-auto z-[10] m-2 flex min-h-0 max-h-[520px] max-w-[min(20rem,calc(100vw_-_2rem))] flex-col gap-2 overflow-y-auto overflow-x-hidden sm:max-h-[64vh]"
          >
            <div className="rounded-lg border border-border bg-surface/95 p-3 text-xs shadow-lg backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                Focus by defect cluster
              </p>
              <ul className="mt-2 flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                {defectRoots.length === 0 ? (
                  <li className="text-xs text-foreground-muted">No defect categories yet.</li>
                ) : (
                  defectRoots.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => focusDefectCluster(d.id)}
                        className={`w-full rounded-md border px-2 py-1.5 text-left text-xs transition ${
                          clusterSeedId === d.id
                            ? "border-accent bg-accent/15 font-medium text-foreground"
                            : "border-transparent bg-surface-muted/80 text-foreground hover:bg-surface-muted"
                        }`}
                      >
                        <span className="line-clamp-2">{d.data.label}</span>
                        <span className="mt-0.5 block text-[10px] text-foreground-muted">
                          {expandDefectCluster(d.id, edges).size} nodes
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                onClick={() => setClusterSeedId(null)}
                disabled={!clusterSeedId}
                className="mt-2 w-full rounded-md border border-border bg-white px-2 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Show full graph
              </button>
            </div>

            <div className="rounded-lg border border-border bg-surface/95 p-3 text-[11px] text-foreground-muted shadow-lg backdrop-blur-sm">
              <p className="font-medium text-foreground">Bubble colors</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {MIND_MAP_BUBBLE_FILLS.map((c) => (
                  <li key={c} title={c}>
                    <span
                      className="block h-6 w-6 shrink-0 rounded-full border border-border shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-foreground-muted">
                Hue is picked from this set (stable per node). Lines: correlation & reference links.
              </p>
            </div>
          </Panel>

          <Panel position="top-right" className="pointer-events-auto z-[10] m-2 flex flex-col gap-2">
            <button
              type="button"
              disabled={selectedIds.length < 2}
              onClick={onMerge}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow transition-colors hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
            >
              Merge selected ({selectedIds.length})
            </button>
          </Panel>

          <Panel position="bottom-right" className="pointer-events-auto z-[10] m-3 flex flex-col gap-2">
            <button
              type="button"
              title="Zoom in"
              onClick={() => zoomIn({ duration: 200 })}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-md transition hover:bg-surface-muted"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              title="Reset view"
              onClick={() => fitView({ padding: 0.2, duration: 320, maxZoom: 1.35 })}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-lg text-foreground shadow-md transition hover:bg-surface-muted"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              title="Zoom out"
              onClick={() => zoomOut({ duration: 200 })}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-foreground shadow-md transition hover:bg-surface-muted"
            >
              <Minus className="h-5 w-5" aria-hidden />
            </button>
          </Panel>
        </ReactFlow>
      </div>
    </section>
  );
}

export default function KnowledgeGraphCanvas() {
  return (
    <ReactFlowProvider>
      <KnowledgeGraphCanvasInner />
    </ReactFlowProvider>
  );
}
