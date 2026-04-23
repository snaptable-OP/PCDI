"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  normalizeCategoryKey,
  partitionRegisterAgainstKnowledgeMap,
} from "@/lib/pcdi/discovery-km-analysis";
import { suggestDiscoveryCategories } from "@/lib/pcdi/mock-ai";
import {
  getDiscoverCategoriesKmMatchMock,
  getHistoricalDefectTableRows,
  type KnowledgeMapMatchRow,
} from "@/lib/pcdi/mock-data";
import { usePcdiGraphStore } from "@/lib/pcdi/store";

type DiscoveryTableProps = {
  projectId: string;
};

function normalizeRows(rows: string[]): string[] {
  return rows.map((s) => s.trim()).filter((s) => s.length > 0);
}

function EditableRows({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-3">
      <p className="sr-only">{label}</p>
      {items.map((row, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={row}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="shrink-0 rounded-lg border border-[var(--border)] p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label={`Remove row ${i + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
      >
        <Plus className="h-4 w-4" />
        Add row
      </button>
    </div>
  );
}

function NovelPublishList({
  novelLabels,
  selectedKeys,
  onToggle,
  sideLabel,
}: {
  novelLabels: string[];
  selectedKeys: ReadonlySet<string>;
  onToggle: (normalizedKey: string, checked: boolean) => void;
  sideLabel: string;
}) {
  if (novelLabels.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 px-4 py-3 text-sm text-[var(--muted-foreground)]">
        No new {sideLabel.toLowerCase()} discovered — every value in the defect register already exists on the
        knowledge map.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {novelLabels.map((label) => {
        const key = normalizeCategoryKey(label);
        const checked = selectedKeys.has(key);
        return (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-teal-200/60 bg-teal-500/[0.06] px-4 py-3 dark:border-teal-800 dark:bg-teal-950/25">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(key, e.target.checked)}
                className="mt-1 size-4 shrink-0 rounded border-teal-400 text-teal-700 focus:ring-teal-600 dark:border-teal-700"
              />
              <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function KmMatchMockTable({
  sideLabel,
  rows,
}: {
  sideLabel: "Defect" | "Response";
  rows: KnowledgeMapMatchRow[];
}) {
  const totalRows = rows.reduce((a, r) => a + r.matchedRowCount, 0);
  const nCat = rows.length;
  if (nCat === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-sm text-[var(--muted-foreground)]">
        No mock match rows for {sideLabel.toLowerCase()} categories.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground)]">
          {sideLabel}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          <span className="font-medium text-[var(--foreground)]">{nCat}</span> existing{" "}
          {nCat === 1 ? "category" : "categories"} on the knowledge map ·{" "}
          <span className="font-medium tabular-nums text-teal-800 dark:text-teal-200">{totalRows}</span>{" "}
          register row{totalRows === 1 ? "" : "s"} matched in total (by{" "}
          {sideLabel.toLowerCase()} category column)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)]/40 text-xs text-[var(--muted-foreground)]">
              <th className="px-3 py-2 font-medium">Knowledge map category (existing)</th>
              <th className="w-[7.5rem] whitespace-nowrap px-3 py-2 text-right font-medium">
                Rows matched
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <tr key={`${sideLabel}-${r.knowledgeMapCategory}`} className="text-[var(--foreground)]">
                <td className="max-w-[min(100%,28rem)] px-3 py-2.5 align-top">{r.knowledgeMapCategory}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sm font-semibold text-teal-800 dark:text-teal-200">
                  {r.matchedRowCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchedList({ labels, heading }: { labels: string[]; heading: string }) {
  if (labels.length === 0) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">
        None of the register values matched existing {heading.toLowerCase()} on the knowledge map.
      </p>
    );
  }
  return (
    <ul className="list-inside list-disc space-y-1 text-sm text-[var(--foreground)]">
      {labels.map((l) => (
        <li key={normalizeCategoryKey(l)}>{l}</li>
      ))}
    </ul>
  );
}

export function DiscoveryTable({ projectId }: DiscoveryTableProps) {
  const nodes = usePcdiGraphStore((s) => s.nodes);

  const kmDefectKeys = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.data.kind === "defect_category") {
        set.add(normalizeCategoryKey(n.data.label));
      }
    }
    return set;
  }, [nodes]);

  const kmResponseKeys = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.data.kind === "response_category") {
        set.add(normalizeCategoryKey(n.data.label));
      }
    }
    return set;
  }, [nodes]);

  const registerRows = useMemo(() => getHistoricalDefectTableRows(projectId), [projectId]);

  const partition = useMemo(
    () => partitionRegisterAgainstKnowledgeMap(registerRows, kmDefectKeys, kmResponseKeys),
    [registerRows, kmDefectKeys, kmResponseKeys],
  );

  const [tab, setTab] = useState<"defect" | "response">("defect");
  const [refRows, setRefRows] = useState<string[]>(() => [
    ...suggestDiscoveryCategories(projectId).referenceDocuments,
  ]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const [selectedDefectPublish, setSelectedDefectPublish] = useState<Set<string>>(() => new Set());
  const [selectedResponsePublish, setSelectedResponsePublish] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const s = suggestDiscoveryCategories(projectId);
    setRefRows([...s.referenceDocuments]);
    setPublishedAt(null);
  }, [projectId]);

  useEffect(() => {
    setSelectedDefectPublish(new Set(partition.defect.novel.map(normalizeCategoryKey)));
    setSelectedResponsePublish(new Set(partition.response.novel.map(normalizeCategoryKey)));
  }, [
    projectId,
    partition.defect.novel.join("\0"),
    partition.response.novel.join("\0"),
  ]);

  const toggleDefect = useCallback((key: string, checked: boolean) => {
    setSelectedDefectPublish((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const toggleResponse = useCallback((key: string, checked: boolean) => {
    setSelectedResponsePublish((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const upsertFromDiscovery = usePcdiGraphStore((s) => s.upsertFromDiscovery);

  function handlePublish() {
    const defectCategories = partition.defect.novel.filter((l) =>
      selectedDefectPublish.has(normalizeCategoryKey(l)),
    );
    const responseCategories = partition.response.novel.filter((l) =>
      selectedResponsePublish.has(normalizeCategoryKey(l)),
    );
    const referenceDocuments = normalizeRows(refRows);

    upsertFromDiscovery({
      projectId,
      defectCategories,
      responseCategories,
      referenceDocuments,
    });
    setPublishedAt(new Date().toISOString());
  }

  const canPublish = useMemo(() => {
    const anyDefect = partition.defect.novel.some((l) =>
      selectedDefectPublish.has(normalizeCategoryKey(l)),
    );
    const anyResponse = partition.response.novel.some((l) =>
      selectedResponsePublish.has(normalizeCategoryKey(l)),
    );
    const refs = normalizeRows(refRows).length > 0;
    return anyDefect || anyResponse || refs;
  }, [partition.defect.novel, partition.response.novel, selectedDefectPublish, selectedResponsePublish, refRows]);

  const kmMatchMock = useMemo(() => getDiscoverCategoriesKmMatchMock(projectId), [projectId]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-4 text-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold text-[var(--foreground)]">Compared to the knowledge map</p>
            <p className="mt-1 max-w-prose text-xs text-[var(--muted-foreground)]">
              Which existing categories on the graph aligned with your register for this review. Row counts are
              mock preview data until ingestion APIs return live totals.
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-900 dark:text-amber-100">
            Mock breakdown
          </span>
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <KmMatchMockTable sideLabel="Defect" rows={kmMatchMock.defect} />
          <KmMatchMockTable sideLabel="Response" rows={kmMatchMock.response} />
        </div>
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">
          Unique match / new counts for publishing are still derived from your register vs the graph in each tab
          below (case-insensitive).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab("defect")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "defect"
              ? "border-teal-600 text-[var(--foreground)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Defect categories
        </button>
        <button
          type="button"
          onClick={() => setTab("response")}
          className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
            tab === "response"
              ? "border-teal-600 text-[var(--foreground)]"
              : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          Response categories
        </button>
      </div>

      {tab === "defect" ? (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Matched knowledge map
            </h2>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <MatchedList labels={partition.defect.matched} heading="defect categories" />
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              New categories discovered — publish to knowledge map
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Selected items are added as nodes on the next publish. Unmatched register values appear here.
            </p>
            <NovelPublishList
              novelLabels={partition.defect.novel}
              selectedKeys={selectedDefectPublish}
              onToggle={toggleDefect}
              sideLabel="defect categories"
            />
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Matched knowledge map
            </h2>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <MatchedList labels={partition.response.matched} heading="response categories" />
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              New categories discovered — publish to knowledge map
            </h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              Selected items are added as nodes on the next publish.
            </p>
            <NovelPublishList
              novelLabels={partition.response.novel}
              selectedKeys={selectedResponsePublish}
              onToggle={toggleResponse}
              sideLabel="response categories"
            />
          </section>
        </div>
      )}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Reference documents (optional)
        </h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Included when publishing; linked in the graph where response categories are published.
        </p>
        <div className="mt-3">
          <EditableRows
            label="References"
            items={refRows}
            onChange={setRefRows}
            placeholder="e.g. BS EN 1366-3"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {publishedAt ? (
            <p className="text-teal-800 dark:text-teal-200" role="status">
              Published to knowledge map at{" "}
              {new Date(publishedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              .
            </p>
          ) : (
            <p className="text-[var(--muted-foreground)]">
              Publish adds selected new categories (and references) into the shared graph store (localStorage:{" "}
              <code className="rounded bg-[var(--surface)] px-1 text-xs">pcdi-graph-v1</code>).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPublish}
            onClick={handlePublish}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish to knowledge map
          </button>
          <Link
            href="/knowledge-map"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Open knowledge map
          </Link>
        </div>
      </div>
      {!canPublish ? (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          Select at least one new category to publish, or add a reference document row.
        </p>
      ) : null}
    </div>
  );
}
