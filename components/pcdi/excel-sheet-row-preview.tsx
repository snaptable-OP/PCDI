"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createExcelJsWorkbook } from "@/lib/pcdi/load-exceljs-workbook";

function argbToCss(argb?: string): string | undefined {
  if (!argb || typeof argb !== "string") return undefined;
  const s = argb.trim();
  if (/^[0-9A-Fa-f]{8}$/.test(s)) return `#${s.slice(2)}`;
  if (/^[0-9A-Fa-f]{6}$/.test(s)) return `#${s}`;
  return undefined;
}

function cellFillCss(cell: import("exceljs").Cell): string | undefined {
  const f = cell.fill;
  if (!f || typeof f !== "object") return undefined;
  if ("fgColor" in f && f.fgColor && typeof f.fgColor === "object" && "argb" in f.fgColor) {
    return argbToCss(String((f.fgColor as { argb?: string }).argb));
  }
  return undefined;
}

function cellFontCss(cell: import("exceljs").Cell): import("react").CSSProperties {
  const font = cell.font;
  const style: import("react").CSSProperties = {};
  if (!font || typeof font !== "object") return style;
  if (font.bold) style.fontWeight = "bold";
  if (font.italic) style.fontStyle = "italic";
  if (font.color && typeof font.color === "object" && "argb" in font.color) {
    const c = argbToCss(String((font.color as { argb?: string }).argb));
    if (c) style.color = c;
  }
  return style;
}

const MAX_COLS = 48;
const CONTEXT_ROWS = 18;

/**
 * Loads an .xlsx from URL with ExcelJS (values + basic font/fill). Anchored sheet images are not drawn;
 * those can be layered later via JSZip/OOXML if needed.
 */
export function ExcelSheetRowPreview({
  mergeFileUrl,
  excelSheetRow,
}: {
  mergeFileUrl: string;
  excelSheetRow: number;
}) {
  const anchorRef = useRef<HTMLTableRowElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [table, setTable] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    setTable(null);

    (async () => {
      try {
        const res = await fetch(mergeFileUrl, { cache: "no-store", mode: "cors" });
        if (!res.ok) throw new Error(`Could not download file (HTTP ${res.status}).`);
        const buf = await res.arrayBuffer();
        const { workbook: wb } = await createExcelJsWorkbook();
        await wb.xlsx.load(buf);
        if (cancelled) return;

        const ws = wb.worksheets[0];
        if (!ws) throw new Error("The workbook has no sheets.");

        const lastNum = ws.lastRow?.number ?? excelSheetRow;
        const start = Math.max(1, excelSheetRow - CONTEXT_ROWS);
        const end = Math.min(lastNum, excelSheetRow + CONTEXT_ROWS);

        const rowsOut: ReactNode[] = [];
        for (let r = start; r <= end; r++) {
          const row = ws.getRow(r);
          const cells: ReactNode[] = [];

          for (let c = 1; c <= MAX_COLS; c++) {
            const cell = row.getCell(c);
            const text = cell.text ?? "";
            const bg = cellFillCss(cell);
            const font = cellFontCss(cell);
            cells.push(
              <td
                key={c}
                className="max-w-[10rem] border border-[var(--border)] px-1.5 py-1 align-top text-xs"
                style={{
                  ...font,
                  backgroundColor: bg ?? undefined,
                }}
              >
                <span className="whitespace-pre-wrap break-words">{text}</span>
              </td>,
            );
          }

          const isTarget = r === excelSheetRow;
          rowsOut.push(
            <tr
              key={r}
              ref={isTarget ? anchorRef : undefined}
              data-excel-row={r}
              className={
                isTarget
                  ? "bg-amber-100/90 ring-2 ring-inset ring-amber-500/40 dark:bg-amber-950/40"
                  : "bg-[var(--background)]"
              }
            >
              <td className="sticky left-0 z-[1] w-10 shrink-0 border border-[var(--border)] bg-[var(--surface-muted)] px-1 py-1 text-center font-mono text-[10px] text-[var(--muted-foreground)]">
                {r}
              </td>
              {cells}
            </tr>,
          );
        }

        setTable(
          <table className="w-full min-w-max border-collapse text-[var(--foreground)]">
            <tbody>{rowsOut}</tbody>
          </table>,
        );
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load spreadsheet preview.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mergeFileUrl, excelSheetRow]);

  useEffect(() => {
    if (busy || error) return;
    const t = window.setTimeout(() => {
      anchorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 100);
    return () => window.clearTimeout(t);
  }, [busy, error, table]);

  if (busy) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Loading spreadsheet preview…</p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] sm:max-h-[60vh]">
      {table}
    </div>
  );
}
