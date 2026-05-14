export function normalizeId(x: unknown): string | null {
  if (typeof x === "string" && x.trim()) return x.trim();
  if (typeof x === "number" && Number.isFinite(x)) return String(Math.trunc(x));
  return null;
}

/**
 * Billie defect-file list item from GET /api/defect-files?projectId=… (`result[]` entries).
 * Uses `id` only when the object looks like a file row (merge/source fields), not a bare project row.
 */
export function extractDefectFileIdFromBillieFileRecord(item: unknown): string | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const o = item as Record<string, unknown>;
  const looksLikeDefectFileRecord =
    typeof o.mergeFileUrl === "string" ||
    typeof o.sourceFileUrl === "string" ||
    typeof o.sourceFileType === "string" ||
    o.isProcessed != null;
  if (!looksLikeDefectFileRecord) return null;
  return (
    normalizeId(o.defectFileId) ??
    normalizeId(o.defect_file_id) ??
    normalizeId(o.defectFileID) ??
    normalizeId(o.id)
  );
}

/**
 * Defect file id for one **project** row from GET /api/defect-projects (list or single-project response).
 * Tuned for per-row mapping so we do not pick a sibling project's file id from a shared envelope.
 */
export function extractDefectFileIdFromProjectListRow(row: unknown): string | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;

  const fromFileRecord = (obj: unknown): string | null => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
    const f = obj as Record<string, unknown>;
    const explicit =
      normalizeId(f.defectFileId) ??
      normalizeId(f.defect_file_id) ??
      normalizeId(f.defectFileID);
    if (explicit) return explicit;
    return normalizeId(f.uuid) ?? normalizeId(f.fileId) ?? normalizeId(f.id);
  };

  const nested =
    fromFileRecord(o.defectFile) ??
    fromFileRecord(o.defect_file) ??
    fromFileRecord(o.primaryDefectFile) ??
    fromFileRecord(o.latestDefectFile);

  if (nested) return nested;

  for (const key of ["defectFiles", "defect_files", "files"] as const) {
    const list = o[key];
    if (!Array.isArray(list) || list.length === 0) continue;
    const fid = fromFileRecord(list[list.length - 1]);
    if (fid) return fid;
  }

  for (const key of [
    "defectFileId",
    "defect_file_id",
    "latestDefectFileId",
    "activeDefectFileId",
    "primaryDefectFileId",
    "defectFileID",
    "fileId",
  ] as const) {
    const id = normalizeId(o[key]);
    if (id) return id;
  }

  for (const wrap of [o.data, o.result, o.payload] as const) {
    if (wrap == null) continue;
    if (Array.isArray(wrap) && wrap.length > 0) {
      const fid =
        fromFileRecord(wrap[wrap.length - 1]) ?? fromFileRecord(wrap[0]);
      if (fid) return fid;
      continue;
    }
    if (typeof wrap !== "object") continue;
    const w = wrap as Record<string, unknown>;
    for (const key of ["defectFileId", "defect_file_id", "fileId", "defectFileID"] as const) {
      const id = normalizeId(w[key]);
      if (id) return id;
    }
    const inner =
      fromFileRecord(w.defectFile) ?? fromFileRecord(w.defect_file) ?? fromFileRecord(w.latestDefectFile);
    if (inner) return inner;
  }

  return null;
}

/**
 * Picks defect file id from various Billie API response shapes (saveExcelContent, etc.).
 */
export function extractDefectFileIdFromBackendPayload(data: unknown): string | null {
  if (data == null) return null;

  const tryRecord = (o: Record<string, unknown>): string | null => {
    for (const key of [
      "defectFileId",
      "defect_file_id",
      "fileId",
      "defectFileID",
      "latestDefectFileId",
      "activeDefectFileId",
      "primaryDefectFileId",
    ] as const) {
      const id = normalizeId(o[key]);
      if (id) return id;
    }
    const nest = [o.data, o.result, o.payload, o.content, o.body] as const;
    for (const n of nest) {
      if (n == null) continue;
      if (Array.isArray(n) && n.length > 0) {
        const fromArr =
          extractDefectFileIdFromBillieFileRecord(n[n.length - 1]) ??
          extractDefectFileIdFromBillieFileRecord(n[0]) ??
          extractDefectFileIdFromProjectListRow(n[n.length - 1]) ??
          extractDefectFileIdFromProjectListRow(n[0]);
        if (fromArr) return fromArr;
        continue;
      }
      if (typeof n === "object") {
        const inner = tryRecord(n as Record<string, unknown>);
        if (inner) return inner;
      }
    }
    return null;
  };

  if (typeof data === "object" && data !== null) {
    return tryRecord(data as Record<string, unknown>);
  }
  return null;
}

/** List rows sometimes arrive wrapped as `{ code: 200, data: DefectFileResponse }`. */
function unwrapBillieDefectFileEnvelope(item: unknown): unknown {
  if (item == null || typeof item !== "object" || Array.isArray(item)) return item;
  const o = item as Record<string, unknown>;
  const inner = o.data;
  if (inner != null && typeof inner === "object" && !Array.isArray(inner)) {
    if (typeof o.code === "number" && o.code === 200) return inner;
    if (o.success === true) return inner;
  }
  return item;
}

function parseBillieFileCreatedAtUnix(item: unknown): number {
  if (!item || typeof item !== "object" || Array.isArray(item)) return 0;
  const o = item as Record<string, unknown>;
  const c = o.createdAt;
  if (typeof c === "number" && Number.isFinite(c)) return c;
  if (typeof c === "string") {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  const hk = o.createdAtHk;
  if (typeof hk === "string") {
    const ms = Date.parse(hk);
    if (Number.isFinite(ms)) return ms / 1000;
  }
  return 0;
}

/** Billie-shaped file rows from GET /api/defect-files?projectId=…, in API encounter order. */
function collectBillieDefectFileItemsFromQueryBody(body: unknown): unknown[] {
  const out: unknown[] = [];
  const push = (item: unknown) => {
    const raw = unwrapBillieDefectFileEnvelope(item);
    if (extractDefectFileIdFromBillieFileRecord(raw)) out.push(raw);
  };
  push(body);
  if (Array.isArray(body)) {
    for (const item of body) push(item);
    return out;
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    for (const key of ["result", "data", "payload", "content"] as const) {
      const v = o[key];
      if (Array.isArray(v)) for (const item of v) push(item);
    }
  }
  return out;
}

/**
 * Defect file id from GET /api/defect-files?projectId=… (Billie may return an object, array of files, or envelope).
 * When several files exist, prefers the newest by `createdAt` / `createdAtHk`, then last in API order if ties.
 */
export function extractDefectFileIdFromProjectDefectFilesQueryBody(body: unknown): string | null {
  const items = collectBillieDefectFileItemsFromQueryBody(body);
  if (items.length > 0) {
    const byId = new Map<string, { t: number; idx: number }>();
    for (let i = 0; i < items.length; i++) {
      const id = extractDefectFileIdFromBillieFileRecord(items[i]);
      if (!id) continue;
      const t = parseBillieFileCreatedAtUnix(items[i]);
      const prev = byId.get(id);
      if (!prev || t > prev.t || (t === prev.t && i > prev.idx)) {
        byId.set(id, { t, idx: i });
      }
    }
    let bestId: string | null = null;
    let bestT = -Infinity;
    let bestIdx = -1;
    for (const [id, v] of byId) {
      if (v.t > bestT || (v.t === bestT && v.idx > bestIdx)) {
        bestT = v.t;
        bestIdx = v.idx;
        bestId = id;
      }
    }
    if (bestId) return bestId;
  }

  if (Array.isArray(body) && body.length > 0) {
    const last = body[body.length - 1];
    const first = body[0];
    return (
      extractDefectFileIdFromBillieFileRecord(last) ??
      extractDefectFileIdFromBillieFileRecord(first) ??
      extractDefectFileIdFromProjectListRow(last) ??
      extractDefectFileIdFromProjectListRow(first) ??
      extractDefectFileIdFromBackendPayload(body)
    );
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    for (const key of ["result", "data", "payload", "content"] as const) {
      const v = o[key];
      if (Array.isArray(v) && v.length > 0) {
        const fid =
          extractDefectFileIdFromBillieFileRecord(v[v.length - 1]) ??
          extractDefectFileIdFromBillieFileRecord(v[0]);
        if (fid) return fid;
      }
    }
  }
  return extractDefectFileIdFromBackendPayload(body) ?? extractDefectFileIdFromProjectListRow(body);
}

export type DefectFileListItem = {
  id: string;
  sourceFileName?: string;
  mergeFileName?: string;
  isProcessed?: string;
  /** Unix seconds when Billie sends `createdAt` / `createdAtHk`; used for newest-first ordering. */
  createdAtUnix?: number;
};

function summarizeDefectFileRecord(item: unknown): DefectFileListItem | null {
  const raw = unwrapBillieDefectFileEnvelope(item);
  const id = extractDefectFileIdFromBillieFileRecord(raw);
  if (!id) return null;
  const o = raw as Record<string, unknown>;
  const ts = parseBillieFileCreatedAtUnix(raw);
  return {
    id,
    sourceFileName: typeof o.sourceFileName === "string" ? o.sourceFileName : undefined,
    mergeFileName: typeof o.mergeFileName === "string" ? o.mergeFileName : undefined,
    isProcessed: typeof o.isProcessed === "string" ? o.isProcessed : undefined,
    ...(ts > 0 ? { createdAtUnix: ts } : {}),
  };
}

/**
 * All defect file rows from GET /api/defect-files?projectId=… (multiple analyses per project).
 */
export function extractDefectFileListFromProjectQueryBody(body: unknown): DefectFileListItem[] {
  const out: DefectFileListItem[] = [];
  const seen = new Set<string>();

  const push = (item: unknown) => {
    const s = summarizeDefectFileRecord(item);
    if (!s || seen.has(s.id)) return;
    seen.add(s.id);
    out.push(s);
  };

  push(body);

  if (Array.isArray(body)) {
    for (const item of body) push(item);
    return out;
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const o = body as Record<string, unknown>;
    for (const key of ["result", "data", "payload", "content"] as const) {
      const v = o[key];
      if (Array.isArray(v)) for (const item of v) push(item);
    }
  }

  out.sort((a, b) => {
    const ta = a.createdAtUnix ?? 0;
    const tb = b.createdAtUnix ?? 0;
    if (tb !== ta) return tb - ta;
    const an = (a.mergeFileName ?? a.sourceFileName ?? a.id).toLowerCase();
    const bn = (b.mergeFileName ?? b.sourceFileName ?? b.id).toLowerCase();
    return an.localeCompare(bn);
  });

  return out;
}

/**
 * Picks a string[] of column names from various Billie API response shapes.
 */
export function extractColumnNamesFromBackendPayload(data: unknown): string[] | null {
  if (data == null) return null;

  const normalizeCell = (x: unknown): string | null => {
    if (typeof x === "string" && x.trim()) return x.trim();
    if (typeof x === "object" && x !== null && "name" in x && typeof (x as { name: unknown }).name === "string") {
      const n = (x as { name: string }).name.trim();
      return n || null;
    }
    return null;
  };

  const tryArray = (arr: unknown): string[] | null => {
    if (!Array.isArray(arr)) return null;
    const out: string[] = [];
    for (const item of arr) {
      const s = normalizeCell(item);
      if (s) out.push(s);
    }
    return out.length ? out : null;
  };

  if (Array.isArray(data)) {
    return tryArray(data);
  }
  if (typeof data !== "object") {
    return null;
  }

  const o = data as Record<string, unknown>;
  const nest = [o.data, o.result, o.payload, o.content, o.body] as const;
  for (const n of nest) {
    if (n && typeof n === "object") {
      const r = n as Record<string, unknown>;
      for (const key of ["columns", "columnNames", "headers", "headerNames", "columnHeaders"] as const) {
        const t = tryArray(r[key]);
        if (t) return t;
      }
    }
  }

  for (const key of ["columns", "columnNames", "headers", "headerNames", "columnHeaders"] as const) {
    const t = tryArray(o[key]);
    if (t) return t;
  }

  return null;
}
