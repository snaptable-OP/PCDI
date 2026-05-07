"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ExcelSheetRowPreview } from "@/components/pcdi/excel-sheet-row-preview";
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
      <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]">
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

  const { columns, cells, excelSheetRow, mergeFileUrl, isOriginalUpload } = preview;

  return (
    <div
      className="fixed inset-0 z-[230] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-preview-title"
        className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 id="excel-preview-title" className="text-sm font-semibold text-[var(--foreground)]">
            Source spreadsheet · Excel row{" "}
            <span className="font-mono text-[var(--muted-foreground)]">{excelSheetRow}</span>
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

        <div className="space-y-3 p-4">
          {mergeFileUrl ? (
            <>
              <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">
                {isOriginalUpload === true ? (
                  <>
                    Loading your <span className="font-medium text-[var(--foreground)]">original upload</span> (full
                    sheet, all columns).{" "}
                  </>
                ) : isOriginalUpload === false ? (
                  <>
                    Using Billie&apos;s{" "}
                    <span className="font-medium text-[var(--foreground)]">merged export</span> — original upload URL
                    missing or expired; this file may omit columns from your raw spreadsheet.{" "}
                  </>
                ) : (
                  <>Spreadsheet preview. </>
                )}
                <span className="font-medium text-[var(--foreground)]">ExcelJS</span> renders values and basic styles.
                Embedded photos remain inside the workbook package but are not drawn in this grid yet (JSZip + OOXML
                overlay can render floating images on sheet 1).
              </p>
              <ExcelSheetRowPreview mergeFileUrl={mergeFileUrl} excelSheetRow={excelSheetRow} />
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
              Excel row <span className="font-mono font-medium">{excelSheetRow}</span> is stored for this defect, but
              no file URL is available to load a styled preview. Re-run analysis or open a project that still has the
              merged file link.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
