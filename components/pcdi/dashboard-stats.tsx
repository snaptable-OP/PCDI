"use client";

import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import { graphMapDensityPercent, mockAggregateDefectTotal } from "@/lib/pcdi/dashboard-metrics";
import { usePcdiGraphStore } from "@/lib/pcdi/store";

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{hint}</p>
    </div>
  );
}

/** KPI cards driven by graph + projects stores — updates live when discovery is published. */
export function DashboardStats() {
  const nodes = usePcdiGraphStore((s) => s.nodes);
  const edges = usePcdiGraphStore((s) => s.edges);
  const lastIngestAt = usePcdiGraphStore((s) => s.lastIngestAt ?? null);
  const projectCount = useHistoricalProjectsStore((s) => s.projects.length);

  const totalDefects = mockAggregateDefectTotal(nodes);
  const densityPct = graphMapDensityPercent(nodes, edges);

  const formattedLast = lastIngestAt
    ? new Date(lastIngestAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatCard
        title="Total defects (mock)"
        value={totalDefects.toLocaleString()}
        hint="Rolled up from defect / response / reference nodes in the knowledge graph."
      />
      <StatCard
        title="Defect Analysis projects"
        value={projectCount.toLocaleString()}
        hint="Projects stored in this browser (local)."
      />
      <StatCard
        title="Map density"
        hint={`${nodes.length} nodes · ${edges.length} edges — average linkage vs nominal maximum.`}
        value={`${densityPct}%`}
      />
      <StatCard
        title="Last graph ingest"
        value={formattedLast}
        hint="Timestamp of the latest discovery publish to the global graph."
      />
    </div>
  );
}
