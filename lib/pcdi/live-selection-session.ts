import { hashString } from "@/lib/pcdi/hash";

export type LiveSelectionState = {
  /** Selected response strategy label per register row id */
  selections: Record<string, string>;
  /** User locked choices — enables export / prompt */
  confirmed: boolean;
  /** Invalidates state when upload/data changes */
  fingerprint: string;
};

function storageKey(projectId: string) {
  return `pcdi-live-analysis-${projectId}`;
}

export function liveUploadFingerprint(upload: {
  fileName: string;
  headerRow: number;
  rowCount: number;
  columnKey: string;
}): string {
  return hashString(
    `${upload.fileName}|${upload.headerRow}|${upload.rowCount}|${upload.columnKey}`,
  );
}

export function readLiveSelectionState(projectId: string): LiveSelectionState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(storageKey(projectId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as LiveSelectionState;
    if (!data || typeof data !== "object") return null;
    const selections =
      data.selections && typeof data.selections === "object" && !Array.isArray(data.selections)
        ? data.selections
        : {};
    return {
      selections,
      confirmed: Boolean(data.confirmed),
      fingerprint: typeof data.fingerprint === "string" ? data.fingerprint : "",
    };
  } catch {
    return null;
  }
}

export function writeLiveSelectionState(projectId: string, state: LiveSelectionState): void {
  sessionStorage.setItem(storageKey(projectId), JSON.stringify(state));
}

export function clearLiveSelectionState(projectId: string): void {
  sessionStorage.removeItem(storageKey(projectId));
}
