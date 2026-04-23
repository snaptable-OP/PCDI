import { readUploadPayload } from "@/lib/pcdi/upload-session";

/** Parse spreadsheet row index from register id `live-{projectId}-r{n}`. */
export function parseRegisterRowIndex(registerRowId: string): number | null {
  const m = registerRowId.match(/-r(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export type LiveSourceRowPreview = {
  /** Column headers in file order */
  columns: string[];
  /** Cell values keyed by header */
  cells: Record<string, string>;
  /** 0-based index in uploaded dataRows */
  rowIndex: number;
};

/**
 * Original upload row for a live register row (for “Excel preview” modal). Client-only.
 * Returns null for seed/mock rows without an upload payload.
 */
export function getLiveSourceRowPreview(
  projectId: string,
  registerRowId: string,
): LiveSourceRowPreview | null {
  const upload = readUploadPayload(projectId);
  if (!upload?.dataRows?.length) return null;
  const idx = parseRegisterRowIndex(registerRowId);
  if (idx === null || idx < 0 || idx >= upload.dataRows.length) return null;
  return {
    columns: upload.columns,
    cells: upload.dataRows[idx] as Record<string, string>,
    rowIndex: idx,
  };
}
