import { hashString } from "@/lib/pcdi/hash";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

export type BillieMergeSessionPayload = {
  projectId: string;
  defectFileId: string;
  mergeFileUrl: string;
  mergeFileName?: string;
  rows: HistoricalDefectTableRow[];
  /** Stable fingerprint for selection session / invalidation. */
  rowSignature: string;
  updatedAt: string;
};

function storageKey(projectId: string) {
  return `pcdi-billie-merge-${projectId}`;
}

export function readBillieMergeSession(projectId: string): BillieMergeSessionPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(projectId));
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
  sessionStorage.setItem(storageKey(payload.projectId), JSON.stringify(payload));
}

export function clearBillieMergeSession(projectId: string): void {
  sessionStorage.removeItem(storageKey(projectId));
}

export function rowSignatureFromRows(rows: HistoricalDefectTableRow[]): string {
  return hashString(rows.map((r) => r.id).join("\0")).slice(0, 32);
}
