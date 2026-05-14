import { readBillieMergeSession } from "@/lib/pcdi/billie-merge-session";
import { readUploadPayload } from "@/lib/pcdi/upload-session";

/** Parse spreadsheet data row index from register id `live-{projectId}-r{n}`. */
export function parseRegisterRowIndex(registerRowId: string): number | null {
  const m = registerRowId.match(/-r(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** `billie-{projectId}-{k}` → 1-based k from the id (last numeric segment). */
function parseBillieRegisterOrdinal(registerRowId: string): number | null {
  const m = registerRowId.match(/^billie-.+-(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * 0-based index into `upload.dataRows` for this register row when upload order matches
 * register order (live ids: explicit index; billie ids: ordinal suffix).
 */
function resolveUploadDataRowIndex(
  registerRowId: string,
  upload: { dataRows?: Record<string, string>[] },
): number | null {
  const rows = upload.dataRows;
  if (!rows?.length) return null;

  const liveIdx = parseRegisterRowIndex(registerRowId);
  if (liveIdx != null && liveIdx >= 0 && liveIdx < rows.length) return liveIdx;

  const ord = parseBillieRegisterOrdinal(registerRowId);
  if (ord != null) {
    const idx = ord - 1;
    if (idx >= 0 && idx < rows.length) return idx;
  }
  return null;
}

/**
 * 1-based worksheet row on the **original uploaded** Excel for a register row.
 * Prefers Billie `row_number` / `excelSheetRow`; otherwise derives from upload `dataRows` order + header row.
 */
export function resolveOriginalUploadSheetRow(
  projectId: string,
  registerRowId: string,
  defectFileId?: string | null,
): number | null {
  const upload = readUploadPayload(projectId);
  const billie = readBillieMergeSession(projectId, defectFileId);
  const fromBillie = billie?.rows?.find((r) => r.id === registerRowId);

  const mergedAnalysisRow =
    fromBillie?.excelSheetRow != null &&
    Number.isFinite(fromBillie.excelSheetRow) &&
    fromBillie.excelSheetRow >= 1
      ? Math.floor(Number(fromBillie.excelSheetRow))
      : null;

  let uploadDerivedRow: number | null = null;
  if (upload?.dataRows?.length) {
    const idx = resolveUploadDataRowIndex(registerRowId, upload);
    if (idx != null) uploadDerivedRow = upload.headerRow + 1 + idx;
  }

  return mergedAnalysisRow ?? uploadDerivedRow;
}

export type LiveSourceRowPreview = {
  /** Column headers in file order (empty when only workbook URL preview is used). */
  columns: string[];
  /** Cell values keyed by header (empty when only workbook URL preview is used). */
  cells: Record<string, string>;
  /** 0-based index in uploaded `dataRows` when upload session matches. */
  rowIndex: number;
  /** 1-based Excel worksheet row to scroll to / highlight in the preview workbook. */
  excelSheetRow: number;
  /**
   * URL of the `.xlsx` loaded by ExcelJS in the modal.
   * Prefers the **original upload** when the presigned URL is still valid so the user sees the raw file;
   * row highlighting uses **`row_number` from the merged export** (or Billie `excelSheetRow`) so it matches the source sheet.
   */
  mergeFileUrl?: string;
  mergeFileName?: string;
  /** True when `mergeFileUrl` points at the original S3 upload, not the merged Billie export. */
  isOriginalUpload?: boolean;
};

/**
 * Row preview for the Excel modal (client-only).
 * Uses Billie `excelSheetRow` when present — from merged **`row_number`** / API fields (`row_number`, etc.), not the merged file’s physical row.
 * Loads the **original** workbook URL when still in session when possible.
 */
export function getLiveSourceRowPreview(
  projectId: string,
  registerRowId: string,
  defectFileId?: string | null,
): LiveSourceRowPreview | null {
  const upload = readUploadPayload(projectId);
  const billie = readBillieMergeSession(projectId, defectFileId);
  const fromBillie = billie?.rows?.find((r) => r.id === registerRowId);

  const originalUrlFromUpload = upload?.fileUrl?.trim();
  const originalUrlFromBillie = billie?.originalUploadFileUrl?.trim();
  /** Prefer live upload session (often fresher presign), then snapshot stored with merge session. */
  const originalUrl = originalUrlFromUpload || originalUrlFromBillie || "";
  const mergeUrl = billie?.mergeFileUrl?.trim();

  /** From merged Billie export / parse — same value used when highlighting in the merged file. */
  const mergedAnalysisRow =
    fromBillie?.excelSheetRow != null && Number.isFinite(fromBillie.excelSheetRow) && fromBillie.excelSheetRow >= 1
      ? Math.floor(Number(fromBillie.excelSheetRow))
      : null;

  let uploadDerivedRow: number | null = null;
  if (upload?.dataRows?.length) {
    const idx = resolveUploadDataRowIndex(registerRowId, upload);
    if (idx != null) uploadDerivedRow = upload.headerRow + 1 + idx;
  }

  const excelSheetRow = mergedAnalysisRow ?? uploadDerivedRow;

  const previewFileUrl = originalUrl || mergeUrl;
  const isOriginalUpload = Boolean(originalUrl && previewFileUrl === originalUrl);

  if (excelSheetRow != null && previewFileUrl) {
    return {
      columns: [],
      cells: {},
      rowIndex: 0,
      excelSheetRow,
      mergeFileUrl: previewFileUrl,
      mergeFileName: isOriginalUpload
        ? upload?.fileName?.trim() || billie?.originalUploadFileName || billie?.mergeFileName
        : billie?.mergeFileName,
      isOriginalUpload,
    };
  }

  if (upload?.dataRows?.length && uploadDerivedRow != null) {
    const idx = resolveUploadDataRowIndex(registerRowId, upload);
    if (idx != null) {
      return {
        columns: upload.columns,
        cells: upload.dataRows[idx] as Record<string, string>,
        rowIndex: idx,
        excelSheetRow: uploadDerivedRow,
        ...(originalUrl
          ? {
              mergeFileUrl: originalUrl,
              mergeFileName: upload?.fileName?.trim() || billie?.originalUploadFileName,
              isOriginalUpload: true as const,
            }
          : mergeUrl
            ? {
                mergeFileUrl: mergeUrl,
                mergeFileName: billie?.mergeFileName,
                isOriginalUpload: false as const,
              }
            : {}),
      };
    }
  }

  if (excelSheetRow != null) {
    return {
      columns: [],
      cells: {},
      rowIndex: 0,
      excelSheetRow,
      isOriginalUpload: false,
    };
  }

  return null;
}
