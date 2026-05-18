import type { ResponseStrategyAgent } from "@/lib/pcdi/response-agents-store";

/** Billie envelopes: `{ code, data }` or `{ success, code, result }`. */
export function unwrapBillieEnvelope(data: unknown): unknown {
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

export type DefectAgentDto = {
  id: string;
  defectKnowledgeProjectId: string;
  userChosenResponseStrategy: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
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

function mapRow(row: unknown, fallbackFolderId: string): DefectAgentDto | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asString(r.id);
  const defectKnowledgeProjectId =
    asString(r.defectKnowledgeProjectId) ??
    asString(r.knowledgeProjectId) ??
    fallbackFolderId;
  if (!id || !defectKnowledgeProjectId) return null;
  const createdAt = unixToMs(r.createdAt);
  const updatedAt = r.updatedAt != null && Number(r.updatedAt) !== 0 ? unixToMs(r.updatedAt) : createdAt;
  return {
    id,
    defectKnowledgeProjectId,
    userChosenResponseStrategy:
      asString(r.userChosenResponseStrategy) ?? asString(r.name) ?? "",
    prompt: asString(r.prompt) ?? "",
    createdAt,
    updatedAt,
  };
}

export function extractDefectAgentList(data: unknown, knowledgeFolderId: string): DefectAgentDto[] {
  const unwrapped = unwrapBillieEnvelope(data);
  const candidates: unknown[] = [];
  if (Array.isArray(unwrapped)) candidates.push(...unwrapped);
  else if (unwrapped && typeof unwrapped === "object") {
    const o = unwrapped as Record<string, unknown>;
    for (const k of ["content", "items", "agents", "data", "result"] as const) {
      const v = o[k];
      if (Array.isArray(v)) candidates.push(...v);
    }
    if (candidates.length === 0) {
      const single = mapRow(unwrapped, knowledgeFolderId);
      if (single) return [single];
    }
  }
  return candidates
    .map((row) => mapRow(row, knowledgeFolderId))
    .filter((x): x is DefectAgentDto => x != null);
}

export function extractDefectAgentOne(data: unknown, fallbackFolderId: string): DefectAgentDto | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (!unwrapped) return null;
  if (Array.isArray(unwrapped)) return mapRow(unwrapped[0], fallbackFolderId);
  return mapRow(unwrapped, fallbackFolderId);
}

export function extractDefectAgentId(data: unknown): string | null {
  return extractDefectAgentOne(data, "")?.id ?? null;
}

export function dtoToResponseStrategyAgent(
  dto: DefectAgentDto,
  projectId: string,
): ResponseStrategyAgent {
  return {
    id: dto.id,
    projectId,
    name: dto.userChosenResponseStrategy,
    prompt: dto.prompt,
    knowledgeFolderId: dto.defectKnowledgeProjectId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}
