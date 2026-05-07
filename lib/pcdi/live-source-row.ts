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

export type LiveSourceRowPreview = {
  /** Column headers in file order (empty when only workbook URL preview is used). */
  columns: string[];
  /** Cell values keyed by header (empty when only workbook URL preview is used). */
  cells: Record<string, string>;
  /** 0-based index in uploaded `dataRows` when upload session matches. */
  rowIndex: number;
  /** 1-based Excel worksheet row to scroll to in the preview workbook. */
  excelSheetRow: number;
  /**
   * URL of the `.xlsx` loaded by ExcelJS in the modal.
   * **Prefer** the original upload (`upload.fileUrl`) so the preview shows all columns and any
   * embedded images the file contains (images still need OOXML overlay to render on canvas).
   * If the upload is gone or expired, falls back to Billie’s merged export URL.
   */
  mergeFileUrl?: string;
  mergeFileName?: string;
  /** True when `mergeFileUrl` points at the original S3 upload, not the merged Billie export. */
  isOriginalUpload?: boolean;
};

/**
 * Row preview for the Excel modal (client-only).
 * Prefers the **originally uploaded** workbook (full columns / photos in file) when `fileUrl`
 * is still in session; otherwise uses the merged-file URL from Billie.
 */
export function getLiveSourceRowPreview(
  projectId: string,
  registerRowId: string,
): LiveSourceRowPreview | null {
  const upload = readUploadPayload(projectId);
  const billie = readBillieMergeSession(projectId);
  const fromBillie = billie?.rows?.find((r) => r.id === registerRowId);

  const originalUrl = upload?.fileUrl?.trim();
  if (originalUrl && upload && upload.dataRows?.length) {
    const idx = resolveUploadDataRowIndex(registerRowId, upload);
    if (idx != null) {
      const excelSheetRow = upload.headerRow + 1 + idx;
      return {
        columns: upload.columns,
        cells: upload.dataRows[idx] as Record<string, string>,
        rowIndex: idx,
        excelSheetRow,
        mergeFileUrl: originalUrl,
        mergeFileName: upload.fileName,
        isOriginalUpload: true,
      };
    }
  }

  if (billie && fromBillie && fromBillie.excelSheetRow != null) {
    const url = billie.mergeFileUrl?.trim();
    if (url) {
      return {
        columns: [],
        cells: {},
        rowIndex: 0,
        excelSheetRow: fromBillie.excelSheetRow,
        mergeFileUrl: url,
        mergeFileName: billie.mergeFileName,
        isOriginalUpload: false,
      };
    }
    return {
      columns: [],
      cells: {},
      rowIndex: 0,
      excelSheetRow: fromBillie.excelSheetRow,
      isOriginalUpload: false,
    };
  }

  if (upload?.dataRows?.length) {
    const idx = resolveUploadDataRowIndex(registerRowId, upload);
    if (idx !== null) {
      const excelSheetRow = upload.headerRow + 1 + idx;
      return {
        columns: upload.columns,
        cells: upload.dataRows[idx] as Record<string, string>,
        rowIndex: idx,
        excelSheetRow,
        ...(upload.fileUrl?.trim()
          ? {
              mergeFileUrl: upload.fileUrl.trim(),
              mergeFileName: upload.fileName,
              isOriginalUpload: true as const,
            }
          : {}),
      };
    }
  }

  return null;
}
