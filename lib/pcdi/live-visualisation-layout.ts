import { defectCategoryDisplayKey } from "@/lib/pcdi/defect-category-display";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";
import { hashString } from "@/lib/pcdi/hash";

export type CategoryCluster = {
  categoryKey: string;
  rows: HistoricalDefectTableRow[];
};

const MAIN_RADIUS_BASE = 280;

/** Stable id for React Flow category nodes (ASCII-safe). */
export function categoryNodeId(categoryKey: string): string {
  const h = hashString(categoryKey).slice(0, 12);
  return `cat-${h}`;
}

/**
 * Groups register rows by defect category for cluster visualization.
 */
export function groupRowsByDefectCategory(rows: HistoricalDefectTableRow[]): CategoryCluster[] {
  const map = new Map<string, HistoricalDefectTableRow[]>();
  for (const r of rows) {
    const k = defectCategoryDisplayKey(r.defectCategory);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return [...map.entries()].map(([categoryKey, clusterRows]) => ({
    categoryKey,
    rows: clusterRows,
  }));
}

/** Hub card size scales slightly with number of defects in the category (draft UX). */
export function hubSizeForCount(count: number): { w: number; h: number } {
  const n = Math.max(1, count);
  const w = Math.min(240, 132 + Math.round(Math.sqrt(n) * 28));
  const h = Math.min(104, 56 + Math.round(Math.sqrt(n) * 14));
  return { w, h };
}

function orbitRadiusForCount(count: number): number {
  const n = Math.max(1, count);
  return Math.min(200, 52 + n * 14 + Math.sqrt(n) * 22);
}

/**
 * Places each defect category hub on an outer ring and arranges defect bubbles around it.
 * Returns top-left positions for React Flow nodes.
 */
export function computeLiveVisualisationPositions(
  clusters: CategoryCluster[],
  defectDiameterPx = 40,
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const nCat = clusters.length;
  const cx0 = 520;
  const cy0 = 420;
  const mainR =
    nCat <= 1 ? 80 : MAIN_RADIUS_BASE + Math.min(220, Math.max(0, (nCat - 3) * 36));

  clusters.forEach((cl, i) => {
    const theta = (2 * Math.PI * i) / Math.max(1, nCat) - Math.PI / 2;
    const { w: hw, h: hh } = hubSizeForCount(cl.rows.length);
    const hubCx = cx0 + mainR * Math.cos(theta);
    const hubCy = cy0 + mainR * Math.sin(theta);
    const hid = categoryNodeId(cl.categoryKey);
    out.set(hid, {
      x: hubCx - hw / 2,
      y: hubCy - hh / 2,
    });

    const orbit = orbitRadiusForCount(cl.rows.length);
    const m = cl.rows.length;
    const r = defectDiameterPx / 2;
    cl.rows.forEach((row, j) => {
      const phi = (2 * Math.PI * j) / Math.max(1, m) - Math.PI / 2;
      const px = hubCx + orbit * Math.cos(phi);
      const py = hubCy + orbit * Math.sin(phi);
      out.set(row.id, {
        x: px - r,
        y: py - r,
      });
    });
  });

  return out;
}

export function visualisationCanvasExtent(clusters: CategoryCluster[]): {
  width: number;
  height: number;
} {
  const n = clusters.length;
  const pad = 120;
  const base = 520 + (n <= 1 ? 160 : 280 + Math.min(220, Math.max(0, (n - 3) * 36)));
  const side = pad * 2 + base * 2;
  return { width: Math.max(960, side), height: Math.max(720, Math.round(side * 0.82)) };
}
