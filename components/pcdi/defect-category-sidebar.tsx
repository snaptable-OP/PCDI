"use client";

import { Check, ChevronDown, FileSpreadsheet, Save, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
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
import {
  effectiveStrategyByRow,
  persistDrawerStrategyDrafts,
  saveDefectDrawerToBackend,
} from "@/lib/pcdi/save-defect-drawer-state";
import { VISUALISATION_STRATEGY_OPTIONS } from "@/lib/pcdi/live-visualisation-strategies";
import { dataSuggestedStrategyHighlightStyles } from "@/lib/pcdi/mind-map-palette";
import type { CategoryAggregate } from "@/lib/pcdi/defect-category-aggregation";
import { generateDefectResponseForLiveRow } from "@/lib/pcdi/generate-defect-response";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";
import { useKnowledgeFoldersSync } from "@/lib/pcdi/use-knowledge-folders-sync";
import { useResponseAgentsSync } from "@/lib/pcdi/use-response-agents-sync";

function readSelectionsMap(projectId: string, defectFileId?: string | null): Record<string, string> {
  const fp = getLiveSelectionFingerprint(projectId, defectFileId);
  const s = readLiveSelectionState(projectId, defectFileId);
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

type Props = {
  open: boolean;
  onClose: () => void;
  aggregate: CategoryAggregate | null;
  projectId: string;
  defectFileId?: string | null;
  /** Lifted from mind map: generated response text per register row id (all categories). */
  generatedResponsesByRowId: Record<string, string>;
  setGeneratedResponsesByRowId: Dispatch<SetStateAction<Record<string, string>>>;
};

export function DefectCategorySidebar({
  open,
  onClose,
  aggregate,
  projectId,
  defectFileId,
  generatedResponsesByRowId,
  setGeneratedResponsesByRowId,
}: Props) {
  const [bulkStrategy, setBulkStrategy] = useState<string>("");
  const [draftByRow, setDraftByRow] = useState<Record<string, string>>({});
  const [selectionsMap, setSelectionsMap] = useState<Record<string, string>>({});
  const [appliedHint, setAppliedHint] = useState<string | null>(null);
  const [appliedHintIsError, setAppliedHintIsError] = useState(false);
  const { loading: foldersLoading } = useKnowledgeFoldersSync(projectId);
  const { loading: agentsLoading, error: agentsSyncError } = useResponseAgentsSync(projectId);
  const agentsReady = !foldersLoading && !agentsLoading;
  const [excelRowId, setExcelRowId] = useState<string | null>(null);
  const [generatingRowId, setGeneratingRowId] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const bulkSuggestions = useMemo(
    () =>
      aggregate ? getCategoryStrategySuggestionSplit(aggregate.rows) : { dataSuggested: [] as string[] },
    [aggregate],
  );

  useEffect(() => {
    if (!open || !aggregate) return;
    setAppliedHint(null);
    setAppliedHintIsError(false);
    setExcelRowId(null);
    setBulkStrategy("");
    setGeneratingRowId(null);
    setBulkGenerating(false);
    const map = readSelectionsMap(projectId, defectFileId);
    setSelectionsMap(map);
    const drafts: Record<string, string> = {};
    for (const r of aggregate.rows) drafts[r.id] = map[r.id] ?? "";
    setDraftByRow(drafts);
  }, [open, aggregate, projectId, defectFileId]);

  const rowsWithStrategy = useMemo(() => {
    if (!aggregate) return 0;
    return aggregate.rows.filter((r) =>
      strategyForRowGenerate(r, draftByRow, selectionsMap),
    ).length;
  }, [aggregate, draftByRow, selectionsMap]);

  if (!open || !aggregate) return null;

  const onApplyAll = () => {
    const ids = aggregate.rows.map((r) => r.id);
    bulkApplyLiveStrategyForRows(projectId, ids, bulkStrategy, defectFileId);
    const map = readSelectionsMap(projectId, defectFileId);
    setSelectionsMap(map);
    const drafts: Record<string, string> = {};
    for (const r of aggregate.rows) drafts[r.id] = map[r.id] ?? "";
    setDraftByRow(drafts);
    notifyLiveSelectionsUpdated(projectId, defectFileId);
    const label = bulkStrategy.trim().length > 0 ? bulkStrategy : "None Selected";
    setAppliedHintIsError(false);
    setAppliedHint(`Applied “${label}” to ${ids.length} defect${ids.length === 1 ? "" : "s"}.`);
  };

  const applyRowStrategy = (rowId: string) => {
    const v = draftByRow[rowId] ?? "";
    bulkApplyLiveStrategyForRows(projectId, [rowId], v, defectFileId);
    const map = readSelectionsMap(projectId, defectFileId);
    setSelectionsMap(map);
    notifyLiveSelectionsUpdated(projectId, defectFileId);
    const label = v.trim().length > 0 ? v : "None Selected";
    setAppliedHintIsError(false);
    setAppliedHint(`Saved “${label}” for ${rowId}.`);
  };

  const runGenerateRow = async (rowId: string) => {
    const row = aggregate.rows.find((r) => r.id === rowId);
    if (!row) return;
    const strat = strategyForRowGenerate(row, draftByRow, selectionsMap);
    if (!strat) return;
    if (!agentsReady) {
      setAppliedHintIsError(true);
      setAppliedHint("Loading response agents and knowledge folders… try again in a moment.");
      return;
    }
    setGeneratingRowId(rowId);
    setAppliedHint(null);
    setAppliedHintIsError(false);
    const outcome = await generateDefectResponseForLiveRow({
      projectId,
      strategyLabel: strat,
      defectDescription: row.defectDescription,
      defectCategory: row.defectCategory,
    });
    setGeneratingRowId(null);
    if (!outcome.ok) {
      setAppliedHintIsError(true);
      setAppliedHint(outcome.error);
      return;
    }
    setAppliedHintIsError(false);
    setAppliedHint(
      outcome.mode === "mock"
        ? "Demo response (analysis server disabled in local config)."
        : "Generated via POST /api/defect-files/generate-response.",
    );
    setGeneratedResponsesByRowId((prev) => ({ ...prev, [rowId]: outcome.result.answer }));
  };

  const onGenerateAllResponses = async () => {
    if (rowsWithStrategy === 0) return;
    if (!agentsReady) {
      setAppliedHintIsError(true);
      setAppliedHint("Loading response agents and knowledge folders… try again in a moment.");
      return;
    }
    setBulkGenerating(true);
    setAppliedHint(null);
    setAppliedHintIsError(false);
    const next: Record<string, string> = {};
    let count = 0;
    const errors: string[] = [];
    for (const row of aggregate.rows) {
      const strat = strategyForRowGenerate(row, draftByRow, selectionsMap);
      if (!strat) continue;
      const outcome = await generateDefectResponseForLiveRow({
        projectId,
        strategyLabel: strat,
        defectDescription: row.defectDescription,
        defectCategory: row.defectCategory,
      });
      if (!outcome.ok) {
        if (errors.length < 2) errors.push(outcome.error);
        continue;
      }
      next[row.id] = outcome.result.answer;
      count += 1;
    }
    setGeneratedResponsesByRowId((prev) => ({ ...prev, ...next }));
    setBulkGenerating(false);
    const errBit = errors.length ? ` — ${errors[0]}` : "";
    const failed = rowsWithStrategy - count;
    if (count === 0) {
      setAppliedHintIsError(true);
      setAppliedHint(errors[0] ?? "Could not generate responses.");
      return;
    }
    setAppliedHintIsError(failed > 0);
    setAppliedHint(
      failed > 0
        ? `Generated ${count} via POST /api/defect-files/generate-response; ${failed} failed.${errBit}`
        : `Generated ${count} response${count === 1 ? "" : "s"} via POST /api/defect-files/generate-response.`,
    );
  };

  const onSaveAll = async () => {
    const nextSelections = persistDrawerStrategyDrafts(
      projectId,
      defectFileId,
      aggregate.rows.map((r) => r.id),
      draftByRow,
      selectionsMap,
    );
    setSelectionsMap(nextSelections);
    notifyLiveSelectionsUpdated(projectId, defectFileId);

    const strategyByRowId = effectiveStrategyByRow(aggregate.rows, draftByRow, nextSelections);
    const fileId = typeof defectFileId === "string" ? defectFileId.trim() : "";

    if (!fileId) {
      onClose();
      return;
    }

    setSaveBusy(true);
    setAppliedHint(null);
    try {
      const result = await saveDefectDrawerToBackend({
        defectFileId: fileId,
        rows: aggregate.rows,
        strategyByRowId,
        responseByRow: generatedResponsesByRowId,
      });
      const parts: string[] = [];
      if (result.strategiesPushed > 0) {
        parts.push(`Updated strategies for ${result.strategiesPushed} item${result.strategiesPushed === 1 ? "" : "s"}`);
      }
      if (result.responsesPushed > 0) {
        parts.push(`Saved ${result.responsesPushed} generated response${result.responsesPushed === 1 ? "" : "s"}`);
      }
      const warnPreview = result.warnings.slice(0, 3).join(" ");
      const more =
        result.warnings.length > 3 ? ` (+${result.warnings.length - 3} more)` : "";
      setAppliedHint(
        [parts.join(". "), warnPreview ? `${warnPreview}${more}` : ""].filter(Boolean).join(" — ") ||
          "Saved.",
      );
      onClose();
    } catch (e) {
      setAppliedHint(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaveBusy(false);
    }
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
              disabled={rowsWithStrategy === 0 || bulkGenerating || !agentsReady}
              onClick={() => void onGenerateAllResponses()}
              className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50 lg:mb-0.5"
            >
              {bulkGenerating ? "Generating…" : "Generate all responses"}
            </button>
            <button
              type="button"
              disabled={saveBusy}
              onClick={() => void onSaveAll()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-700/35 bg-emerald-700/12 px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-700/18 disabled:cursor-not-allowed disabled:opacity-50 lg:mb-0.5"
            >
              <Save className="h-4 w-4 shrink-0" aria-hidden />
              {saveBusy ? "Saving…" : "Save"}
            </button>
          </div>
          {agentsSyncError ? (
            <p className="text-xs text-red-700" role="alert">
              Could not load response agents: {agentsSyncError}
            </p>
          ) : null}
          {!agentsReady && !agentsSyncError ? (
            <p className="text-xs text-foreground-muted">Loading response agents for generate…</p>
          ) : null}
          {appliedHint ? (
            <p
              className={`text-xs ${appliedHintIsError ? "text-red-700" : "text-accent"}`}
              role={appliedHintIsError ? "alert" : "status"}
            >
              {appliedHint}
            </p>
          ) : null}
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
                const responseDraft = generatedResponsesByRowId[row.id];
                const hasResponseDraft = responseDraft !== undefined;
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
                      {hasResponseDraft ? (
                        <>
                          <textarea
                            value={responseDraft}
                            onChange={(e) =>
                              setGeneratedResponsesByRowId((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                            rows={8}
                            spellCheck
                            className="min-h-[7.5rem] w-full resize-y rounded-md border border-border-subtle bg-surface-muted/50 px-2.5 py-2 text-xs leading-relaxed text-foreground outline-none ring-accent/20 placeholder:text-foreground-muted focus:ring-2"
                            aria-label={`Edit proposed response for defect ${row.id}`}
                          />
                          <button
                            type="button"
                            disabled={!hasStrategy || busy || !agentsReady}
                            onClick={() => void runGenerateRow(row.id)}
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
                            disabled={!hasStrategy || busy || !agentsReady}
                            onClick={() => void runGenerateRow(row.id)}
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
        defectFileId={defectFileId}
      />
    </>
  );
}
