import Link from "next/link";
import { KnowledgeMapCanvasSection } from "@/components/pcdi/knowledge-map-canvas-section";
import { GraphStatsClient } from "@/components/pcdi/graph-stats-client";

const LEGEND = [
  { label: "Defect category", color: "#2196f3" },
  { label: "Response category", color: "#9c27b0" },
  { label: "Reference", color: "#ff7043" },
] as const;

export default function KnowledgeMapPage() {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-clip">
      <div className="relative overflow-hidden px-4 pb-10 pt-8 sm:px-8 sm:pb-14 sm:pt-12">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-center text-3xl font-light tracking-tight text-[var(--heading-foreground)] sm:text-4xl">
            Knowledge map
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--muted-foreground)] sm:text-base">
            Published defect, response, and reference nodes from Historical discovery — force‑laid out like a
            connectivity mind graph. Pan with scroll or right / middle‑drag; left‑drag to select;{" "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs text-[var(--foreground)]">
              Shift
            </kbd>
            + click to merge.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {LEGEND.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm border border-[var(--border)] shadow-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/80 px-4 py-3 text-center">
            <GraphStatsClient tone="default" />
          </div>

          <div className="mt-10 w-full">
            <KnowledgeMapCanvasSection />
          </div>

          <p className="mt-10 flex flex-wrap items-center justify-center gap-4 text-center">
            <Link
              href="/historical"
              className="inline-flex items-center text-sm text-link underline-offset-4 transition hover:underline"
            >
              ← Historical Analysis
            </Link>
            <Link
              href="/live"
              className="inline-flex items-center text-sm text-link underline-offset-4 transition hover:underline"
            >
              ← Live Analysis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
