"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getLiveSourceRowPreview } from "@/lib/pcdi/live-source-row";

type Props = {
  projectId: string;
  registerRowId: string | null;
  open: boolean;
  onClose: () => void;
};

export function LiveExcelRowModal({ projectId, registerRowId, open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !registerRowId) return null;

  const preview = getLiveSourceRowPreview(projectId, registerRowId);
  if (!preview) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="excel-preview-title"
          className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <h2 id="excel-preview-title" className="pr-10 text-lg font-semibold text-[var(--foreground)]">
            Source row
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            No uploaded spreadsheet row is linked to this register entry (e.g. prototype seed data). Upload a file
            to see the original Excel row.
          </p>
        </div>
      </div>
    );
  }

  const { columns, cells, rowIndex } = preview;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-preview-title"
        className="relative max-h-[90vh] w-full max-w-[min(56rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 id="excel-preview-title" className="text-sm font-semibold text-[var(--foreground)]">
            Source spreadsheet row{" "}
            <span className="font-normal text-[var(--muted-foreground)]">(data row {rowIndex + 1})</span>
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-2 text-left font-semibold text-[var(--foreground)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-[14rem] border border-[var(--border)] bg-[var(--background)] px-2 py-2 align-top text-[var(--foreground)]"
                  >
                    <span className="whitespace-pre-wrap break-words">{cells[col] ?? ""}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
