"use client";

import { hashString } from "@/lib/pcdi/hash";
import type { EnrichedDefectRow } from "@/lib/pcdi/types";

const RESPONSE_TAG_CLASSES = [
  "bg-indigo-900 text-white dark:bg-indigo-950 dark:text-white",
  "bg-rose-700 text-white dark:bg-rose-800 dark:text-white",
  "bg-amber-600 text-white dark:bg-amber-700 dark:text-white",
  "bg-emerald-800 text-white dark:bg-emerald-900 dark:text-white",
  "bg-violet-800 text-white dark:bg-violet-900 dark:text-white",
  "bg-sky-900 text-white dark:bg-sky-950 dark:text-white",
  "bg-orange-700 text-white dark:bg-orange-800 dark:text-white",
  "bg-fuchsia-900 text-white dark:bg-fuchsia-950 dark:text-white",
] as const;

function responseCategoryTagClass(label: string): string {
  if (!label.trim()) {
    return "bg-[var(--surface-muted)] text-[var(--foreground)] ring-1 ring-[var(--border)]";
  }
  const h = parseInt(hashString(label).slice(0, 8), 16) || 0;
  return RESPONSE_TAG_CLASSES[h % RESPONSE_TAG_CLASSES.length];
}

type EnrichedDefectsTableProps = {
  rows: EnrichedDefectRow[];
  /** Live projects: labelling for columns where AI will suggest responses / strategy. */
  variant?: "historical" | "live";
};

export function EnrichedDefectsTable({ rows, variant = "historical" }: EnrichedDefectsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">No data rows to show.</p>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <table className="min-w-[720px] w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]/70">
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Defect description</th>
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
              {variant === "live" ? "Response (AI to suggest)" : "Historical response"}
            </th>
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
              {variant === "live" ? "Reference / context" : "Reference document"}
            </th>
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Defect category</th>
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
              {variant === "live" ? "Response strategy (AI to suggest)" : "Response category"}
            </th>
            <th className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
              {variant === "live" ? "References / specs" : "References required"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="max-w-[220px] px-3 py-2.5 text-[var(--foreground)]">
                <span className="line-clamp-4 whitespace-pre-wrap" title={row.defectDescription}>
                  {row.defectDescription || "—"}
                </span>
              </td>
              <td className="max-w-[220px] px-3 py-2.5 text-[var(--foreground)]">
                <span
                  className={`line-clamp-4 whitespace-pre-wrap ${variant === "live" && !row.historicalResponse?.trim() ? "italic text-[var(--muted-foreground)]" : ""}`}
                  title={row.historicalResponse || (variant === "live" ? "Pending AI suggestion" : undefined)}
                >
                  {row.historicalResponse?.trim() ? row.historicalResponse : "—"}
                </span>
              </td>
              <td className="max-w-[180px] px-3 py-2.5 text-[var(--foreground)]">
                <span className="line-clamp-3 whitespace-pre-wrap" title={row.referenceDocumentName}>
                  {row.referenceDocumentName || "—"}
                </span>
              </td>
              <td className="max-w-[160px] px-3 py-2.5 text-[var(--foreground)]">
                <span className="line-clamp-2" title={row.defectCategory}>
                  {row.defectCategory || "—"}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={`inline-block max-w-[200px] rounded-md px-2.5 py-1 text-xs font-semibold leading-snug shadow-sm ${responseCategoryTagClass(row.responseCategory)}`}
                  title={row.responseCategory}
                >
                  {row.responseCategory || "—"}
                </span>
              </td>
              <td className="max-w-[240px] px-3 py-2.5 text-[var(--foreground)]">
                <span className="line-clamp-3 whitespace-pre-wrap" title={row.referencesRequired}>
                  {row.referencesRequired || "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
