"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mergeHistoricalAiMappingWithColumns,
  readHistoricalAiColumnMapping,
  writeHistoricalAiColumnMapping,
} from "@/lib/pcdi/map-session";
import type { HistoricalColumnAiMapping } from "@/lib/pcdi/types";

export type ColumnMapperProps = {
  projectId: string;
  /** When empty, nothing is rendered. */
  columns: string[];
  source?: { fileName: string; headerRow: number };
  continueHref: string;
  continueLabel: string;
  /** Live vs historical: copy only. */
  mode?: "historical" | "live";
  /** If set, called when the user finishes instead of in-app `router.push(continueHref)` (e.g. one-page flow). */
  onFinish?: () => void;
};

function mappingToDefectColumnSelection(m: HistoricalColumnAiMapping, columns: string[]): Set<string> {
  const sel = new Set<string>();
  for (const c of columns) {
    if ((m[c] ?? []).includes("ai_defect_category")) sel.add(c);
  }
  return sel;
}

function writeSelectionToMapping(
  selected: Set<string>,
  columns: string[],
): HistoricalColumnAiMapping {
  const o: HistoricalColumnAiMapping = {};
  for (const c of columns) {
    o[c] = selected.has(c) ? ["ai_defect_category"] : [];
  }
  return o;
}

export function ColumnMapper({
  projectId,
  columns,
  source,
  continueHref,
  continueLabel,
  mode: _mode = "historical",
  onFinish,
}: ColumnMapperProps) {
  const router = useRouter();

  const [selectedDefectColumns, setSelectedDefectColumns] = useState<Set<string>>(() => {
    const m = mergeHistoricalAiMappingWithColumns(columns, readHistoricalAiColumnMapping(projectId));
    return mappingToDefectColumnSelection(m, columns);
  });

  const columnsKey = columns.join("\0");
  useEffect(() => {
    const m = mergeHistoricalAiMappingWithColumns(columns, readHistoricalAiColumnMapping(projectId));
    setSelectedDefectColumns(mappingToDefectColumnSelection(m, columns));
  }, [projectId, columnsKey, columns]);

  const complete = useMemo(
    () => (columns.length > 0 ? selectedDefectColumns.size > 0 : false),
    [columns.length, selectedDefectColumns.size],
  );

  const persistMapping = useCallback(
    (next: Set<string>) => {
      setSelectedDefectColumns(next);
      writeHistoricalAiColumnMapping(projectId, writeSelectionToMapping(next, columns));
    },
    [projectId, columns],
  );

  const toggleColumn = useCallback(
    (column: string) => {
      const next = new Set(selectedDefectColumns);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      persistMapping(next);
    },
    [selectedDefectColumns, persistMapping],
  );

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {source ? (
        <p className="text-sm text-[var(--muted-foreground)]">
          From <span className="font-medium text-[var(--foreground)]">{source.fileName}</span>
          {" · "}
          header row{" "}
          <span className="font-medium text-[var(--foreground)]">{source.headerRow}</span>
        </p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid grid-cols-1 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Spreadsheet column</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-800 md:mt-0 md:text-right dark:text-teal-200">
            Use for defect categorisation
          </p>
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]" role="list">
          {columns.map((c, i) => {
            const on = selectedDefectColumns.has(c);
            return (
              <li key={`${i}-${c}`} className="grid grid-cols-1 items-center gap-3 px-4 py-3.5 md:grid-cols-[1fr_auto]">
                <span className="min-w-0 text-sm font-medium text-[var(--foreground)]">{c}</span>
                <div className="flex items-center justify-end md:pl-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleColumn(c)}
                    className="size-4 cursor-pointer rounded border-[var(--border)] text-[var(--accent)] focus:ring-2 focus:ring-[var(--ring)]"
                    aria-label={`Use column ${c} for defect categorisation`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col items-end gap-2 border-t border-[var(--border-subtle)] pt-6">
        <button
          type="button"
          disabled={!complete}
          onClick={() => {
            if (onFinish) onFinish();
            else router.push(continueHref);
          }}
          className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
