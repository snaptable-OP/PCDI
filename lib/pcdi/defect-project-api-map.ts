import { extractDefectFileIdFromProjectListRow } from "@/lib/pcdi/extract-backend-columns";
import type { AnalysisModule, AssetType, HistoricalProject, StructuralType } from "@/lib/pcdi/types";

const STRUCTURAL_VALUES: StructuralType[] = ["steel", "concrete", "timber", "masonry", "mixed"];

/** Same id extraction as POST /api/defect-projects expects from Billie create responses. */
export function extractDefectProjectId(data: unknown): string | null {
  const candidates: unknown[] = [];

  function pushFrom(o: unknown) {
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    candidates.push(
      r.id,
      r.projectId,
      r.uuid,
      r.defectProjectId,
      r.projectUuid,
      r.project_id,
    );
    const nest = [r.project, r.data, r.result, r.content, r.payload] as const;
    for (const n of nest) {
      if (n && typeof n === "object") {
        const x = n as Record<string, unknown>;
        candidates.push(x.id, x.uuid, x.projectId);
      }
    }
  }

  pushFrom(data);
  if (data && typeof data === "object" && "data" in data) {
    const inner = (data as Record<string, unknown>).data;
    pushFrom(inner);
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return null;
}

function parseStructuralType(raw: unknown): StructuralType {
  const pick = (s: string): StructuralType | null => {
    const v = s.trim().toLowerCase();
    return STRUCTURAL_VALUES.includes(v as StructuralType) ? (v as StructuralType) : null;
  };
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string") {
        const p = pick(x);
        if (p) return p;
      }
    }
  }
  if (typeof raw === "string") {
    const p = pick(raw);
    if (p) return p;
  }
  return "mixed";
}

function parseAssetType(raw: unknown): AssetType {
  if (typeof raw === "string" && raw.toLowerCase() === "commercial") return "commercial";
  return "residential";
}

/**
 * Single-project GET response body — unwrap `result` / `data` / `project` until we see a project-shaped object.
 */
export function extractSingleDefectProjectFromDetailPayload(payload: unknown): unknown {
  if (payload == null) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  if (extractDefectProjectId(o)) return o;
  for (const k of ["result", "data", "project", "payload", "content"] as const) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (extractDefectProjectId(v)) return v;
    }
  }
  return payload;
}

/** Pull an array of project-like objects from varied Billie list envelopes. */
export function extractDefectProjectListRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const o = payload as Record<string, unknown>;
  const direct = [o.result, o.data, o.projects, o.items, o.records, o.list];
  for (const t of direct) {
    if (Array.isArray(t)) return t;
  }
  if (o.result && typeof o.result === "object" && !Array.isArray(o.result)) {
    const r = o.result as Record<string, unknown>;
    for (const k of ["data", "projects", "content", "list", "items", "records"] as const) {
      if (Array.isArray(r[k])) return r[k] as unknown[];
    }
  }
  if (o.data && typeof o.data === "object" && !Array.isArray(o.data)) {
    const d = o.data as Record<string, unknown>;
    for (const k of ["projects", "list", "content", "items", "records"] as const) {
      if (Array.isArray(d[k])) return d[k] as unknown[];
    }
  }
  return [];
}

export function mapDefectProjectRowToHistorical(
  row: unknown,
  analysisModule: AnalysisModule,
): HistoricalProject | null {
  const id = extractDefectProjectId(row);
  if (!id) return null;
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const o = row as Record<string, unknown>;

  const nameRaw = o.name ?? o.projectName ?? o.title;
  const name =
    typeof nameRaw === "string" && nameRaw.trim()
      ? nameRaw.trim()
      : "Project";

  const assetType = parseAssetType(o.assetType);

  const trimStr = (v: unknown): string =>
    typeof v === "string" && v.trim() ? v.trim() : "";

  /** Billie list/detail often use `address` / `region` instead of UI `location`. */
  const locExplicit = trimStr(o.location) || trimStr(o.siteLocation);
  const addr = trimStr(o.address);
  const reg = trimStr(o.region);
  const location =
    locExplicit ||
    (addr && reg ? `${addr} · ${reg}` : addr || reg);

  const floorRaw =
    o.floorLevels ?? o.floorLevel ?? o.floors ?? o.levels ?? o.floorLevelsDescription;
  const floorLevels =
    typeof floorRaw === "string"
      ? floorRaw.trim()
      : floorRaw != null && typeof floorRaw !== "object"
        ? String(floorRaw).trim()
        : "";

  const structuralType = parseStructuralType(o.structureTypes ?? o.structuralType ?? o.structureType);

  const defectFileId = extractDefectFileIdFromProjectListRow(row) ?? undefined;

  let createdAt = new Date().toISOString();
  const ct = o.createdAt ?? o.createTime ?? o.created_at ?? o.createdDate ?? o.insertDate;
  if (typeof ct === "string" && !Number.isNaN(Date.parse(ct))) {
    createdAt = new Date(ct).toISOString();
  } else if (typeof ct === "number" && Number.isFinite(ct)) {
    createdAt = new Date(ct).toISOString();
  }

  return {
    id,
    name,
    assetType,
    floorLevels,
    location,
    structuralType,
    createdAt,
    analysisModule,
    ...(defectFileId ? { defectFileId } : {}),
  };
}

export function mapDefectProjectsResponseToHistorical(
  payload: unknown,
  analysisModule: AnalysisModule,
): HistoricalProject[] {
  const rows = extractDefectProjectListRows(payload);
  const byId = new Map<string, HistoricalProject>();
  for (const row of rows) {
    const p = mapDefectProjectRowToHistorical(row, analysisModule);
    if (!p) continue;
    const prev = byId.get(p.id);
    if (!prev) {
      byId.set(p.id, p);
      continue;
    }
    const merged: HistoricalProject = {
      ...prev,
      ...p,
      name: p.name?.trim() ? p.name : prev.name,
      defectFileId: p.defectFileId || prev.defectFileId,
    };
    byId.set(p.id, merged);
  }
  return [...byId.values()];
}
