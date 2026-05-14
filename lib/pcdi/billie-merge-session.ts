import { hashString } from "@/lib/pcdi/hash";
import { readUploadPayload } from "@/lib/pcdi/upload-session";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

export type BillieMergeSessionPayload = {
  projectId: string;
  defectFileId: string;
  mergeFileUrl: string;
  mergeFileName?: string;
  /**
   * Presigned (or stable) URL of the workbook the user uploaded — used for Excel preview with embedded photos.
   * Filled from the upload session when analysis completes, and kept across refreshes when upload session expires.
   */
  originalUploadFileUrl?: string;
  originalUploadFileName?: string;
  rows: HistoricalDefectTableRow[];
  /** Stable fingerprint for selection session / invalidation. */
  rowSignature: string;
  updatedAt: string;
};

function legacyStorageKey(projectId: string) {
  return `pcdi-billie-merge-${projectId}`;
}

/** Per–defect-file isolation (multiple analyses per Billie project). */
function compositeStorageKey(projectId: string, defectFileId: string) {
  const fid = defectFileId.trim();
  if (!fid || fid.startsWith("project:")) return legacyStorageKey(projectId);
  return `pcdi-billie-merge-${projectId}__${fid}`;
}

/** True when this id should use only the legacy single-slot key (synthetic fallback rows). */
function isSyntheticDefectFileId(defectFileId: string): boolean {
  const fid = defectFileId.trim();
  return !fid || fid.startsWith("project:");
}

export function readBillieMergeSession(
  projectId: string,
  defectFileId?: string | null,
): BillieMergeSessionPayload | null {
  if (typeof window === "undefined") return null;
  const fid = defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    const composite = sessionStorage.getItem(compositeStorageKey(projectId, fid));
    if (!composite) return null;
    try {
      const data = JSON.parse(composite) as BillieMergeSessionPayload;
      if (!data || data.projectId !== projectId) return null;
      if (!Array.isArray(data.rows)) return null;
      return data;
    } catch {
      return null;
    }
  }
  const raw = sessionStorage.getItem(legacyStorageKey(projectId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as BillieMergeSessionPayload;
    if (!data || data.projectId !== projectId) return null;
    if (!Array.isArray(data.rows)) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeBillieMergeSession(payload: BillieMergeSessionPayload): void {
  const upload = readUploadPayload(payload.projectId);
  const prev = readBillieMergeSession(payload.projectId, payload.defectFileId);

  let originalUploadFileUrl = payload.originalUploadFileUrl?.trim();
  let originalUploadFileName = payload.originalUploadFileName?.trim();
  if (!originalUploadFileUrl) {
    const fromUpload = upload?.fileUrl?.trim();
    if (fromUpload) {
      originalUploadFileUrl = fromUpload;
      originalUploadFileName = originalUploadFileName || upload?.fileName?.trim() || undefined;
    } else if (prev?.originalUploadFileUrl?.trim()) {
      originalUploadFileUrl = prev.originalUploadFileUrl.trim();
      originalUploadFileName = originalUploadFileName || prev.originalUploadFileName?.trim() || undefined;
    }
  }

  const next: BillieMergeSessionPayload = {
    ...payload,
    ...(originalUploadFileUrl
      ? {
          originalUploadFileUrl,
          ...(originalUploadFileName ? { originalUploadFileName } : {}),
        }
      : {}),
  };

  const json = JSON.stringify(next);
  sessionStorage.setItem(legacyStorageKey(payload.projectId), json);
  if (!isSyntheticDefectFileId(payload.defectFileId)) {
    sessionStorage.setItem(compositeStorageKey(payload.projectId, payload.defectFileId), json);
  }
}

export function clearBillieMergeSession(projectId: string, defectFileId?: string | null): void {
  sessionStorage.removeItem(legacyStorageKey(projectId));
  const fid = defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    sessionStorage.removeItem(compositeStorageKey(projectId, fid));
  }
}

export function rowSignatureFromRows(rows: HistoricalDefectTableRow[]): string {
  return hashString(rows.map((r) => r.id).join("\0")).slice(0, 32);
}
