import Link from "next/link";
import { DashboardStats } from "@/components/pcdi/dashboard-stats";
import { GraphStoreHydrationTest } from "@/components/pcdi/graph-store-hydration-test";

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl py-8">
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/" className="text-link hover:underline">
          ← Home
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Dashboard</h1>
      <p className="mt-2 max-w-prose text-sm text-[var(--muted-foreground)]">
        Snapshot of mock defect volume, project inventory, knowledge-map connectivity, and the last time
        categories were merged into the graph from Discover Categories.
      </p>

      <div className="mt-8">
        <DashboardStats />
      </div>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-[var(--border-subtle)] pt-8">
        <Link
          href="/historical"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active"
        >
          Historical Analysis
        </Link>
        <Link
          href="/knowledge-map"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          Knowledge Map
        </Link>
        <Link
          href="/live"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
        >
          Live Analysis
        </Link>
      </div>

      {process.env.NODE_ENV === "development" ? <GraphStoreHydrationTest /> : null}
    </div>
  );
}
