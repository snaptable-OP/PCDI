import Link from "next/link";
import { ClipboardList, History, Zap } from "lucide-react";

export default function DefectAnalysisHubPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pb-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Defect analysis</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Choose the workflow that matches your data. Historical analysis uses past contractor responses and
          discovery; live project analysis is for defect lists where AI should suggest responses and strategy.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/historical"
          className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-teal-500/50 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <History className="h-5 w-5" aria-hidden />
            <span className="font-semibold">Historical analysis</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Defect registers with response data, Discover Categories, alignment with the knowledge map, and
            publishing categories.
          </p>
          <span className="mt-4 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-300">
            Open historical projects →
          </span>
        </Link>

        <Link
          href="/live"
          className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-teal-500/50 hover:shadow-md"
        >
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Zap className="h-5 w-5" aria-hidden />
            <span className="font-semibold">Live project analysis</span>
          </div>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Defect-focused file without filled-in response strategy — export to Excel and copy the master prompt
            for AI suggestions.
          </p>
          <span className="mt-4 text-sm font-medium text-teal-700 group-hover:underline dark:text-teal-300">
            Open live projects →
          </span>
        </Link>
      </div>

      <p className="text-center text-sm text-[var(--muted-foreground)]">
        <ClipboardList className="mr-1 inline h-4 w-4 align-text-bottom opacity-70" aria-hidden />
        Tip: projects are separate per module — create a live project when you do not have historical responses
        yet.
      </p>
    </div>
  );
}
