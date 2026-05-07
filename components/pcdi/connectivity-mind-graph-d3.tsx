"use client";

/**
 * Defect category overview — D3 force layout with category nodes only.
 * Node area scales with defect count; click opens sidebar with row list + bulk strategy assignment.
 */

import * as d3 from "d3";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateDefectsByCategory,
  getDefectRowsForVisualisation,
  type CategoryAggregate,
} from "@/lib/pcdi/defect-category-aggregation";
import { hashString } from "@/lib/pcdi/hash";
import {
  formatExplicitStrategyBreakdownSummary,
  getExplicitStrategyBreakdownSegments,
  getLiveSelectionFingerprint,
  getLiveUploadFingerprint,
  type StrategyBreakdownSegment,
} from "@/lib/pcdi/live-rows";
import { readLiveSelectionState } from "@/lib/pcdi/live-selection-session";
import {
  categoryBubbleFill,
  MIND_MAP_CHIP_FILLS,
  mindMapLabelFillForBackground,
} from "@/lib/pcdi/mind-map-palette";
import { DefectCategorySidebar } from "@/components/pcdi/defect-category-sidebar";

type CategoryMindNode = d3.SimulationNodeDatum &
  CategoryAggregate & {
    radius: number;
    fill: string;
    stroke: string;
    breakdownSegments: StrategyBreakdownSegment[];
    breakdownSummary: string;
  };

function drag(simulation: d3.Simulation<CategoryMindNode, undefined>) {
  function dragstarted(event: d3.D3DragEvent<SVGGElement, CategoryMindNode, CategoryMindNode>) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    const s = event.subject;
    s.fx = s.x;
    s.fy = s.y;
  }

  function dragged(event: d3.D3DragEvent<SVGGElement, CategoryMindNode, CategoryMindNode>) {
    const s = event.subject;
    s.fx = event.x;
    s.fy = event.y;
  }

  function dragended(event: d3.D3DragEvent<SVGGElement, CategoryMindNode, CategoryMindNode>) {
    if (!event.active) simulation.alphaTarget(0);
    const s = event.subject;
    s.fx = null;
    s.fy = null;
  }

  return d3
    .drag<SVGGElement, CategoryMindNode>()
    .clickDistance(10)
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended);
}

const STRATEGY_CHIP_FILLS = MIND_MAP_CHIP_FILLS;

function truncateChipLabel(s: string, max = 22): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function ConnectivityMindGraphD3({ projectId }: { projectId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.Simulation<CategoryMindNode, undefined> | null>(null);
  const pickRef = useRef<(a: CategoryAggregate) => void>(() => {});

  const [selectedAggregate, setSelectedAggregate] = useState<CategoryAggregate | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  pickRef.current = (a) => {
    setSelectedAggregate(a);
    setSidebarOpen(true);
  };

  const uploadFp = getLiveUploadFingerprint(projectId);
  /** Invalidate graph when merge rows/categories change — not only row ids (same count could hide updates). */
  const vizRowsSig = useMemo(() => {
    const rows = getDefectRowsForVisualisation(projectId);
    const idSig = hashString(rows.map((r) => r.id).join("\0")).slice(0, 24);
    const bodySig = hashString(
      rows.map((r) => `${r.defectCategory}\t${r.defectDescription}`).join("\n"),
    ).slice(0, 24);
    return `${uploadFp ?? "demo"}:${rows.length}:${idSig}:${bodySig}`;
  }, [projectId, uploadFp]);

  const [selectionRev, setSelectionRev] = useState(0);
  useEffect(() => {
    const onSel = (e: Event) => {
      const d = (e as CustomEvent<{ projectId?: string }>).detail;
      if (d?.projectId === projectId) setSelectionRev((n) => n + 1);
    };
    window.addEventListener("pcdi-live-selections-updated", onSel);
    return () => window.removeEventListener("pcdi-live-selections-updated", onSel);
  }, [projectId]);

  useEffect(() => {
    setSelectedAggregate(null);
    setSidebarOpen(false);
  }, [projectId]);

  const zoomIn = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    svg.transition().duration(200).call(zoom.scaleBy, 1.3);
  }, []);

  const zoomOut = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    svg.transition().duration(200).call(zoom.scaleBy, 0.7);
  }, []);

  const zoomReset = useCallback(() => {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    if (!svg || !zoom) return;
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let ro: ResizeObserver | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let lastW = -1;
    let lastH = -1;

    const teardown = () => {
      simulationRef.current?.stop();
      simulationRef.current = null;
      svgRef.current = null;
      zoomRef.current = null;
      container.replaceChildren();
    };

    const mountGraph = () => {
      if (disposed) return;
      const width = Math.round(container.clientWidth);
      const height = Math.round(container.clientHeight);
      if (width < 48 || height < 48) return;
      if (width === lastW && height === lastH && svgRef.current) return;
      lastW = width;
      lastH = height;

      teardown();

      const aggregates = aggregateDefectsByCategory(projectId);
      const fpSel = getLiveSelectionFingerprint(projectId);
      const selStored = readLiveSelectionState(projectId);
      const selections = selStored?.fingerprint === fpSel ? selStored.selections ?? {} : {};

      const counts = aggregates.map((a) => a.count);
      const maxSqrt = Math.max(...counts.map((c) => Math.sqrt(c)), 1);
      const minR = 26;
      const maxR = 78;

      const nodes: CategoryMindNode[] = aggregates.map((a, i) => {
        const t = Math.sqrt(a.count) / maxSqrt;
        const radius = minR + t * (maxR - minR);
        const fill = categoryBubbleFill(i, aggregates.length);
        const breakdownSegments = getExplicitStrategyBreakdownSegments(a.rows, selections);
        const breakdownSummary = formatExplicitStrategyBreakdownSummary(a.rows, selections);
        return {
          ...a,
          radius,
          fill,
          stroke: "rgba(255,255,255,0.25)",
          breakdownSegments,
          breakdownSummary,
        };
      });

      nodes.forEach((n) => {
        n.x = width / 2 + (Math.random() - 0.5) * width * 0.35;
        n.y = height / 2 + (Math.random() - 0.5) * height * 0.35;
      });

      const simulation = d3
        .forceSimulation(nodes)
        .force("charge", d3.forceManyBody<CategoryMindNode>().strength(-560))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force(
          "collide",
          d3.forceCollide<CategoryMindNode>().radius((d) => {
            const n = d.breakdownSegments.length;
            const stackPx = n > 0 ? 20 + n * 22 + 8 : 0;
            return d.radius + 12 + stackPx;
          }),
        )
        .force("x", d3.forceX(width / 2).strength(0.08))
        .force("y", d3.forceY(height / 2).strength(0.08));

      simulationRef.current = simulation;

      const svg = d3
        .select(container)
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("width", "100%")
        .attr("height", "100%");

      svgRef.current = svg;
      const g = svg.append("g");

      const zoomBehavior = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.08, 5])
        .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
          g.attr("transform", event.transform.toString());
        });

      svg.call(zoomBehavior);
      zoomRef.current = zoomBehavior;

      simulation.on("end", () => {
        if (disposed) return;
        const gn = g.node() as SVGGElement | null;
        if (!gn) return;
        const bounds = gn.getBBox();
        const bWidth = bounds.width || 1;
        const bHeight = bounds.height || 1;
        const scale = 0.8 / Math.max(bWidth / width, bHeight / height);
        const translateX = width / 2 - scale * (bounds.x + bWidth / 2);
        const translateY = height / 2 - scale * (bounds.y + bHeight / 2);
        svg.transition().duration(500).call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale),
        );
      });

      const node = g
        .append("g")
        .selectAll(".cat-node")
        .data(nodes)
        .join("g")
        .attr("class", "cat-node")
        // @ts-expect-error D3 drag typings vs join() variance
        .call(drag(simulation));

      node
        .append("circle")
        .attr("r", (d) => d.radius)
        .attr("fill", (d) => d.fill)
        .attr("stroke", (d) => d.stroke)
        .attr("stroke-width", 2)
        .style(
          "filter",
          "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))",
        )
        .style("cursor", "pointer");

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .attr("fill", (d) => mindMapLabelFillForBackground(d.fill))
        .attr("font-weight", "700")
        .style("pointer-events", "none")
        .style("text-shadow", (d) =>
          mindMapLabelFillForBackground(d.fill) === "#ffffff"
            ? "0 1px 4px rgba(0,0,0,0.35)"
            : "none",
        )
        .attr("font-size", (d) => `${Math.min(26, Math.max(13, d.radius * 0.38))}px`)
        .text((d) => d.count);

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", (d) => d.radius + 11)
        .attr("fill", "#6B5E4E")
        .attr("font-size", "9px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.08em")
        .style("pointer-events", "none")
        .text("DEFECT CATEGORY");

      node
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", (d) => d.radius + 26)
        .attr("fill", "#4A3F32")
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .style("pointer-events", "none")
        .each(function (d) {
          const text = d3.select(this);
          const s = d.label;
          const max = 32;
          text.text(s.length > max ? `${s.slice(0, max - 1)}…` : s);
        });

      node
        .filter((d) => d.breakdownSegments.length > 0)
        .each(function (d) {
          const host = d3.select(this);
          const chips = host
            .append("g")
            .attr("class", "strategy-chips")
            .attr("transform", `translate(0, ${d.radius + 34})`);

          d.breakdownSegments.forEach((seg, i) => {
            const labelShort = truncateChipLabel(seg.label);
            const textContent = `${labelShort} · ${seg.count}`;
            const pw = Math.min(218, Math.max(56, textContent.length * 5.15 + 18));
            const fill = STRATEGY_CHIP_FILLS[i % STRATEGY_CHIP_FILLS.length]!;
            const chip = chips.append("g").attr("transform", `translate(0, ${i * 22})`);

            chip
              .append("rect")
              .attr("x", -pw / 2)
              .attr("y", 0)
              .attr("width", pw)
              .attr("height", 18)
              .attr("rx", 9)
              .attr("fill", fill)
              .attr("stroke", "rgba(74,90,96,0.25)")
              .attr("stroke-width", 1)
              .style("filter", "drop-shadow(0 1px 2px rgba(74,90,96,0.2))");

            chip
              .append("text")
              .attr("x", 0)
              .attr("y", 12.5)
              .attr("text-anchor", "middle")
              .attr("fill", mindMapLabelFillForBackground(fill))
              .attr("font-size", "9px")
              .attr("font-weight", "700")
              .attr("font-family", "system-ui, sans-serif")
              .style("pointer-events", "none")
              .style(
                "text-shadow",
                mindMapLabelFillForBackground(fill) === "#ffffff"
                  ? "0 1px 2px rgba(0,0,0,0.35)"
                  : "none",
              )
              .text(textContent);
          });
        });

      node
        .on("click", (event: MouseEvent, d: CategoryMindNode) => {
          event.stopPropagation();
          pickRef.current({
            id: d.id,
            categoryKey: d.categoryKey,
            label: d.label,
            count: d.count,
            rows: d.rows,
          });
        });

      simulation.on("tick", () => {
        node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });
    };

    const scheduleMount = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        mountGraph();
      }, 80);
    };

    scheduleMount();
    ro = new ResizeObserver(() => scheduleMount());
    ro.observe(container);

    return () => {
      disposed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      ro?.disconnect();
      teardown();
      lastW = -1;
      lastH = -1;
    };
  }, [projectId, vizRowsSig, selectionRev]);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <>
      <section
        id="mind-map-section"
        className="relative flex h-full min-h-0 w-full flex-col bg-white"
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="zoom-controls absolute bottom-4 right-4 z-[5] flex flex-col gap-2 md:bottom-6 md:right-6">
            <button
              type="button"
              className="zoom-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-lg text-foreground shadow-sm transition hover:bg-surface-muted"
              title="Zoom In"
              aria-label="Zoom In"
              onClick={zoomIn}
            >
              +
            </button>
            <button
              type="button"
              className="zoom-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-lg text-foreground shadow-sm transition hover:bg-surface-muted"
              title="Reset View"
              aria-label="Reset View"
              onClick={zoomReset}
            >
              ⟲
            </button>
            <button
              type="button"
              className="zoom-btn flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-lg text-foreground shadow-sm transition hover:bg-surface-muted"
              title="Zoom Out"
              aria-label="Zoom Out"
              onClick={zoomOut}
            >
              −
            </button>
          </div>

          <div
            ref={containerRef}
            id="mind-map-container"
            className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-white active:cursor-grabbing"
          />

          <p className="pointer-events-none absolute bottom-3 left-3 right-24 z-[1] text-[11px] leading-snug text-shale-wet-slate/70 md:right-auto md:text-xs">
            Scroll to zoom · Drag background to pan · Drag nodes · Click category for sidebar
          </p>
        </div>
      </section>

      <DefectCategorySidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        aggregate={selectedAggregate}
        projectId={projectId}
      />
    </>
  );
}
