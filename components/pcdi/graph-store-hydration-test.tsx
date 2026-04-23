"use client";

import { useEffect, useState } from "react";
import { usePcdiGraphStore } from "@/lib/pcdi/store";

/** Dev-only: confirms Zustand persist hydration and localStorage survival. */
export function GraphStoreHydrationTest() {
  const [hydrationLog, setHydrationLog] = useState<string[]>([]);
  const nodes = usePcdiGraphStore((s) => s.nodes);
  const edges = usePcdiGraphStore((s) => s.edges);
  const upsertFromDiscovery = usePcdiGraphStore((s) => s.upsertFromDiscovery);
  const mergeNodes = usePcdiGraphStore((s) => s.mergeNodes);

  useEffect(() => {
    const unsub = usePcdiGraphStore.persist.onFinishHydration(() => {
      const n = usePcdiGraphStore.getState().nodes.length;
      const e = usePcdiGraphStore.getState().edges.length;
      console.log("[pcdi] onFinishHydration", { nodes: n, edges: e });
      setHydrationLog((prev) => [...prev, `onFinishHydration: ${n} nodes, ${e} edges`]);
    });
    return () => {
      unsub?.();
    };
  }, []);

  return (
    <div className="mt-8 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/40 p-4 text-xs text-[var(--muted-foreground)]">
      <p className="font-medium text-[var(--foreground)]">Graph store (Step 3 verify)</p>
      <p className="mt-1">
        Current: <strong className="text-[var(--foreground)]">{nodes.length}</strong> nodes ·{" "}
        <strong className="text-[var(--foreground)]">{edges.length}</strong> edges
      </p>
      {hydrationLog.map((line, i) => (
        <p key={i} className="mt-1 font-mono">
          {line}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[var(--accent-foreground)]"
          onClick={() =>
            upsertFromDiscovery({
              projectId: "hydration-test",
              defectCategories: ["Test defect category"],
              responseCategories: ["Test response category"],
              referenceDocuments: ["BS EN 1992-1-1"],
            })
          }
        >
          Seed discovery batch
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--foreground)]"
          onClick={() => {
            const ids = nodes.slice(0, 2).map((n) => n.id);
            if (ids.length >= 2) mergeNodes(ids);
          }}
          disabled={nodes.length < 2}
        >
          Merge first two nodes
        </button>
      </div>
      <p className="mt-3 max-w-prose">
        Refresh the page — node/edge counts should persist (<code className="rounded bg-[var(--surface)] px-1">pcdi-graph-v1</code> in{" "}
        <code className="rounded bg-[var(--surface)] px-1">localStorage</code>). Check the console for rehydrate logs.
      </p>
    </div>
  );
}
