"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createExcelJsWorkbook } from "@/lib/pcdi/load-exceljs-workbook";
import { isMergeFileProxyAllowed } from "@/lib/pcdi/allowed-merge-fetch-url";
import { officeOnlineEmbedUrl } from "@/lib/pcdi/office-online-embed-url";
import { buildExcelHtmlJournalPreview } from "@/lib/pcdi/excel-html-journal-preview";

async function fetchMergeXlsxBuffer(mergeFileUrl: string): Promise<ArrayBuffer> {
  let url = mergeFileUrl;
  let init: RequestInit = { cache: "no-store", mode: "cors" };

  try {
    const parsed = new URL(mergeFileUrl);
    if (isMergeFileProxyAllowed(parsed)) {
      url = "/api/merge-file-proxy";
      init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: mergeFileUrl }),
        cache: "no-store",
      };
    }
  } catch {
    // Invalid URL — let fetch fail below.
  }

  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = "";
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j.error === "string") detail = ` ${j.error}`;
    } catch {
      if (text) detail = ` ${text.slice(0, 200)}`;
    }
    throw new Error(`Could not download file (HTTP ${res.status}).${detail}`);
  }
  return res.arrayBuffer();
}

type PreviewTab = "office" | "grid";

/**
 * Full-fidelity view uses Microsoft Office Online (same engine as Excel on the web): formatting, fills, images.
 * **Grid** tab: Journal-style HTML table (merges, fills) + embedded cell images from the xlsx package.
 */
export function ExcelSheetRowPreview({
  mergeFileUrl,
  excelSheetRow,
  fileName,
}: {
  mergeFileUrl: string;
  excelSheetRow: number;
  /** Suggested download filename for the link next to the viewer. */
  fileName?: string;
}) {
  /** `row_number` / merged analysis resolves to this 1-based sheet row — drive Office `ActiveCell` + grid scroll. */
  const focusRow = Number.isFinite(excelSheetRow) && excelSheetRow >= 1 ? Math.floor(excelSheetRow) : 1;
  const embedSrc = useMemo(
    () =>
      officeOnlineEmbedUrl(mergeFileUrl, {
        // First column on the active sheet — enough to scroll vertically to the source row.
        activeCell: `A${focusRow}`,
      }),
    [mergeFileUrl, focusRow],
  );
  const [tab, setTab] = useState<PreviewTab>(embedSrc ? "office" : "grid");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-2 text-[11px]">
        {embedSrc ? (
          <>
            <button
              type="button"
              onClick={() => setTab("office")}
              className={
                tab === "office"
                  ? "rounded-md bg-[var(--surface-muted)] px-2.5 py-1 font-medium text-[var(--foreground)]"
                  : "rounded-md px-2.5 py-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
              }
            >
              Original workbook
            </button>
            <button
              type="button"
              onClick={() => setTab("grid")}
              className={
                tab === "grid"
                  ? "rounded-md bg-[var(--surface-muted)] px-2.5 py-1 font-medium text-[var(--foreground)]"
                  : "rounded-md px-2.5 py-1 text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]"
              }
            >
              Row {focusRow} (grid)
            </button>
          </>
        ) : (
          <span className="text-[var(--muted-foreground)]">
            Only HTTPS file URLs can use the Excel viewer — showing grid preview.
          </span>
        )}
        <a
          href={mergeFileUrl}
          {...(typeof fileName === "string" && fileName.trim() ? ({ download: fileName.trim() } as const) : {})}
          className="ml-auto shrink-0 rounded-md px-2 py-1 font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download file
        </a>
      </div>
      {embedSrc && tab === "office" ? (
        <div className="flex min-h-[min(72vh,820px)] flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <iframe
            key={embedSrc}
            src={embedSrc}
            title="Excel workbook preview"
            className="h-[min(72vh,820px)] min-h-[480px] w-full flex-1 border-0"
            allowFullScreen
          />
          <p className="border-t border-[var(--border)] px-3 py-2 text-[10px] leading-snug text-[var(--muted-foreground)]">
            Opens at cell <span className="font-mono text-[var(--foreground)]">A{focusRow}</span> (row from merged{" "}
            <span className="font-mono">row_number</span>) when Excel Online honours{" "}
            <span className="font-mono">ActiveCell</span>. Switch to{" "}
            <button
              type="button"
              className="font-medium text-[var(--foreground)] underline-offset-2 hover:underline"
              onClick={() => setTab("grid")}
            >
              Row {focusRow} (grid)
            </button>{" "}
            for the HTML table preview with row highlight and cell images.
          </p>
        </div>
      ) : (
        <ExcelGridRowPreview mergeFileUrl={mergeFileUrl} excelSheetRow={excelSheetRow} />
      )}
    </div>
  );
}

/**
 * HTML grid: Journal-style table (merges, fills, values) + images injected into cells.
 */
function ExcelGridRowPreview({
  mergeFileUrl,
  excelSheetRow,
}: {
  mergeFileUrl: string;
  excelSheetRow: number;
}) {
  const focusRow = Number.isFinite(excelSheetRow) && excelSheetRow >= 1 ? Math.floor(excelSheetRow) : 1;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [html, setHtml] = useState("");
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target;
    if (el instanceof HTMLImageElement && el.classList.contains("xlsx-cell-image")) {
      e.stopPropagation();
      setLightboxSrc(el.currentSrc || el.src);
    }
  }, []);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxSrc]);

  useEffect(() => {
    let cancelled = false;
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    setBusy(true);
    setError(null);
    setHtml("");

    void (async () => {
      try {
        const buf = await fetchMergeXlsxBuffer(mergeFileUrl);
        const { workbook: wb } = await createExcelJsWorkbook();
        await wb.xlsx.load(buf);
        if (cancelled) return;

        const ws = wb.worksheets[0];
        if (!ws) throw new Error("The workbook has no sheets.");

        const { html: nextHtml, objectUrls } = await buildExcelHtmlJournalPreview(buf, ws);
        if (cancelled) {
          objectUrls.forEach((u) => URL.revokeObjectURL(u));
          return;
        }
        objectUrlsRef.current = objectUrls;
        setHtml(nextHtml);
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
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, [mergeFileUrl]);

  useLayoutEffect(() => {
    if (busy || error || !html || !wrapperRef.current) return;
    const table = wrapperRef.current.querySelector("table");
    if (!table) return;
    const rows = table.querySelectorAll("tr");
    const targetIdx = focusRow - 1;
    if (targetIdx < 0 || targetIdx >= rows.length) return;

    const clearRowHighlight = (tr: HTMLElement) => {
      tr.style.removeProperty("background-color");
      tr.style.removeProperty("outline");
      tr.style.removeProperty("outline-offset");
      tr.style.removeProperty("position");
      tr.style.removeProperty("z-index");
      tr.querySelectorAll("td, th").forEach((cell) => {
        const el = cell as HTMLElement;
        el.style.removeProperty("box-shadow");
        el.style.removeProperty("border-left");
      });
    };

    rows.forEach((tr) => clearRowHighlight(tr as HTMLElement));

    const targetRow = rows[targetIdx] as HTMLElement;
    targetRow.style.position = "relative";
    targetRow.style.zIndex = "1";
    targetRow.style.outline = "2px solid rgba(217, 119, 6, 0.65)";
    targetRow.style.outlineOffset = "-1px";

    const cells = targetRow.querySelectorAll("td, th");
    cells.forEach((cell, i) => {
      const el = cell as HTMLElement;
      el.style.boxShadow = "inset 0 0 0 999px rgba(217, 119, 6, 0.1)";
      if (i === 0) {
        el.style.borderLeft = "4px solid rgb(217, 119, 6)";
      }
    });

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        targetRow.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [busy, error, html, focusRow]);

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
    <>
      <div
        ref={wrapperRef}
        className="max-h-[min(78vh,920px)] min-h-[42vh] overflow-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
      >
        <div
          role="presentation"
          onClick={handlePreviewClick}
          className="xlsx-preview-wrapper inline-block min-w-full text-xs leading-snug text-[var(--foreground)] [&_table]:table-fixed [&_table]:border-collapse [&_table]:w-full [&_table]:border [&_table]:border-[var(--border)] [&_th]:border [&_th]:border-[var(--border)] [&_th]:px-1.5 [&_th]:py-1 [&_th]:bg-[var(--surface-muted)] [&_th]:align-top [&_th]:whitespace-pre-wrap [&_th]:break-words [&_td]:border [&_td]:border-[var(--border)] [&_td]:px-1.5 [&_td]:py-1 [&_td]:align-top [&_td]:whitespace-pre-wrap [&_td]:break-words [&_.xlsx-cell-image]:cursor-zoom-in [&_.xlsx-cell-image]:rounded-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      {lightboxSrc ? (
        <div
          className="fixed inset-0 z-[1200] flex cursor-default items-center justify-center bg-black/70 p-4"
          role="presentation"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URLs from xlsx */}
          <img
            src={lightboxSrc}
            alt=""
            className="max-h-[85vh] w-auto max-w-full cursor-zoom-out rounded-lg object-contain shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
