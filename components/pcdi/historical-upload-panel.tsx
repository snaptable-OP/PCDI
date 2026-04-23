"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import { parseFirstSheetDataRows, parseSheetColumnHeaders } from "@/lib/pcdi/parse-xlsx-headers";
import type { PcdiUploadSessionPayload } from "@/lib/pcdi/types";
import { clearUploadPayload, writeUploadPayload } from "@/lib/pcdi/upload-session";

type HistoricalUploadPanelProps = {
  projectId: string;
  /** Parent module route e.g. `/historical` or `/live` */
  basePath: string;
  /**
   * `page` = full page with step nav and “Continue to column mapper”.
   * `embedded` = one-page setup: no step nav, no continue (column UI is on the same page).
   */
  layout?: "page" | "embedded";
  /** Fires when a file is parsed successfully (or cleared) so a parent can show column selection. */
  onPayloadChange?: (payload: PcdiUploadSessionPayload | null) => void;
};

const HEADER_ROW_MIN = 1;
const HEADER_ROW_MAX = 1000;

const LIVE_UPLOAD_MAX_DATA_ROWS = 500;

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") &&
    (file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "" ||
      file.type === "application/octet-stream")
  );
}

function clampHeaderRow(n: number): number {
  if (!Number.isFinite(n)) return HEADER_ROW_MIN;
  return Math.min(HEADER_ROW_MAX, Math.max(HEADER_ROW_MIN, Math.floor(n)));
}

export function HistoricalUploadPanel({
  projectId,
  basePath,
  layout = "page",
  onPayloadChange,
}: HistoricalUploadPanelProps) {
  const router = useRouter();
  const isEmbedded = layout === "embedded";
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PcdiUploadSessionPayload | null>(null);
  const [headerRow, setHeaderRow] = useState(1);
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const runParse = useCallback(
    async (file: File, row: number) => {
      setError(null);
      if (!isXlsxFile(file)) {
        setError("Please choose an Excel file (.xlsx).");
        return;
      }
      const rowUsed = clampHeaderRow(row);
      setBusy(true);
      try {
        const buf = await file.arrayBuffer();
        const columns = parseSheetColumnHeaders(buf, { headerRow: rowUsed });
        if (columns.length === 0) {
          setPayload(null);
          onPayloadChange?.(null);
          setError(
            `No column headers found on row ${rowUsed}. Try another header row or check the first sheet.`,
          );
          setBusy(false);
          return;
        }
        const dataRowsRaw =
          basePath === "/live"
            ? parseFirstSheetDataRows(buf, rowUsed).slice(0, LIVE_UPLOAD_MAX_DATA_ROWS)
            : undefined;
        const next: PcdiUploadSessionPayload = {
          projectId,
          fileName: file.name,
          headerRow: rowUsed,
          columns,
          ...(dataRowsRaw && dataRowsRaw.length > 0 ? { dataRows: dataRowsRaw } : {}),
        };
        writeUploadPayload(next);
        setPayload(next);
        onPayloadChange?.(next);
        setHeaderRow(rowUsed);
      } catch {
        setPayload(null);
        onPayloadChange?.(null);
        clearUploadPayload(projectId);
        setError("Could not read that file. Try a different .xlsx export.");
      } finally {
        setBusy(false);
      }
    },
    [projectId, basePath, onPayloadChange],
  );

  const processFile = useCallback(
    (file: File) => {
      setStagedFile(file);
      setError(null);
      setPayload(null);
      onPayloadChange?.(null);
      clearUploadPayload(projectId);
    },
    [projectId, onPayloadChange],
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function onContinue() {
    if (!payload) return;
    if (!isEmbedded) router.push(`${basePath}/${projectId}/setup`);
  }

  function onParseClick() {
    if (!stagedFile) return;
    void runParse(stagedFile, headerRow);
  }

  function onHeaderRowChange(e: React.ChangeEvent<HTMLInputElement>) {
    const n = clampHeaderRow(parseInt(e.target.value, 10) || HEADER_ROW_MIN);
    setHeaderRow(n);
    if (payload) {
      setPayload(null);
      onPayloadChange?.(null);
      clearUploadPayload(projectId);
    }
  }

  const headerRowInputId = isEmbedded ? `header-row-embedded-${projectId}` : "header-row";

  return (
    <div className={isEmbedded ? "w-full max-w-2xl" : "mx-auto max-w-2xl"}>
      {isEmbedded ? null : <IngestionFlowNav currentStep={3} className="mb-6" />}
      {isEmbedded ? null : (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
          <Link href={basePath} className="text-teal-700 hover:underline dark:text-teal-300">
            ← Projects
          </Link>
          <Link
            href={`${basePath}/${projectId}/setup`}
            className="text-teal-700 hover:underline dark:text-teal-300"
          >
            ← Project setup
          </Link>
        </div>
      )}
      {isEmbedded ? (
        <h2
          id="ingest-step-upload"
          className="text-lg font-semibold text-[var(--foreground)]"
        >
          3. Upload spreadsheet and starting row
        </h2>
      ) : (
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Upload spreadsheet</h1>
      )}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target) setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`mt-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 transition ${
          dragOver
            ? "border-teal-500 bg-[var(--accent-muted)]/40"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-teal-600/50"
        }`}
      >
        <FileSpreadsheet className="h-10 w-10 text-teal-600 dark:text-teal-400" aria-hidden />
        <p className="mt-3 text-center text-sm font-medium text-[var(--foreground)]">
          Drag and drop an .xlsx file here
        </p>
        <p className="mt-1 text-center text-xs text-[var(--muted-foreground)]">or</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90">
          <Upload className="h-4 w-4" />
          Browse files
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={onInputChange}
            disabled={busy}
          />
        </label>
      </div>

      {stagedFile ? (
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
            {payload ? "Parse options" : "Before parsing — set starting row"}
          </p>
          <label htmlFor={headerRowInputId} className="mt-2 block text-sm font-medium text-[var(--foreground)]">
            Header / starting row
          </label>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Excel row number where column <strong>names</strong> start (1 = first row in the sheet). Changing
            the row after a successful parse clears the previous result until you parse again.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input
              id={headerRowInputId}
              type="number"
              min={HEADER_ROW_MIN}
              max={HEADER_ROW_MAX}
              value={headerRow}
              onChange={onHeaderRowChange}
              className="w-28 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
            />
            <button
              type="button"
              onClick={onParseClick}
              disabled={busy}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Parse
            </button>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">Reading workbook…</p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {payload ? (
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">{payload.fileName}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Header row <span className="font-medium text-[var(--foreground)]">{payload.headerRow}</span> ·{" "}
            {payload.columns.length} column{payload.columns.length === 1 ? "" : "s"} detected
          </p>
          {isEmbedded ? (
            <p className="mt-3 text-xs font-medium text-teal-800 dark:text-teal-200">
              Use <strong>Column selection</strong> below to choose columns, then continue.
            </p>
          ) : null}
        </div>
      ) : null}

      {isEmbedded ? null : (
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={!payload || busy}
            onClick={onContinue}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to column mapper
          </button>
        </div>
      )}
    </div>
  );
}
