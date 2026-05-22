import type { KnowledgeDocument } from "@/lib/pcdi/knowledge-folders-store";

/** Matches server validation in reference-file-server-upload.ts */
export const REFERENCE_PDF_MAX_BYTES = 25 * 1024 * 1024;

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

function storagePutErrorMessage(msg: string): string {
  if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
    return (
      "Could not upload directly to storage. The S3 bucket may need CORS rules allowing PUT from this app origin " +
      "(e.g. https://pcdi-ui.vercel.app and http://127.0.0.1:3333). Ask your backend/AWS team to update the reference-file bucket CORS."
    );
  }
  return msg;
}

/**
 * Browser → S3 via Billie presigned URL (no file bytes through Vercel).
 * 1. GET /api/defect-reference-files/presigned-url
 * 2. PUT file to uploadUrl
 */
export async function putReferencePdfToPresignedS3(
  file: File,
  signal?: AbortSignal,
): Promise<
  | { ok: true; fileUrl: string; uploadUrl: string }
  | { ok: false; error: string; step: "validate" | "presign" | "storage" }
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

  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": pdfContentType(file) },
      cache: "no-store",
      signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, step: "storage", error: storagePutErrorMessage(msg) };
  }

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    return {
      ok: false,
      step: "storage",
      error: `Storage upload failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    };
  }

  return { ok: true, fileUrl, uploadUrl };
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
