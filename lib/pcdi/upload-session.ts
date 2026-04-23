import type { PcdiUploadSessionPayload } from "./types";

export function uploadSessionStorageKey(projectId: string): string {
  return `pcdi-upload-${projectId}`;
}

export function readUploadPayload(projectId: string): PcdiUploadSessionPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(uploadSessionStorageKey(projectId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PcdiUploadSessionPayload;
    if (data.projectId !== projectId) return null;
    if (!Array.isArray(data.columns)) return null;
    if (typeof data.fileName !== "string") return null;
    const headerRow =
      typeof data.headerRow === "number" &&
      Number.isFinite(data.headerRow) &&
      data.headerRow >= 1
        ? Math.floor(data.headerRow)
        : 1;
    const dataRows = Array.isArray(data.dataRows)
      ? (data.dataRows as Record<string, string>[]).filter(
          (row) => row && typeof row === "object" && !Array.isArray(row),
        )
      : undefined;
    return { ...data, headerRow, ...(dataRows ? { dataRows } : {}) };
  } catch {
    return null;
  }
}

export function writeUploadPayload(payload: PcdiUploadSessionPayload): void {
  sessionStorage.setItem(
    uploadSessionStorageKey(payload.projectId),
    JSON.stringify(payload),
  );
}

export function clearUploadPayload(projectId: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(uploadSessionStorageKey(projectId));
}
