"use client";

import { useMemo, useState } from "react";
import { hashString } from "@/lib/pcdi/hash";
import { getSuggestedStrategyTags, NONE_APPLICABLE_STRATEGY } from "@/lib/pcdi/live-correlation";
import { MOCK_RESPONSE_CATEGORY_STRATEGY_LABELS } from "@/lib/pcdi/mock-data";
import { resolveLiveResponseStrategy } from "@/lib/pcdi/live-rows";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

const TAG_PALETTE = [
  "bg-teal-700 text-white dark:bg-teal-600",
  "bg-indigo-800 text-white dark:bg-indigo-700",
  "bg-amber-700 text-white dark:bg-amber-700",
  "bg-rose-700 text-white dark:bg-rose-800",
  "bg-emerald-800 text-white dark:bg-emerald-900",
] as const;

function tagClass(label: string, highlighted: boolean): string {
  const h = parseInt(hashString(label).slice(0, 8), 16) || 0;
  const base = TAG_PALETTE[h % TAG_PALETTE.length];
  if (!highlighted) {
    return "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted-foreground)] opacity-55";
  }
  return `${base} shadow-sm ring-2 ring-[var(--ring)] ring-offset-1 ring-offset-[var(--surface)]`;
}

type Props = {
  row: HistoricalDefectTableRow;
  selections: Record<string, string>;
  confirmed: boolean;
  onPick: (rowId: string, strategy: string) => void;
};

export function LiveStrategyTagPicker({ row, selections, confirmed, onPick }: Props) {
  const suggested = useMemo(() => getSuggestedStrategyTags(row.defectCategory), [row.defectCategory]);
  const effective = resolveLiveResponseStrategy(row, selections);
  const [othersOpen, setOthersOpen] = useState(false);

  const othersList = useMemo(() => {
    const sorted = [...MOCK_RESPONSE_CATEGORY_STRATEGY_LABELS].sort((a, b) => a.localeCompare(b));
    if (!sorted.includes(NONE_APPLICABLE_STRATEGY)) sorted.push(NONE_APPLICABLE_STRATEGY);
    return sorted;
  }, []);

  const inSuggested = suggested.includes(effective);
  const showExternalChoice = Boolean(
    effective && !inSuggested && effective !== NONE_APPLICABLE_STRATEGY,
  );

  return (
    <div className="flex min-w-[200px] max-w-md flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {suggested.map((label) => {
          const highlighted = effective === label;
          return (
            <button
              key={label}
              type="button"
              disabled={confirmed}
              title={label}
              onClick={() => onPick(row.id, label)}
              className={`max-w-full rounded-full px-2.5 py-1 text-left text-xs font-semibold leading-snug transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 ${tagClass(
                label,
                highlighted,
              )}`}
            >
              <span className="line-clamp-2">{label}</span>
            </button>
          );
        })}
        {showExternalChoice ? (
          <span
            className={`max-w-full rounded-full px-2.5 py-1 text-xs font-semibold leading-snug ${tagClass(effective, true)}`}
          >
            <span className="line-clamp-2">{effective}</span>
          </span>
        ) : null}
        <button
          type="button"
          disabled={confirmed}
          onClick={() => onPick(row.id, NONE_APPLICABLE_STRATEGY)}
          title="Not applicable for this defect"
          className={`rounded-full px-2.5 py-1 text-xs font-semibold leading-snug transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 ${tagClass(
            NONE_APPLICABLE_STRATEGY,
            effective === NONE_APPLICABLE_STRATEGY,
          )}`}
        >
          N/A
        </button>
        <button
          type="button"
          disabled={confirmed}
          onClick={() => setOthersOpen(true)}
          className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Others…
        </button>
      </div>

      {othersOpen ? (
        <OthersDialog
          options={othersList}
          current={effective}
          onPick={(v) => {
            onPick(row.id, v);
            setOthersOpen(false);
          }}
          onClose={() => setOthersOpen(false)}
        />
      ) : null}
    </div>
  );
}

function OthersDialog({
  options,
  current,
  onPick,
  onClose,
}: {
  options: string[];
  current: string;
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="others-strategy-title"
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 id="others-strategy-title" className="text-sm font-semibold text-[var(--foreground)]">
            Other response strategies
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Choose one strategy for this row, including when none of the suggested tags apply.
          </p>
        </div>
        <ul className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => onPick(opt)}
                className={`mb-1 w-full rounded-lg px-3 py-2.5 text-left text-sm transition hover:bg-[var(--surface-muted)] ${
                  current === opt ? "bg-[var(--accent-muted)]/40 font-medium text-[var(--foreground)]" : "text-[var(--foreground)]"
                }`}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
