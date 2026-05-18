import type { KnowledgeFolder } from "@/lib/pcdi/knowledge-folders-store";

/** Billie envelopes: `{ code, data }` or `{ success, code, result }`. */
function unwrapBillieKnowledgeProjectPayload(data: unknown): unknown {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return data;
  const o = data as Record<string, unknown>;
  const ok =
    (typeof o.code === "number" && o.code === 200) || o.success === true;
  if (!ok) return data;
  for (const key of ["data", "result"] as const) {
    const inner = o[key];
    if (inner != null && typeof inner === "object") return inner;
  }
  return data;
}

export type DefectKnowledgeProjectDto = {
  id: string;
  knowledgeId: string;
  projectId: string;
  displayName: string;
  description?: string;
  status?: string;
  createdAt: number;
  updatedAt?: number;
};

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function unixToMs(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return Date.now();
  return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
}

function mapRow(row: unknown, fallbackProjectId: string): DefectKnowledgeProjectDto | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asString(r.id);
  const projectId = asString(r.projectId) ?? fallbackProjectId;
  if (!id || !projectId) return null;
  const knowledgeId = asString(r.knowledgeId) ?? id;
  const displayName = asString(r.displayName) ?? asString(r.name) ?? "Untitled folder";
  return {
    id,
    knowledgeId,
    projectId,
    displayName,
    description: asString(r.description) ?? undefined,
    status: asString(r.status) ?? undefined,
    createdAt: unixToMs(r.createdAt),
    updatedAt: r.updatedAt != null ? unixToMs(r.updatedAt) : undefined,
  };
}

export function extractKnowledgeProjectList(data: unknown, projectId: string): DefectKnowledgeProjectDto[] {
  const unwrapped = unwrapBillieKnowledgeProjectPayload(data);
  const candidates: unknown[] = [];
  if (Array.isArray(unwrapped)) candidates.push(...unwrapped);
  else if (unwrapped && typeof unwrapped === "object") {
    const o = unwrapped as Record<string, unknown>;
    for (const k of ["content", "items", "knowledgeProjects", "folders", "data", "result"] as const) {
      const v = o[k];
      if (Array.isArray(v)) candidates.push(...v);
    }
    if (candidates.length === 0) {
      const single = mapRow(unwrapped, projectId);
      if (single) return [single];
    }
  }
  return candidates
    .map((row) => mapRow(row, projectId))
    .filter((x): x is DefectKnowledgeProjectDto => x != null);
}

export function extractKnowledgeProjectOne(data: unknown, fallbackProjectId: string): DefectKnowledgeProjectDto | null {
  const unwrapped = unwrapBillieKnowledgeProjectPayload(data);
  if (!unwrapped) return null;
  if (Array.isArray(unwrapped)) return mapRow(unwrapped[0], fallbackProjectId);
  return mapRow(unwrapped, fallbackProjectId);
}

export function extractKnowledgeProjectId(data: unknown): string | null {
  const row = extractKnowledgeProjectOne(data, "");
  return row?.id ?? null;
}

export function dtoToKnowledgeFolder(dto: DefectKnowledgeProjectDto): KnowledgeFolder {
  return {
    id: dto.id,
    projectId: dto.projectId,
    knowledgeId: dto.knowledgeId,
    name: dto.displayName,
    description: dto.description,
    status: dto.status,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function mapKnowledgeProjectsResponseToFolders(
  data: unknown,
  projectId: string,
): KnowledgeFolder[] {
  return extractKnowledgeProjectList(data, projectId).map(dtoToKnowledgeFolder);
}
