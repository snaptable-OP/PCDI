import type { Edge, Node } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import type { EdgeChange, NodeChange } from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { hashString } from "./hash";
import type { PcdiEdgeData, PcdiGraphNodeKind, PcdiNodeData } from "./types";

export const PCDI_GRAPH_STORAGE_KEY = "pcdi-graph-v1";

export type PcdiRfNode = Node<PcdiNodeData>;
export type PcdiRfEdge = Edge<PcdiEdgeData>;

export type UpsertDiscoveryInput = {
  projectId: string;
  defectCategories: string[];
  responseCategories: string[];
  referenceDocuments?: string[];
};

function stableNodeId(kind: PcdiGraphNodeKind, label: string): string {
  return `${kind}-${hashString(label)}`;
}

function layoutPosition(
  kind: PcdiGraphNodeKind,
  label: string,
  index: number,
): { x: number; y: number } {
  const h = parseInt(hashString(label).slice(0, 4), 16) % 320;
  const col =
    kind === "defect_category" ? 0 : kind === "response_category" ? 260 : 520;
  return { x: col + (index % 3) * 120, y: 80 + h + index * 36 };
}

type PcdiGraphState = {
  nodes: PcdiRfNode[];
  edges: PcdiRfEdge[];
  /** ISO timestamp set when discovery categories are published into the graph. */
  lastIngestAt: string | null;
  upsertFromDiscovery: (input: UpsertDiscoveryInput) => void;
  mergeNodes: (ids: string[]) => void;
  /** Sync drags / selection deletes from React Flow into persisted state. */
  applyNodeChangesFromFlow: (changes: NodeChange<PcdiRfNode>[]) => void;
  applyEdgeChangesFromFlow: (changes: EdgeChange<PcdiRfEdge>[]) => void;
};

export const usePcdiGraphStore = create<PcdiGraphState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      lastIngestAt: null,

      upsertFromDiscovery: ({
        projectId,
        defectCategories,
        responseCategories,
        referenceDocuments = [],
      }) => {
        const state = get();
        const nodes = [...state.nodes];
        const edges = [...state.edges];
        const byKindLabel = new Map<string, string>(
          nodes.map((n) => [`${n.data.kind}:${n.data.label}`, n.id]),
        );

        function ensureNode(kind: PcdiGraphNodeKind, label: string): string {
          const mapKey = `${kind}:${label}`;
          const existingId = byKindLabel.get(mapKey);
          if (existingId) return existingId;

          let id = stableNodeId(kind, label);
          if (nodes.some((n) => n.id === id)) {
            id = `${id}-${hashString(label).slice(0, 6)}`;
          }

          nodes.push({
            id,
            type: "pcdi",
            position: layoutPosition(kind, label, nodes.length),
            data: { kind, label, sourceProjectId: projectId },
          });
          byKindLabel.set(mapKey, id);
          return id;
        }

        const dIds = defectCategories.map((l) => ensureNode("defect_category", l));
        const rIds = responseCategories.map((l) => ensureNode("response_category", l));
        const refIds = referenceDocuments.map((l) => ensureNode("reference_doc", l));

        const pairLen = Math.max(dIds.length, rIds.length);
        for (let i = 0; i < pairLen; i++) {
          const di = dIds[i % dIds.length];
          const ri = rIds[i % rIds.length];
          if (!di || !ri) continue;
          const exists = edges.some(
            (e) =>
              e.source === di &&
              e.target === ri &&
              e.data?.kind === "correlation",
          );
          if (exists) continue;
          const ek = `${di}|${ri}|correlation`;
          edges.push({
            id: `e-${hashString(ek)}`,
            source: di,
            target: ri,
            data: { kind: "correlation" },
          });
        }

        for (let i = 0; i < rIds.length && refIds.length > 0; i++) {
          const ri = rIds[i];
          const fi = refIds[i % refIds.length];
          const exists = edges.some(
            (e) =>
              e.source === ri &&
              e.target === fi &&
              e.data?.kind === "reference_link",
          );
          if (exists) continue;
          const ek = `${ri}|${fi}|reference_link`;
          edges.push({
            id: `e-${hashString(ek)}`,
            source: ri,
            target: fi,
            data: { kind: "reference_link" },
          });
        }

        set({
          nodes,
          edges,
          lastIngestAt: new Date().toISOString(),
        });
      },

      applyNodeChangesFromFlow: (changes) => {
        set((state) => ({
          nodes: applyNodeChanges(changes, state.nodes),
        }));
      },

      applyEdgeChangesFromFlow: (changes) => {
        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges),
        }));
      },

      mergeNodes: (ids) => {
        const unique = [...new Set(ids)].filter(Boolean).sort();
        if (unique.length < 2) return;

        const keepId = unique[0];
        set((state) => {
          const byId = new Map(state.nodes.map((n) => [n.id, n]));
          const labels = unique
            .map((id) => byId.get(id)?.data.label)
            .filter((x): x is string => Boolean(x));
          if (labels.length === 0) return state;

          const mergedLabel = [...new Set(labels)].join(" / ");
          const canonical = byId.get(keepId);
          if (!canonical) return state;

          const remove = new Set(unique.slice(1));
          const newNodes = state.nodes
            .filter((n) => !remove.has(n.id))
            .map((n) =>
              n.id === keepId
                ? { ...n, data: { ...n.data, label: mergedLabel } }
                : n,
            );

          const nextEdges = state.edges
            .map((e) => ({
              ...e,
              source: remove.has(e.source) ? keepId : e.source,
              target: remove.has(e.target) ? keepId : e.target,
            }))
            .filter((e) => e.source !== e.target);

          const seen = new Set<string>();
          const deduped: PcdiRfEdge[] = [];
          for (const e of nextEdges) {
            const kind = e.data?.kind ?? "correlation";
            const k = `${e.source}|${e.target}|${kind}`;
            if (seen.has(k)) continue;
            seen.add(k);
            deduped.push({
              ...e,
              data: e.data ?? { kind: "correlation" },
              id: e.id || `e-${hashString(k)}`,
            });
          }

          return { nodes: newNodes, edges: deduped };
        });
      },
    }),
    {
      name: PCDI_GRAPH_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        nodes: s.nodes,
        edges: s.edges,
        lastIngestAt: s.lastIngestAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[pcdi] graph rehydrate error", error);
          return;
        }
        if (state) {
          console.log("[pcdi] graph rehydrated", {
            nodes: state.nodes?.length ?? 0,
            edges: state.edges?.length ?? 0,
          });
        }
      },
    },
  ),
);
