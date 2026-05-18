import "server-only";
import {
  billieAuthHeaders,
  billieFetch,
  getBillieBase,
  readUpstreamJson,
  upstreamErrorMessage,
} from "@/lib/billie/upstream-json";
import { unwrapBillieEnvelope } from "@/lib/pcdi/defect-agent-api-map";
import {
  dtoToKnowledgeDocument,
  extractPresignedUpload,
  extractReferenceFileList,
} from "@/lib/pcdi/defect-reference-file-api-map";
import type { KnowledgeDocument } from "@/lib/pcdi/knowledge-folders-store";

const PDF_MAX_BYTES = 25 * 1024 * 1024;

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function inferSourceFileType(fileName: string): string {
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return "PDF";
  if (n.endsWith(".xlsx")) return "EXCEL";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "WORD";
  return "FILE";
}

function contentTypeForFileName(fileName: string, mime: string): string {
  if (mime && mime !== "application/octet-stream") return mime;
  if (fileName.toLowerCase().endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function extractUploadedFileUrl(data: unknown): string | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (typeof unwrapped === "string" && /^https?:\/\//i.test(unwrapped)) return unwrapped;
  if (unwrapped && typeof unwrapped === "object") {
    const o = unwrapped as Record<string, unknown>;
    for (const k of ["fileUrl", "file_url", "url", "sourceFileUrl"] as const) {
      const s = asString(o[k]);
      if (s && /^https?:\/\//i.test(s)) return s;
    }
  }
  if (typeof data === "string" && /^https?:\/\//i.test(data)) return data;
  return null;
}

async function presignReferenceUpload(fileName: string): Promise<
  | { ok: true; uploadUrl: string; fileUrl: string }
  | { ok: false; error: string }
> {
  const path = `/api/defect-reference-files/presigned-url?fileName=${encodeURIComponent(fileName)}`;
  const result = await billieFetch("reference presign", path, { method: "GET" });
  if (!result || typeof result !== "object" || !("res" in result)) {
    return { ok: false, error: "Could not reach the analysis server for presigned URL." };
  }
  const { res, data } = result;
  if (!res.ok) {
    return { ok: false, error: upstreamErrorMessage(data, res.status) };
  }
  const presigned = extractPresignedUpload(data);
  if (!presigned) {
    return { ok: false, error: "Could not read presigned upload URLs from the analysis server." };
  }
  return { ok: true, ...presigned };
}

async function putBufferToPresignedUrl(
  uploadUrl: string,
  body: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "Content-Type": contentType },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: `Storage upload failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Storage upload failed: ${msg}` };
  }
}

/** Billie `POST /api/defect-reference-files/upload` (multipart) — fallback when presigned PUT fails. */
async function billieMultipartUpload(
  fileName: string,
  body: Buffer,
  contentType: string,
): Promise<{ ok: true; fileUrl: string } | { ok: false; error: string }> {
  const base = getBillieBase();
  const url = `${base}/api/defect-reference-files/upload`;
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(body)], { type: contentType }), fileName);

  const headers = billieAuthHeaders(false);
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: form, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Analysis server upload failed: ${msg}` };
  }

  const data = await readUpstreamJson(res);
  if (!res.ok) {
    return { ok: false, error: upstreamErrorMessage(data, res.status) };
  }

  const fileUrl = extractUploadedFileUrl(data);
  if (!fileUrl) {
    return { ok: false, error: "Could not read file URL from analysis server upload response." };
  }
  return { ok: true, fileUrl };
}

async function billieSaveReferenceFiles(
  folderId: string,
  files: Array<{
    sourceFileUrl: string;
    sourceFileName: string;
    sourceFileType: string;
    sourceFileSize: number;
  }>,
): Promise<{ ok: true; documents: KnowledgeDocument[] } | { ok: false; error: string }> {
  const result = await billieFetch("reference save", "/api/defect-reference-files/save", {
    method: "POST",
    body: JSON.stringify({ defectKnowledgeProjectId: folderId, files }),
  });
  if (!result || typeof result !== "object" || !("res" in result)) {
    return { ok: false, error: "Could not reach the analysis server to register the file." };
  }
  const { res, data } = result;
  if (!res.ok) {
    return { ok: false, error: upstreamErrorMessage(data, res.status) };
  }
  const dtos = extractReferenceFileList(data, folderId);
  return { ok: true, documents: dtos.map(dtoToKnowledgeDocument) };
}

export type ReferenceFileServerUploadInput = {
  knowledgeFolderId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
};

export type ReferenceFileServerUploadResult =
  | { ok: true; documents: KnowledgeDocument[] }
  | { ok: false; error: string; step?: string };

/**
 * Server-side upload (avoids browser → S3 CORS). Flow: presign → PUT (server) → save.
 * Falls back to Billie multipart upload if presigned PUT fails.
 */
export async function uploadReferenceFileOnServer(
  input: ReferenceFileServerUploadInput,
): Promise<ReferenceFileServerUploadResult> {
  const folderId = input.knowledgeFolderId.trim();
  const fileName = input.fileName.trim();
  if (!folderId) return { ok: false, error: "Knowledge folder id is required.", step: "validate" };
  if (!fileName) return { ok: false, error: "File name is required.", step: "validate" };
  if (input.body.length > PDF_MAX_BYTES) {
    return {
      ok: false,
      error: `File too large (max ${PDF_MAX_BYTES / (1024 * 1024)}MB).`,
      step: "validate",
    };
  }

  const contentType = contentTypeForFileName(fileName, input.mimeType);

  const presign = await presignReferenceUpload(fileName);
  if (!presign.ok) {
    return { ok: false, error: presign.error, step: "presign" };
  }

  let fileUrl = presign.fileUrl;
  const put = await putBufferToPresignedUrl(presign.uploadUrl, input.body, contentType);
  if (!put.ok) {
    const fallback = await billieMultipartUpload(fileName, input.body, contentType);
    if (!fallback.ok) {
      return {
        ok: false,
        error: `${put.error} Fallback upload also failed: ${fallback.error}`,
        step: "storage",
      };
    }
    fileUrl = fallback.fileUrl;
  }

  const saved = await billieSaveReferenceFiles(folderId, [
    {
      sourceFileUrl: fileUrl,
      sourceFileName: fileName,
      sourceFileType: inferSourceFileType(fileName),
      sourceFileSize: input.body.length,
    },
  ]);
  if (!saved.ok) {
    return { ok: false, error: saved.error, step: "save" };
  }

  return { ok: true, documents: saved.documents };
}
