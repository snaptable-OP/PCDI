"use client";

import { useEffect, useState } from "react";
import { usePcdiGraphStore } from "./store";

/**
 * True after Zustand `persist` has merged localStorage (`pcdi-graph-v1`) into the graph store.
 * Until then, node/edge counts may incorrectly show 0 on the knowledge map.
 */
export function useGraphStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (usePcdiGraphStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    const unsub = usePcdiGraphStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    return unsub;
  }, []);

  return hydrated;
}
