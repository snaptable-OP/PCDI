/**
 * QuarryMinds category graph rotation — maximises separation between adjacent bubbles.
 * For ≤7 categories, use indices 0..N-1 only (one hue family each). @see quarryminds_color_guide.md
 */
export const MIND_MAP_BUBBLE_FILLS = [
  "#6B8EA0",
  "#7FA65A",
  "#C87850",
  "#5A8A8A",
  "#A87840",
  "#A08060",
  "#687E88",
  "#9DBF7A",
  "#D89878",
  "#78A8A8",
  "#8B5A2B",
  "#B89878",
  "#88A0AC",
  "#576B50",
  "#8B4A2A",
  "#3D6868",
  "#C89858",
  "#6B5440",
  "#4A5A60",
  "#C2D8A0",
  "#E8B8A0",
  "#96C0BE",
  "#D8B878",
  "#C8B090",
  "#A0B8C0",
  "#3A4D36",
  "#F0D4C4",
  "#B8D8D4",
  "#5C3A1E",
  "#DDD0B8",
] as const;

/** Strategy chips — rotated subset for contrast vs adjacent bubble */
export const MIND_MAP_CHIP_FILLS = [
  "#C89858",
  "#6B8EA0",
  "#C87850",
  "#7FA65A",
  "#5A8A8A",
  "#A87840",
  "#687E88",
  "#576B50",
  "#8B5A2B",
  "#3D6868",
] as const;

export function mindMapBubbleFillAtIndex(i: number): string {
  return MIND_MAP_BUBBLE_FILLS[i % MIND_MAP_BUBBLE_FILLS.length]!;
}

/**
 * D3 / ordered categories: use palette in sequence; when few categories, first N entries only.
 */
export function categoryBubbleFill(index: number, categoryCount: number): string {
  const p = MIND_MAP_BUBBLE_FILLS;
  if (categoryCount <= 7 && index < categoryCount) {
    return p[index]!;
  }
  return p[index % p.length]!;
}

/** @deprecated Prefer {@link categoryBubbleFill} with sorted index to avoid same-family collisions. */
export function mindMapBubbleFillForNodeId(nodeId: string): string {
  return mindMapBubbleFillAtIndex(
    Math.abs(
      nodeId.split("").reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0),
    ),
  );
}

function expandHex(hex: string): string {
  const h = hex.trim().replace("#", "");
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h;
}

/** Blend a QuarryMinds hex toward white (`t` 0 = base, 1 = white) for soft UI highlights. */
function mixHexWithWhite(hex: string, t: number): string {
  const v = expandHex(hex);
  if (v.length !== 6) return "#f8f6f3";
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  const mix = (c: number) => Math.min(255, Math.round(c * (1 - t) + 255 * t));
  return `#${mix(r).toString(16).padStart(2, "0")}${mix(g).toString(16).padStart(2, "0")}${mix(b).toString(16).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const v = expandHex(hex);
  if (v.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Per-row light tints for “data-suggested” strategy options — cycles {@link MIND_MAP_CHIP_FILLS}.
 */
export function dataSuggestedStrategyHighlightStyles(index: number): {
  rowStyle: { backgroundColor: string; borderLeft: string; boxShadow: string };
  badgeStyle: { color: string; backgroundColor: string; boxShadow: string };
} {
  const base = MIND_MAP_CHIP_FILLS[index % MIND_MAP_CHIP_FILLS.length]!;
  return {
    rowStyle: {
      backgroundColor: mixHexWithWhite(base, 0.84),
      borderLeft: `5px solid ${base}`,
      boxShadow: `inset 0 0 0 1px ${hexToRgba(base, 0.22)}`,
    },
    badgeStyle: {
      color: base,
      backgroundColor: "rgba(255,255,255,0.94)",
      boxShadow: `inset 0 0 0 1px ${hexToRgba(base, 0.18)}`,
    },
  };
}

function hexLuminance(hex: string): number {
  const v = expandHex(hex);
  const n = parseInt(v.length === 6 ? v : "000000", 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const lin = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function mindMapLabelFillForBackground(hex: string): "#ffffff" | "#1e293b" {
  return hexLuminance(hex) > 0.52 ? "#1e293b" : "#ffffff";
}
