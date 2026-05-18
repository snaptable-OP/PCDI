import { NextRequest, NextResponse } from "next/server";
import { billieHandoffDisabledResponse } from "@/lib/billie/upstream-json";
import { uploadReferenceFileOnServer } from "@/lib/pcdi/reference-file-server-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

const PDF_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Same-origin upload: presigned URL + server PUT to S3 (billie-defect-reference-file) + register via /save.
 * Avoids browser "Failed to fetch" from direct cross-origin PUT to S3.
 */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body." }, { status: 400 });
  }

  const file = form.get("file");
  const folderIdRaw = form.get("knowledgeFolderId");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field." }, { status: 400 });
  }
  const knowledgeFolderId =
    typeof folderIdRaw === "string" ? folderIdRaw.trim() : "";
  if (!knowledgeFolderId) {
    return NextResponse.json({ error: "Missing `knowledgeFolderId` field." }, { status: 400 });
  }

  const name = file.name.trim() || "upload.pdf";
  if (
    file.type !== "application/pdf" &&
    !name.toLowerCase().endsWith(".pdf")
  ) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 415 });
  }
  if (file.size > PDF_MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${PDF_MAX_BYTES / (1024 * 1024)}MB).` },
      { status: 413 },
    );
  }

  const body = Buffer.from(await file.arrayBuffer());
  const result = await uploadReferenceFileOnServer({
    knowledgeFolderId,
    fileName: name,
    mimeType: file.type,
    body,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, step: result.step },
      { status: result.step === "validate" ? 400 : 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    documents: result.documents,
    document: result.documents[0] ?? null,
  });
}
