import { NextRequest, NextResponse } from "next/server";
import { formatAwsS3Error } from "@/lib/s3/format-aws-s3-error";
import { getPresignedGetObjectUrl } from "@/lib/s3/presign-get";
import { putXlsxToS3 } from "@/lib/s3/put-xlsx";

export const runtime = "nodejs";
/** Large .xlsx uploads to S3 can take over a minute on slow links. */
export const maxDuration = 180;

const MAX_BYTES = 30 * 1024 * 1024;
const HEADER_ROW_MIN = 1;
const HEADER_ROW_MAX = 1000;

function isXlsx(name: string, type: string): boolean {
  const n = name.toLowerCase();
  if (!n.endsWith(".xlsx")) return false;
  return (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/octet-stream" ||
    type === "" ||
    type === "application/zip" // xlsx is zip-based, some clients send this
  );
}

/**
 * Legacy: full .xlsx in request body (hits Vercel FUNCTION_PAYLOAD_TOO_LARGE above ~4.5MB).
 * UI uses presign → browser PUT → /complete instead (see xlsx-client-upload.ts).
 */
export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > 4 * 1024 * 1024) {
    return NextResponse.json(
      {
        error:
          "File is too large to upload through Vercel. The app uploads directly to S3 — refresh and try again, or enable S3 CORS on AWS_S3_BUCKET.",
      },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body is too large or invalid. Large .xlsx files must use direct S3 upload (presign + browser PUT).",
      },
      { status: 413 },
    );
  }

  const file = form.get("file");
  const projectIdRaw = form.get("projectId");
  const headerRowRaw = form.get("headerRow");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }
  if (typeof projectIdRaw !== "string" || !projectIdRaw.trim()) {
    return NextResponse.json({ error: "Missing `projectId` field" }, { status: 400 });
  }
  if (typeof headerRowRaw !== "string" || headerRowRaw.trim() === "") {
    return NextResponse.json(
      { error: "Missing `headerRow` field (1-based Excel row for column names)." },
      { status: 400 },
    );
  }
  const headerRowN = parseInt(headerRowRaw.trim(), 10);
  if (!Number.isFinite(headerRowN) || headerRowN < HEADER_ROW_MIN || headerRowN > HEADER_ROW_MAX) {
    return NextResponse.json(
      { error: `headerRow must be between ${HEADER_ROW_MIN} and ${HEADER_ROW_MAX}.` },
      { status: 400 },
    );
  }

  const projectId = projectIdRaw.trim();
  const headerRow = Math.floor(headerRowN);
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / (1024 * 1024)}MB).` },
      { status: 413 },
    );
  }

  if (!isXlsx(file.name, file.type)) {
    return NextResponse.json(
      { error: "Only .xlsx uploads are allowed." },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  try {
    const { bucket, key, region } = await putXlsxToS3({
      projectId,
      fileName: file.name,
      contentType: type,
      body: buf,
    });
    const { fileUrl, expiresInSeconds } = await getPresignedGetObjectUrl({
      region,
      bucket,
      key,
    });
    return NextResponse.json({
      ok: true,
      fileUrl,
      headerRow,
      presignedUrlExpiresInSeconds: expiresInSeconds,
      bucket,
      key,
      region,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "S3 upload failed";
    if (
      message.includes("Missing AWS_") ||
      message.includes("AWS_ACCESS_KEY") ||
      message.includes("AWS_SECRET")
    ) {
      return NextResponse.json(
        { error: "S3 is not configured. Set AWS env vars in .env.local and restart the dev server." },
        { status: 503 },
      );
    }
    const aws = formatAwsS3Error(e);
    console.error("[upload-xlsx]", aws.logLine, e);
    return NextResponse.json(
      {
        error: aws.userMessage,
        code: aws.code,
      },
      { status: 500 },
    );
  }
}

