"use client";

import { Check, ChevronDown, FileSpreadsheet, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LiveExcelRowModal } from "@/components/pcdi/live-excel-row-modal";
import {
  bulkApplyLiveStrategyForRows,
  getLiveSelectionFingerprint,
  notifyLiveSelectionsUpdated,
  resolveLiveResponseStrategy,
} from "@/lib/pcdi/live-rows";
import {
  getCategoryStrategySuggestionSplit,
  getRowStrategySuggestionSplit,
} from "@/lib/pcdi/live-strategy-suggestions";
import { readLiveSelectionState } from "@/lib/pcdi/live-selection-session";
import { VISUALISATION_STRATEGY_OPTIONS } from "@/lib/pcdi/live-visualisation-strategies";
import { dataSuggestedStrategyHighlightStyles } from "@/lib/pcdi/mind-map-palette";
import type { CategoryAggregate } from "@/lib/pcdi/defect-category-aggregation";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

function readSelectionsMap(projectId: string): Record<string, string> {
  const fp = getLiveSelectionFingerprint(projectId);
  const s = readLiveSelectionState(projectId);
  return s?.fingerprint === fp ? { ...(s.selections ?? {}) } : {};
}

/** Strategies from the merged file `response_strategy` column only (canonical taxonomy labels). */

function StrategyPickerUi({
  options,
  dataSuggested,
  selected,
  onSelect,
  triggerId = "strategy-picker-trigger",
  noneLabel = "None Selected",
  missingAiHintsNote,
}: {
  options: readonly string[];
  dataSuggested: string[];
  selected: string;
  onSelect: (value: string) => void;
  triggerId?: string;
  noneLabel?: string;
  /** Shown when no parsable values exist on rows’ `response_strategy` column. */
  missingAiHintsNote?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const dataPicks = dataSuggested.filter((opt) => options.includes(opt));
  const restOptions = options.filter((opt) => !dataSuggested.includes(opt));

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${triggerId}-listbox`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground shadow-sm outline-none ring-accent/0 transition hover:border-shale-dry-slate hover:bg-surface-muted/80 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35"
      >
        <span className="min-w-0 flex-1 leading-snug">
          {selected.trim().length > 0 ? selected : noneLabel}
        </span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={`${triggerId}-listbox`}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[220] max-h-[min(50vh,280px)] overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-xl ring-1 ring-black/[0.06]"
        >
          <button
            type="button"
            role="option"
            aria-selected={selected === ""}
            onClick={() => {
              onSelect("");
              setOpen(false);
            }}
            className={`flex w-full items-start gap-2 border-l-[5px] border-neutral-300 bg-neutral-50 px-3 py-2.5 text-left text-sm text-neutral-800 transition hover:bg-neutral-100 ${
              selected === "" ? "ring-2 ring-inset ring-neutral-900/15" : ""
            }`}
          >
            {selected === "" ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-800" aria-hidden /> : (
              <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1 leading-snug font-medium">{noneLabel}</span>
          </button>

          {missingAiHintsNote ? (
            <p className="border-t border-amber-200/80 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-950">
              {missingAiHintsNote}
            </p>
          ) : null}

          {dataPicks.length > 0 ? (
            <>
              <div className="my-1 border-t border-neutral-100" />
              <div className="sticky top-0 z-[1] border-b border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-muted)]/75 to-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--deep-shale)]">
                Data-suggested strategies
              </div>
              {dataPicks.map((opt, hiIdx) => {
                const isSel = selected === opt;
                const hi = dataSuggestedStrategyHighlightStyles(hiIdx);
                return (
                  <button
                    key={`data-${opt}`}
                    type="button"
                    role="option"
                    aria-selected={isSel}
                    style={hi.rowStyle}
                    onClick={() => {
                      onSelect(opt);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm text-neutral-900 transition hover:brightness-[0.98] ${
                      isSel ? "ring-2 ring-inset ring-neutral-900/20" : ""
                    }`}
                  >
                    {isSel ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-800" aria-hidden /> : (
                      <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 leading-snug font-medium">{opt}</span>
                    <span
                      style={hi.badgeStyle}
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm"
                    >
                      Data
                    </span>
                  </button>
                );
              })}
            </>
          ) : null}

          <div className="my-1 border-t border-neutral-100" />

          <div className="sticky top-0 z-[1] bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            All strategies
          </div>
          {restOptions.map((opt) => {
            const isSel = selected === opt;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2 border-l-[5px] border-transparent px-3 py-2.5 text-left text-sm text-neutral-700 transition hover:bg-neutral-50 ${
                  isSel ? "bg-neutral-50 ring-2 ring-inset ring-neutral-900/10" : ""
                }`}
              >
                {isSel ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden /> : (
                  <span className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="min-w-0 flex-1 leading-snug">{opt}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function strategyForRowGenerate(
  row: HistoricalDefectTableRow,
  draftByRow: Record<string, string>,
  selectionsMap: Record<string, string>,
): string {
  return (
    (draftByRow[row.id] ?? "").trim() ||
    resolveLiveResponseStrategy(row, selectionsMap).trim()
  );
}

function buildMockDefectResponse(
  defectDescription: string,
  strategyLabel: string,
  variant: number,
): string {
  const trimmed = defectDescription.trim();
  const short =
    trimmed.length > 120 ? `${trimmed.slice(0, 120)}…` : trimmed;
  const blocks = [
    `Recommended approach: ${strategyLabel}. ` +
      "Raise a targeted corrective action with clear acceptance criteria and a verification hold point before closing the item in the register.",
    short
      ? `Defect context: “${short}” — confirm root cause on site before works start; capture photographs at before / during / after.`
      : "No description text on this row — agree an inspection brief and document the site condition before closing.",
    "Coordinate with the responsible subcontractor, record agreed dates, and obtain sign‑off that satisfies programme and quality gates.",
  ];
  if (variant > 0) {
    blocks.push(
      "Regenerated note: double‑check adjacent zones for copy‑through defects and update the BIM/metadata trail if scope changes.",
    );
  }
  return blocks.join("\n\n");
}

type Props = {
  open: boolean;
  onClose: () => void;
  aggregate: CategoryAggregate | null;
  projectId: string;
};

export function DefectCategorySidebar({ open, onClose, aggregate, projectId }: Props) {
  const [bulkStrategy, setBulkStrategy] = useState<string>("");
  const [draftByRow, setDraftByRow] = useState<Record<string, string>>({});
  const [selectionsMap, setSelectionsMap] = useState<Record<string, string>>({});
  const [appliedHint, setAppliedHint] = useState<string | null>(null);
  const [excelRowId, setExcelRowId] = useState<string | null>(null);
  /** Mock generated copy per row (session only — resets when the drawer category changes). */
  const [responseByRow, setResponseByRow] = useState<Record<string, string>>({});
  const [regenerateCountByRow, setRegenerateCountByRow] = useState<Record<string, number>>({});
  const [generatingRowId, setGeneratingRowId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const bulkSuggestions = useMemo(
    () =>
      aggregate ? getCategoryStrategySuggestionSplit(aggregate.rows) : { dataSuggested: [] as string[] },
    [aggregate],
  );

  useEffect(() => {
    if (!open || !aggregate) return;
    setAppliedHint(null);
    setExcelRowId(null);
    setBulkStrategy("");
    setResponseByRow({});
    setRegenerateCountByRow({});
    setGeneratingRowId(null);
    setBulkGenerating(false);
    const map = readSelectionsMap(projectId);
    setSelectionsMap(map);
    const drafts: Record<string, string> = {};
    for (const r of aggregate.rows) drafts[r.id] = map[r.id] ?? "";
    setDraftByRow(drafts);
  }, [open, aggregate, projectId]);

  const rowsWithStrategy = useMemo(() => {
    if (!aggregate) return 0;
    return aggregate.rows.filter((r) =>
      strategyForRowGenerate(r, draftByRow, selectionsMap),
    ).length;
  }, [aggregate, draftByRow, selectionsMap]);

  if (!open || !aggregate) return null;

  const onApplyAll = () => {
    const ids = aggregate.rows.map((r) => r.id);
    bulkApplyLiveStrategyForRows(projectId, ids, bulkStrategy);
    const map = readSelectionsMap(projectId);
    setSelectionsMap(map);
    const drafts: Record<string, string> = {};
    for (const r of aggregate.rows) drafts[r.id] = map[r.id] ?? "";
    setDraftByRow(drafts);
    notifyLiveSelectionsUpdated(projectId);
    const label = bulkStrategy.trim().length > 0 ? bulkStrategy : "None Selected";
    setAppliedHint(`Applied “${label}” to ${ids.length} defect${ids.length === 1 ? "" : "s"}.`);
  };

  const applyRowStrategy = (rowId: string) => {
    const v = draftByRow[rowId] ?? "";
    bulkApplyLiveStrategyForRows(projectId, [rowId], v);
    const map = readSelectionsMap(projectId);
    setSelectionsMap(map);
    notifyLiveSelectionsUpdated(projectId);
    const label = v.trim().length > 0 ? v : "None Selected";
    setAppliedHint(`Saved “${label}” for ${rowId}.`);
  };

  const runGenerateRow = (rowId: string, asRegenerate: boolean) => {
    const row = aggregate.rows.find((r) => r.id === rowId);
    if (!row) return;
    const strat = strategyForRowGenerate(row, draftByRow, selectionsMap);
    if (!strat) return;
    setGeneratingRowId(rowId);
    const variant = asRegenerate ? (regenerateCountByRow[rowId] ?? 0) + 1 : 0;
    if (asRegenerate) setRegenerateCountByRow((p) => ({ ...p, [rowId]: variant }));
    window.setTimeout(() => {
      const text = buildMockDefectResponse(row.defectDescription, strat, asRegenerate ? variant : 0);
      setResponseByRow((prev) => ({ ...prev, [rowId]: text }));
      setGeneratingRowId(null);
    }, 450);
  };

  const onGenerateAllResponses = () => {
    if (rowsWithStrategy === 0) return;
    setBulkGenerating(true);
    window.setTimeout(() => {
      const next: Record<string, string> = {};
      let count = 0;
      for (const row of aggregate.rows) {
        const strat = strategyForRowGenerate(row, draftByRow, selectionsMap);
        if (!strat) continue;
        next[row.id] = buildMockDefectResponse(row.defectDescription, strat, 0);
        count += 1;
      }
      setResponseByRow((prev) => ({ ...prev, ...next }));
      setBulkGenerating(false);
      setAppliedHint(`Generated mock responses for ${count} defect${count === 1 ? "" : "s"} with a strategy selected.`);
    }, 500);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        className="fixed inset-0 z-[205] bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[210] flex h-full w-full max-w-[min(56rem,100%)] flex-col overflow-hidden border-l border-border bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="defect-category-sidebar-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="defect-category-sidebar-title" className="text-base font-semibold leading-snug text-foreground">
              {aggregate.categoryKey}
            </h2>
            <p className="mt-0.5 text-xs text-foreground-muted">
              {aggregate.count} defect{aggregate.count === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 space-y-2 border-b border-border px-4 py-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
            <div className="min-w-0 flex-1 lg:min-w-[220px]">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
                Response strategy (all in category)
              </span>
              <StrategyPickerUi
                triggerId="strategy-picker-bulk"
                options={VISUALISATION_STRATEGY_OPTIONS}
                dataSuggested={bulkSuggestions.dataSuggested}
                selected={bulkStrategy}
                onSelect={setBulkStrategy}
                missingAiHintsNote={
                  bulkSuggestions.dataSuggested.length === 0
                    ? "No values in the response_strategy column for rows in this category. Green “Data” rows list strategies parsed from that column only."
                    : null
                }
              />
            </div>
            <button
              type="button"
              onClick={onApplyAll}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover active:bg-accent-active lg:mb-0.5"
            >
              Apply to all
            </button>
            <button
              type="button"
              disabled={rowsWithStrategy === 0 || bulkGenerating}
              onClick={onGenerateAllResponses}
              className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50 lg:mb-0.5"
            >
              {bulkGenerating ? "Generating…" : "Generate all responses"}
            </button>
          </div>
          {appliedHint ? <p className="text-xs text-accent">{appliedHint}</p> : null}
          <p className="text-[11px] leading-snug text-foreground-muted">
            “None Selected” clears overrides for that scope. Per-defect overrides update the category bubble mix. Select a
            strategy (saved or in the row picker) to enable Generate. Click a row title area for spreadsheet preview when an
            upload exists.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <p className="mb-2 shrink-0 text-xs font-medium uppercase tracking-wide text-foreground-muted">Defect items</p>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-surface-muted/40">
            <ul className="divide-y divide-border-subtle">
              {aggregate.rows.map((row) => {
                const effective = resolveLiveResponseStrategy(row, selectionsMap).trim() || "—";
                const rowSuggestions = getRowStrategySuggestionSplit(row);
                const hasStrategy = Boolean(
                  strategyForRowGenerate(row, draftByRow, selectionsMap),
                );
                const generated = responseByRow[row.id];
                const busy = generatingRowId === row.id;
                return (
                  <li
                    key={row.id}
                    className="grid gap-3 px-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.95fr)] lg:items-start lg:gap-4"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setExcelRowId(row.id)}
                        className="flex w-full gap-2 text-left text-sm transition hover:opacity-95"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-mono text-[11px] text-accent">{row.id}</span>
                          <p className="mt-1 leading-snug text-foreground">{row.defectDescription}</p>
                        </span>
                        <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" aria-hidden />
                      </button>
                      <p className="mt-2 text-[11px] text-foreground-muted">
                        Effective strategy: <span className="text-foreground">{effective}</span>
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1">
                          <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-foreground-muted">
                            Override for this defect
                          </span>
                          <StrategyPickerUi
                            triggerId={`strategy-row-${row.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`}
                            options={VISUALISATION_STRATEGY_OPTIONS}
                            dataSuggested={rowSuggestions.dataSuggested}
                            selected={draftByRow[row.id] ?? ""}
                            onSelect={(v) => setDraftByRow((prev) => ({ ...prev, [row.id]: v }))}
                            missingAiHintsNote={
                              rowSuggestions.dataSuggested.length === 0
                                ? "No response_strategy value on this row (or it could not be mapped to taxonomy v2)."
                                : null
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => applyRowStrategy(row.id)}
                          className="shrink-0 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80"
                        >
                          Apply to this defect
                        </button>
                      </div>
                    </div>

                    <div className="flex min-h-[120px] min-w-0 flex-col rounded-lg border border-border bg-surface px-3 py-3 shadow-sm">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
                        Proposed response
                      </p>
                      {generated ? (
                        <>
                          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border-subtle bg-surface-muted/50 p-2.5">
                            <p className="whitespace-pre-line text-xs leading-relaxed text-foreground">
                              {generated}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={!hasStrategy || busy}
                            onClick={() => runGenerateRow(row.id, true)}
                            className="mt-2 w-full shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? "Regenerating…" : "Re-generate response"}
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-1 flex-col justify-center gap-2">
                          {!hasStrategy ? (
                            <p className="text-[11px] leading-snug text-foreground-muted">
                              Select a response strategy above (or rely on the saved / suggested default) to generate a
                              draft reply.
                            </p>
                          ) : null}
                          <button
                            type="button"
                            disabled={!hasStrategy || busy}
                            onClick={() => runGenerateRow(row.id, false)}
                            className="w-full rounded-lg bg-accent px-3 py-2.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? "Generating…" : "Generate response"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>

      <LiveExcelRowModal
        projectId={projectId}
        registerRowId={excelRowId}
        open={excelRowId !== null}
        onClose={() => setExcelRowId(null)}
      />
    </>
  );
}
