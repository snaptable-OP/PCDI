import { hashString } from "@/lib/pcdi/hash";

export type LiveSelectionState = {
  /** Selected response strategy label per register row id */
  selections: Record<string, string>;
  /** User locked choices — enables export / prompt */
  confirmed: boolean;
  /** Invalidates state when upload/data changes */
  fingerprint: string;
};

function legacyKey(projectId: string) {
  return `pcdi-live-analysis-${projectId}`;
}

function compositeKey(projectId: string, defectFileId: string) {
  const fid = defectFileId.trim();
  if (!fid || fid.startsWith("project:")) return legacyKey(projectId);
  return `pcdi-live-analysis-${projectId}__${fid}`;
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

export function readLiveSelectionState(
  projectId: string,
  defectFileId?: string | null,
): LiveSelectionState | null {
  if (typeof window === "undefined") return null;

  const fid = defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    const rawC = sessionStorage.getItem(compositeKey(projectId, fid));
    if (!rawC) return null;
    try {
      const data = JSON.parse(rawC) as LiveSelectionState;
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

  const raw = sessionStorage.getItem(legacyKey(projectId));
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

export function writeLiveSelectionState(
  projectId: string,
  state: LiveSelectionState,
  defectFileId?: string | null,
): void {
  const json = JSON.stringify(state);
  const fid = defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    sessionStorage.setItem(compositeKey(projectId, fid), json);
    return;
  }
  sessionStorage.setItem(legacyKey(projectId), json);
}

export function clearLiveSelectionState(projectId: string, defectFileId?: string | null): void {
  sessionStorage.removeItem(legacyKey(projectId));
  const fid = defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    sessionStorage.removeItem(compositeKey(projectId, fid));
  }
}
