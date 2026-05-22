import type { KnowledgeDocument } from "@/lib/pcdi/knowledge-folders-store";

/** Matches server validation in reference-file-server-upload.ts */
export const REFERENCE_PDF_MAX_BYTES = 25 * 1024 * 1024;

/** Max size for server proxy PUT through Vercel (body limit ~4.5MB). */
export const REFERENCE_SERVER_PROXY_MAX_BYTES = 4 * 1024 * 1024;

export const REFERENCE_FILE_CORS_DOC_PATH = "/docs/s3-cors-reference-file-bucket.md";

function inferSourceFileType(fileName: string): string {
  const n = fileName.toLowerCase();
  if (n.endsWith(".pdf")) return "PDF";
  if (n.endsWith(".xlsx")) return "EXCEL";
  if (n.endsWith(".doc") || n.endsWith(".docx")) return "WORD";
  return "FILE";
}

function pdfContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return "application/pdf";
}

function validateReferencePdf(file: File): string | null {
  const name = file.name.trim() || "upload.pdf";
  if (file.type !== "application/pdf" && !name.toLowerCase().endsWith(".pdf")) {
    return "Only PDF files are supported.";
  }
  if (file.size > REFERENCE_PDF_MAX_BYTES) {
    return `File too large (max ${REFERENCE_PDF_MAX_BYTES / (1024 * 1024)}MB).`;
  }
  return null;
}

function isBrowserStorageNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m === "failed to fetch" || m.includes("networkerror") || m.includes("load failed");
}

export function referenceFileCorsHelpMessage(fileSizeBytes: number): string {
  const mb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
  const proxyHint =
    fileSizeBytes <= REFERENCE_SERVER_PROXY_MAX_BYTES
      ? " The app will try a small-file server fallback automatically."
      : ` Your file is ${mb}MB — it must upload directly to S3 once CORS is fixed (over 4MB cannot go through Vercel).`;
  return (
    "Could not upload directly to storage (usually S3 CORS)." +
    proxyHint +
    " Ask your AWS/backend team to add CORS on the reference-file bucket (billie-defect-reference-file): allow PUT from " +
    "https://pcdi-ui.vercel.app, your Vercel preview URLs, and http://127.0.0.1:3333. " +
    `See ${REFERENCE_FILE_CORS_DOC_PATH} in the repo for a sample policy.`
  );
}

export async function fetchReferencePresignedUrls(
  file: File,
  signal?: AbortSignal,
): Promise<
  | { ok: true; uploadUrl: string; fileUrl: string }
  | { ok: false; error: string; step: "validate" | "presign" }
> {
  const validation = validateReferencePdf(file);
  if (validation) return { ok: false, error: validation, step: "validate" };

  const fileName = file.name.trim() || "upload.pdf";
  const presignRes = await fetch(
    `/api/defect-reference-files/presigned-url?fileName=${encodeURIComponent(fileName)}`,
    { cache: "no-store", signal },
  );
  const presignBody = (await presignRes.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    fileUrl?: string;
  };
  if (!presignRes.ok) {
    return {
      ok: false,
      step: "presign",
      error: presignBody.error ?? "Could not get a presigned upload URL from the analysis server.",
    };
  }
  const uploadUrl = presignBody.uploadUrl?.trim();
  const fileUrl = presignBody.fileUrl?.trim();
  if (!uploadUrl || !fileUrl) {
    return { ok: false, step: "presign", error: "Presigned upload URLs were missing from the server response." };
  }
  return { ok: true, uploadUrl, fileUrl };
}

async function putFileToPresignedUrlOnce(
  uploadUrl: string,
  file: File,
  headers: HeadersInit | undefined,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string; networkError: boolean }> {
  try {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers,
      cache: "no-store",
      signal,
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      return {
        ok: false,
        networkError: false,
        error: `Storage upload failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      networkError: isBrowserStorageNetworkError(msg),
      error: msg,
    };
  }
}

/** Browser PUT to presigned URL — tries without Content-Type first (SigV4 / CORS). */
export async function putReferencePdfToPresignedS3(
  uploadUrl: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string; corsLikely: boolean }> {
  const bare = await putFileToPresignedUrlOnce(uploadUrl, file, undefined, signal);
  if (bare.ok) return { ok: true };

  if (!bare.networkError) {
    const withType = await putFileToPresignedUrlOnce(
      uploadUrl,
      file,
      { "Content-Type": pdfContentType(file) },
      signal,
    );
    if (withType.ok) return { ok: true };
    return { ok: false, error: withType.error, corsLikely: false };
  }

  return { ok: false, error: bare.error, corsLikely: true };
}

/** Server PUT via Next.js (no browser CORS; Vercel ~4MB limit). */
export async function putReferencePdfViaServerProxy(
  uploadUrl: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (file.size > REFERENCE_SERVER_PROXY_MAX_BYTES) {
    return {
      ok: false,
      error: `File too large for server upload proxy (max ${REFERENCE_SERVER_PROXY_MAX_BYTES / (1024 * 1024)}MB).`,
    };
  }
  const form = new FormData();
  form.append("file", file);
  form.append("uploadUrl", uploadUrl);
  const res = await fetch("/api/defect-reference-files/s3-put", {
    method: "POST",
    body: form,
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `Server storage proxy failed (${res.status}).` };
  }
  return { ok: true };
}

/**
 * Presign → browser PUT to S3 → optional server PUT fallback (≤4MB).
 */
export async function uploadReferencePdfToStorage(
  file: File,
  signal?: AbortSignal,
): Promise<
  | { ok: true; fileUrl: string }
  | { ok: false; error: string; step: "validate" | "presign" | "storage" }
> {
  const presigned = await fetchReferencePresignedUrls(file, signal);
  if (!presigned.ok) {
    return { ok: false, error: presigned.error, step: presigned.step };
  }

  const browserPut = await putReferencePdfToPresignedS3(
    presigned.uploadUrl,
    file,
    signal,
  );
  if (browserPut.ok) {
    return { ok: true, fileUrl: presigned.fileUrl };
  }

  if (browserPut.corsLikely || isBrowserStorageNetworkError(browserPut.error)) {
    if (file.size <= REFERENCE_SERVER_PROXY_MAX_BYTES) {
      const proxy = await putReferencePdfViaServerProxy(presigned.uploadUrl, file, signal);
      if (proxy.ok) {
        return { ok: true, fileUrl: presigned.fileUrl };
      }
      return {
        ok: false,
        step: "storage",
        error: `${proxy.error} ${referenceFileCorsHelpMessage(file.size)}`,
      };
    }
    return {
      ok: false,
      step: "storage",
      error: referenceFileCorsHelpMessage(file.size),
    };
  }

  return { ok: false, step: "storage", error: browserPut.error };
}

/** Register an already-uploaded S3 object with the analysis server (small JSON only). */
export async function saveReferenceFileToFolder(
  knowledgeFolderId: string,
  file: File,
  fileUrl: string,
  signal?: AbortSignal,
): Promise<
  | { ok: true; documents: KnowledgeDocument[]; document: KnowledgeDocument | null }
  | { ok: false; error: string; step: "save" }
> {
  const folderId = knowledgeFolderId.trim();
  const fileName = file.name.trim() || "upload.pdf";
  const saveRes = await fetch("/api/defect-reference-files/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      defectKnowledgeProjectId: folderId,
      files: [
        {
          sourceFileUrl: fileUrl,
          sourceFileName: fileName,
          sourceFileType: inferSourceFileType(fileName),
          sourceFileSize: file.size,
        },
      ],
    }),
    signal,
  });
  const saveBody = (await saveRes.json().catch(() => ({}))) as {
    error?: string;
    documents?: KnowledgeDocument[];
    document?: KnowledgeDocument;
  };
  if (!saveRes.ok) {
    return {
      ok: false,
      step: "save",
      error: saveBody.error ?? "Could not register the file with the analysis server.",
    };
  }
  const documents = Array.isArray(saveBody.documents) ? saveBody.documents : [];
  const document = saveBody.document ?? documents[0] ?? null;
  return { ok: true, documents, document };
}
