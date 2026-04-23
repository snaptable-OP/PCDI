"use client";

import { usePcdiGraphStore } from "@/lib/pcdi/store";
import { useGraphStoreHydrated } from "@/lib/pcdi/use-graph-store-hydrated";

type GraphStatsClientProps = {
  /** Use on gradient / dark hero (e.g. knowledge map). */
  tone?: "default" | "darkHero";
};

/** Minimal node/edge counts from the persisted graph (Steps 7–8 / 12). */
export function GraphStatsClient({ tone = "default" }: GraphStatsClientProps) {
  const hydrated = useGraphStoreHydrated();
  const nodeCount = usePcdiGraphStore((s) => s.nodes.length);
  const edgeCount = usePcdiGraphStore((s) => s.edges.length);

  const muted = tone === "darkHero" ? "text-white/70" : "text-[var(--muted-foreground)]";
  const strong = tone === "darkHero" ? "text-white" : "text-[var(--foreground)]";
  const hint =
    tone === "darkHero" ? "mt-1 block text-xs text-amber-200/95" : "mt-1 block text-xs text-amber-800 dark:text-amber-200";

  if (!hydrated) {
    return <p className={`text-sm ${muted}`}>Loading persisted graph from browser storage…</p>;
  }

  return (
    <p className={`text-sm ${muted}`}>
      Graph:{" "}
      <strong className={strong}>{nodeCount}</strong> nodes ·{" "}
      <strong className={strong}>{edgeCount}</strong> edges
      {nodeCount === 0 ? (
        <span className={hint}>
          Nothing published yet — use Defect Analysis → Discover Categories → Publish to knowledge map, or open
          the dashboard graph tools.
        </span>
      ) : null}
    </p>
  );
}
