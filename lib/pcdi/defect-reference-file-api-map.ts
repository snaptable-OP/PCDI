import { unwrapBillieEnvelope } from "@/lib/pcdi/defect-agent-api-map";
import type { KnowledgeDocument, KnowledgeDocumentStatus } from "@/lib/pcdi/knowledge-folders-store";

export const DEFECT_REFERENCE_FILE_BUCKET = "billie-defect-reference-file";

export type DefectReferenceFileDto = {
  id: string;
  defectKnowledgeProjectId: string;
  isProcessed?: string;
  sourceFileUrl?: string;
  sourceFileName?: string;
  sourceFileType?: string;
  sourceFileSize?: number;
  mergeFileUrl?: string;
  mergeFileName?: string;
  mergeFileSize?: number;
  createdAt: number;
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

function mapRow(row: unknown, fallbackFolderId: string): DefectReferenceFileDto | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = asString(r.id);
  const defectKnowledgeProjectId =
    asString(r.defectKnowledgeProjectId) ?? fallbackFolderId;
  if (!id || !defectKnowledgeProjectId) return null;
  return {
    id,
    defectKnowledgeProjectId,
    isProcessed: asString(r.isProcessed) ?? undefined,
    sourceFileUrl: asString(r.sourceFileUrl) ?? undefined,
    sourceFileName: asString(r.sourceFileName) ?? undefined,
    sourceFileType: asString(r.sourceFileType) ?? undefined,
    sourceFileSize:
      typeof r.sourceFileSize === "number" && Number.isFinite(r.sourceFileSize)
        ? r.sourceFileSize
        : undefined,
    mergeFileUrl: asString(r.mergeFileUrl) ?? undefined,
    mergeFileName: asString(r.mergeFileName) ?? undefined,
    mergeFileSize:
      typeof r.mergeFileSize === "number" && Number.isFinite(r.mergeFileSize)
        ? r.mergeFileSize
        : undefined,
    createdAt: unixToMs(r.createdAt),
  };
}

export function extractReferenceFileList(
  data: unknown,
  knowledgeFolderId: string,
): DefectReferenceFileDto[] {
  const unwrapped = unwrapBillieEnvelope(data);
  const candidates: unknown[] = [];
  if (Array.isArray(unwrapped)) candidates.push(...unwrapped);
  else if (unwrapped && typeof unwrapped === "object") {
    const o = unwrapped as Record<string, unknown>;
    for (const k of ["content", "items", "files", "data", "result"] as const) {
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
    .filter((x): x is DefectReferenceFileDto => x != null);
}

export function extractReferenceFileOne(
  data: unknown,
  fallbackFolderId: string,
): DefectReferenceFileDto | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (!unwrapped) return null;
  if (Array.isArray(unwrapped)) return mapRow(unwrapped[0], fallbackFolderId);
  return mapRow(unwrapped, fallbackFolderId);
}

export function isProcessedToDocStatus(isProcessed?: string): KnowledgeDocumentStatus {
  const s = (isProcessed ?? "").toUpperCase();
  if (s === "SUCCESS") return "active";
  if (s === "FAIL") return "error";
  if (s === "PROCESSING") return "parsing";
  return "parsing";
}

export function dtoToKnowledgeDocument(dto: DefectReferenceFileDto): KnowledgeDocument {
  return {
    id: dto.id,
    folderId: dto.defectKnowledgeProjectId,
    fileName: dto.sourceFileName ?? "Document",
    sizeBytes: dto.sourceFileSize ?? 0,
    status: isProcessedToDocStatus(dto.isProcessed),
    addedAt: dto.createdAt,
    source: "pdf",
    sourceFileUrl: dto.sourceFileUrl,
    referenceFileId: dto.id,
  };
}

export type CheckMemoryResult = {
  file_id: string;
  status: "not_found" | "ready" | string;
  chunk_count?: number;
};

export function extractCheckMemoryResult(data: unknown): CheckMemoryResult | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (!unwrapped || typeof unwrapped !== "object") return null;
  const o = unwrapped as Record<string, unknown>;
  const file_id = asString(o.file_id) ?? asString(o.fileId) ?? "";
  const status = asString(o.status) ?? "not_found";
  if (!file_id) return null;
  return {
    file_id,
    status,
    chunk_count:
      typeof o.chunk_count === "number" && Number.isFinite(o.chunk_count)
        ? o.chunk_count
        : undefined,
  };
}

export function extractPresignedUpload(data: unknown): { uploadUrl: string; fileUrl: string } | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (!unwrapped || typeof unwrapped !== "object") return null;
  const o = unwrapped as Record<string, unknown>;
  const uploadUrl = asString(o.uploadUrl) ?? asString(o.upload_url);
  const fileUrl = asString(o.fileUrl) ?? asString(o.file_url);
  if (!uploadUrl || !fileUrl) return null;
  return { uploadUrl, fileUrl };
}
