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

/**
 * Defect file id from GET /api/defect-files?projectId=… (Billie may return an object, array of files, or envelope).
 */
export function extractDefectFileIdFromProjectDefectFilesQueryBody(body: unknown): string | null {
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
