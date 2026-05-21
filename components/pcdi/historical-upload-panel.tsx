"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import {
  extractColumnNamesFromBackendPayload,
  extractDefectFileIdFromBackendPayload,
} from "@/lib/pcdi/extract-backend-columns";
import { parseFirstSheetDataRows, parseSheetColumnHeaders } from "@/lib/pcdi/parse-xlsx-headers";
import type { PcdiUploadSessionPayload } from "@/lib/pcdi/types";
import { clearBillieMergeSession } from "@/lib/pcdi/billie-merge-session";
import { clearHistoricalAiColumnMappingSession } from "@/lib/pcdi/map-session";
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
  const [backendJsonCopied, setBackendJsonCopied] = useState(false);

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

        const form = new FormData();
        form.append("file", file);
        form.append("projectId", projectId);
        form.append("headerRow", String(rowUsed));
        const s3Res = await fetch("/api/upload-xlsx", { method: "POST", body: form });
        if (!s3Res.ok) {
          const errBody = (await s3Res.json().catch(() => ({}))) as { error?: string };
          setPayload(null);
          onPayloadChange?.(null);
          clearBillieMergeSession(projectId);
          clearUploadPayload(projectId);
          setError(
            errBody.error ?? "Could not store the file in Amazon S3. Check .env.local and your network, then try again.",
          );
          return;
        }
        const s3 = (await s3Res.json()) as {
          fileUrl: string;
          headerRow: number;
          presignedUrlExpiresInSeconds: number;
          bucket: string;
          key: string;
          region: string;
        };

        const handoffRes = await fetch("/api/save-excel-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            fileUrl: s3.fileUrl,
            headerNum: s3.headerRow,
          }),
        });
        if (!handoffRes.ok) {
          const errBody = (await handoffRes.json().catch(() => ({}))) as {
            error?: string;
            cause?: string;
            hint?: string;
          };
          setPayload(null);
          onPayloadChange?.(null);
          clearBillieMergeSession(projectId);
          clearUploadPayload(projectId);
          setError(
            [errBody.error, errBody.cause, errBody.hint]
              .filter(Boolean)
              .join("\n\n") ||
              "Could not register the file with the analysis server. Check the network and try again.",
          );
          return;
        }

        const handoffJson = (await handoffRes.json()) as {
          ok?: boolean;
          data?: unknown;
          skipped?: boolean;
        };
        const fromBackend =
          handoffJson.data != null ? extractColumnNamesFromBackendPayload(handoffJson.data) : null;
        const columnsUsed = fromBackend && fromBackend.length > 0 ? fromBackend : columns;
        const defectFileId =
          handoffJson.data != null ? extractDefectFileIdFromBackendPayload(handoffJson.data) : null;

        const next: PcdiUploadSessionPayload = {
          projectId,
          fileName: file.name,
          headerRow: s3.headerRow,
          columns: columnsUsed,
          s3Bucket: s3.bucket,
          s3Key: s3.key,
          s3Region: s3.region,
          fileUrl: s3.fileUrl,
          presignedUrlExpiresInSeconds: s3.presignedUrlExpiresInSeconds,
          ...(defectFileId ? { defectFileId } : {}),
          ...(dataRowsRaw && dataRowsRaw.length > 0 ? { dataRows: dataRowsRaw } : {}),
        };
        clearBillieMergeSession(projectId);
        clearHistoricalAiColumnMappingSession(projectId);
        writeUploadPayload(next);
        setPayload(next);
        onPayloadChange?.(next);
        setHeaderRow(rowUsed);
      } catch {
        setPayload(null);
        onPayloadChange?.(null);
        clearBillieMergeSession(projectId);
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
      clearBillieMergeSession(projectId);
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
    if (!isEmbedded) router.push(`${basePath}/${projectId}/upload#ingest-step-columns`);
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
      clearBillieMergeSession(projectId);
      clearUploadPayload(projectId);
    }
  }

  const headerRowInputId = isEmbedded ? `header-row-embedded-${projectId}` : "header-row";

  return (
    <div className={isEmbedded ? "w-full max-w-2xl" : "mx-auto max-w-2xl"}>
      {isEmbedded ? null : <IngestionFlowNav currentStep={3} className="mb-6" />}
      {isEmbedded ? null : (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
          <Link href={basePath} className="text-link hover:underline">
            ← Projects
          </Link>
          <Link
            href={`${basePath}/${projectId}/setup`}
            className="text-link hover:underline"
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
            ? "border-accent bg-[var(--accent-muted)]/40"
            : "border-[var(--border)] bg-[var(--surface)] hover:border-accent/50"
        }`}
      >
        <FileSpreadsheet className="h-10 w-10 text-accent" aria-hidden />
        <p className="mt-3 text-center text-sm font-medium text-[var(--foreground)]">
          Drag and drop an .xlsx file here
        </p>
        <p className="mt-1 text-center text-xs text-[var(--muted-foreground)]">or</p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active">
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
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-50"
            >
              Parse
            </button>
          </div>
        </div>
      ) : null}

      {busy ? (
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          Reading workbook, uploading to storage, then registering with the analysis server. Large files (e.g.
          20MB+) can take up to 15 minutes — keep this tab open.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {payload ? (
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-4">
          <p className="text-sm font-medium text-[var(--foreground)]">{payload.fileName}</p>
          {payload.s3Key ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Stored in S3: <span className="font-mono text-[11px] text-[var(--foreground)]">{payload.s3Bucket}</span>{" "}
              · <span className="font-mono text-[11px] break-all text-[var(--foreground)]">{payload.s3Key}</span>
            </p>
          ) : null}
          {payload.fileUrl ? (
            <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
              <p className="text-xs font-medium text-[var(--foreground)]">For backend (download URL + header row)</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                Clipboard JSON matches <code className="rounded bg-[var(--surface)] px-1">POST …/saveExcelContent</code>:{" "}
                <code className="rounded bg-[var(--surface)] px-1">projectId</code>,{" "}
                <code className="rounded bg-[var(--surface)] px-1">fileUrl</code>,{" "}
                <code className="rounded bg-[var(--surface)] px-1">headerNum</code> (1-based row of column names).
                {payload.presignedUrlExpiresInSeconds != null
                  ? ` — presigned link expires in ${Math.round(
                      payload.presignedUrlExpiresInSeconds / 3600,
                    )}h`
                  : null}
                .
              </p>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-[var(--foreground)]">
                {payload.fileUrl}
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (!payload.fileUrl) return;
                  const forBackend = {
                    projectId,
                    fileUrl: payload.fileUrl,
                    headerNum: payload.headerRow,
                  };
                  try {
                    await navigator.clipboard.writeText(JSON.stringify(forBackend, null, 2));
                    setBackendJsonCopied(true);
                    window.setTimeout(() => setBackendJsonCopied(false), 2500);
                  } catch {
                    setError("Could not copy to clipboard. Select the URL and copy manually.");
                  }
                }}
                className="mt-2 rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active"
              >
                {backendJsonCopied ? "Copied JSON" : "Copy JSON for backend"}
              </button>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-[var(--muted-foreground)]">
            Header row <span className="font-medium text-[var(--foreground)]">{payload.headerRow}</span> ·{" "}
            {payload.columns.length} column{payload.columns.length === 1 ? "" : "s"} detected
          </p>
          {isEmbedded ? (
            <p className="mt-3 text-xs font-medium text-foreground-emphasis">
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
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to column mapper
          </button>
        </div>
      )}
    </div>
  );
}
