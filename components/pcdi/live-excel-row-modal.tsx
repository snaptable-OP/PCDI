"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { ExcelSheetRowPreview } from "@/components/pcdi/excel-sheet-row-preview";
import { getLiveSourceRowPreview } from "@/lib/pcdi/live-source-row";

type Props = {
  projectId: string;
  registerRowId: string | null;
  open: boolean;
  onClose: () => void;
  /** Billie defect file scope — required for correct merged session row / URLs when multiple analyses exist. */
  defectFileId?: string | null;
};

export function LiveExcelRowModal({
  projectId,
  registerRowId,
  open,
  onClose,
  defectFileId,
}: Props) {
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

  const preview = getLiveSourceRowPreview(projectId, registerRowId, defectFileId);
  if (!preview) {
    const shell = (
      <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="excel-preview-title"
          className="relative max-h-[92vh] w-full max-w-[min(1600px,96vw)] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl"
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
            No spreadsheet row is linked to this register entry, or session data expired. Re-open this analysis from the
            list or run Analyse Defects again so row numbers and file URLs are available.
          </p>
        </div>
      </div>
    );
    if (typeof document === "undefined") return null;
    return createPortal(shell, document.body);
  }

  const { columns, cells, excelSheetRow, mergeFileUrl, isOriginalUpload } = preview;

  const shell = (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-preview-title"
        className="relative flex max-h-[92vh] w-full max-w-[min(1600px,96vw)] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="excel-preview-title" className="text-sm font-semibold text-[var(--foreground)]">
              Source spreadsheet · Row{" "}
              <span className="font-mono text-[var(--muted-foreground)]">{excelSheetRow}</span>
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-[var(--muted-foreground)]">
              Row number comes from the analysed merged export. The preview loads your{" "}
              <span className="font-medium text-[var(--foreground)]">original upload</span> when the link is still valid,
              and highlights that sheet row so you can compare with Billie output.
            </p>
          </div>
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

        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto p-4">
          {mergeFileUrl ? (
            <>
              <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
                {isOriginalUpload === true ? (
                  <>
                    Showing your <span className="font-medium text-[var(--foreground)]">original .xlsx</span>. Row{" "}
                    <span className="font-mono">{excelSheetRow}</span> is the line Billie recorded for this defect after
                    merge (same index on your sheet when layout matches).{" "}
                  </>
                ) : isOriginalUpload === false ? (
                  <>
                    Original upload URL missing or expired — preview uses Billie&apos;s{" "}
                    <span className="font-medium text-[var(--foreground)]">merged export</span>.{" "}
                  </>
                ) : (
                  <>Spreadsheet preview. </>
                )}
                The default <span className="font-medium text-[var(--foreground)]">Original workbook</span> tab uses
                Excel for the web (full formatting and embedded pictures). Use{" "}
                <span className="font-medium text-[var(--foreground)]">Row … (grid)</span> for a lightweight table that
                scrolls to the analysed row.
              </p>
              <ExcelSheetRowPreview
                mergeFileUrl={mergeFileUrl}
                excelSheetRow={excelSheetRow}
                fileName={preview.mergeFileName}
              />
            </>
          ) : columns.length > 0 ? (
            <div className="overflow-x-auto">
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
              <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                Parsed row index {preview.rowIndex + 1} under header · Excel row {excelSheetRow}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              Excel row <span className="font-mono font-medium">{excelSheetRow}</span> is stored for this defect, but no
              file URL is available to load a styled preview. Re-run analysis or open a project that still has the merge
              file link.
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
