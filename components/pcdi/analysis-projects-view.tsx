"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule, HistoricalProject } from "@/lib/pcdi/types";

function formatAssetType(t: HistoricalProject["assetType"]): string {
  return t === "residential" ? "Residential" : "Commercial";
}

function formatStructural(t: HistoricalProject["structuralType"]): string {
  const map: Record<HistoricalProject["structuralType"], string> = {
    steel: "Steel",
    concrete: "Concrete",
    timber: "Timber",
    masonry: "Masonry",
    mixed: "Mixed",
  };
  return map[t];
}

export type AnalysisProjectsViewProps = {
  module: AnalysisModule;
  /** Route prefix e.g. `/historical` or `/live` */
  basePath: string;
  title: string;
  /** Optional; omitted or empty = no subheading under the title. */
  description?: string;
};

export function AnalysisProjectsView({
  module,
  basePath,
  title,
  description = "",
}: AnalysisProjectsViewProps) {
  const projects = useHistoricalProjectsStore((s) => s.projects);

  const filtered = projects.filter((p) => p.analysisModule === module);
  const desc = description.trim();

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
          {desc ? <p className="mt-1 text-[var(--muted-foreground)]">{desc}</p> : null}
        </div>
        <Link
          href={`${basePath}/new`}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create project
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60">
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">Project</th>
              <th className="hidden px-4 py-3 font-medium text-[var(--foreground)] sm:table-cell">
                Asset
              </th>
              <th className="hidden px-4 py-3 font-medium text-[var(--foreground)] md:table-cell">
                Location
              </th>
              <th className="hidden px-4 py-3 font-medium text-[var(--foreground)] lg:table-cell">
                Structural
              </th>
              <th className="hidden px-4 py-3 font-medium text-[var(--foreground)] md:table-cell">
                Floor levels
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-[var(--foreground)] sm:text-sm">
                <span className="sr-only sm:not-sr-only">Defect </span>register
              </th>
              <th className="px-4 py-3 font-medium text-[var(--foreground)]">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                  No projects yet. Create one to begin.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)]/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${basePath}/${p.id}/setup`}
                      className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                    >
                      {p.name}
                    </Link>
                    <div className="mt-0.5 text-xs text-[var(--muted-foreground)] md:hidden">
                      {formatAssetType(p.assetType)} · {p.location || "—"} · {p.floorLevels || "—"}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] sm:table-cell">
                    {formatAssetType(p.assetType)}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] md:table-cell">
                    {p.location || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] lg:table-cell">
                    {formatStructural(p.structuralType)}
                  </td>
                  <td className="hidden max-w-[10rem] px-4 py-3 text-[var(--muted-foreground)] md:table-cell">
                    {p.floorLevels || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`${basePath}/${p.id}/defects`}
                      className="text-teal-700 hover:underline dark:text-teal-300"
                    >
                      Open
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted-foreground)]">
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
