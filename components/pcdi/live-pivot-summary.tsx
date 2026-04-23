"use client";

import { useMemo } from "react";
import { inferDocumentTypesFromCategoryAndStrategy } from "@/lib/pcdi/live-inferred-documents";
import { resolveLiveResponseStrategy } from "@/lib/pcdi/live-rows";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

type Props = {
  baseRows: HistoricalDefectTableRow[];
  selections: Record<string, string>;
  bulkConfirmed: boolean;
};

function splitExplicitCitations(text: string | undefined): string[] {
  if (!text?.trim()) return [];
  return [
    ...new Set(
      text
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function LivePivotSummary({ baseRows, selections, bulkConfirmed }: Props) {
  const total = baseRows.length;

  const defectCategoryPivot = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of baseRows) {
      const k = r.defectCategory?.trim() || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [baseRows]);

  const responseStrategyPivot = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of baseRows) {
      const k = resolveLiveResponseStrategy(r, selections).trim() || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [baseRows, selections]);

  const confirmedRowCount = bulkConfirmed ? total : 0;

  const explicitReferenceMentions = useMemo(() => {
    const bag = new Set<string>();
    for (const r of baseRows) {
      for (const part of splitExplicitCitations(r.extractedDocCitations)) {
        bag.add(part);
      }
    }
    return [...bag].sort((a, b) => a.localeCompare(b));
  }, [baseRows]);

  const inferredDocumentTypes = useMemo(() => {
    const bag = new Set<string>();
    for (const r of baseRows) {
      const strategy = resolveLiveResponseStrategy(r, selections);
      for (const line of inferDocumentTypesFromCategoryAndStrategy(r.defectCategory, strategy)) {
        bag.add(line);
      }
    }
    return [...bag].sort((a, b) => a.localeCompare(b));
  }, [baseRows, selections]);

  if (total === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        No parsed rows yet — upload a spreadsheet and map columns first.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-3">
        <p className="text-sm font-semibold text-[var(--foreground)]">Parsed register summary</p>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Total rows
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">{total}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--background)] px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            Rows confirmed
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
            {confirmedRowCount}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-[var(--muted-foreground)]">
            After you confirm selections below, this matches all rows with locked strategies.
          </p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-[var(--border-subtle)] p-4 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Rows by defect category
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full min-w-[200px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 text-left">
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Defect category</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-[var(--foreground)]">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {defectCategoryPivot.map(([label, count]) => (
                  <tr key={label}>
                    <td className="max-w-[240px] px-3 py-2 text-[var(--foreground)]">
                      <span className="line-clamp-2" title={label}>
                        {label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--foreground)]">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            Rows by response strategy (current selection)
          </p>
          <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
            <table className="w-full min-w-[200px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/50 text-left">
                  <th className="px-3 py-2 font-medium text-[var(--foreground)]">Response strategy</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-[var(--foreground)]">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {responseStrategyPivot.map(([label, count]) => (
                  <tr key={label}>
                    <td className="max-w-[240px] px-3 py-2 text-[var(--foreground)]">
                      <span className="line-clamp-2" title={label}>
                        {label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--foreground)]">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--border-subtle)] bg-[var(--accent-muted)]/10 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          References & documents — query pack for responses
        </p>

        <div className="mt-4 space-y-4 text-sm text-[var(--foreground)]">
          <div>
            <p className="font-medium text-[var(--foreground)]">Explicit references in defect descriptions</p>
            {explicitReferenceMentions.length === 0 ? (
              <p className="mt-2 text-[var(--muted-foreground)]">
                No standard-like citations detected in the current defect text (e.g. BS / NHBC / Approved Document
                spans).
              </p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--foreground)]">
                {explicitReferenceMentions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-medium text-[var(--foreground)]">
              Inferred document types (from category + response strategy)
            </p>
            {inferredDocumentTypes.length === 0 ? (
              <p className="mt-2 text-[var(--muted-foreground)]">No inference produced for the current register.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--foreground)]">
                {inferredDocumentTypes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
