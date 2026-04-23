"use client";

import KnowledgeGraphCanvas from "@/components/pcdi/knowledge-graph-canvas";

/**
 * Client-only entry for the knowledge map (React Flow has no SSR).
 * Loaded as a normal import — `next/dynamic` was causing webpack "options.factory" / `call` on
 * undefined in dev for some @xyflow chunk boundaries.
 */
export function KnowledgeMapCanvasSection() {
  return <KnowledgeGraphCanvas />;
}
