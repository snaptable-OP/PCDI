import { NextRequest, NextResponse } from "next/server";
import { formatAwsS3Error } from "@/lib/s3/format-aws-s3-error";
import { getPresignedPutXlsxUrl } from "@/lib/s3/presign-put-xlsx";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 30 * 1024 * 1024;
const HEADER_ROW_MIN = 1;
const HEADER_ROW_MAX = 1000;

function isXlsxName(name: string): boolean {
  return name.toLowerCase().endsWith(".xlsx");
}

/**
 * Returns a presigned PUT URL so the browser uploads .xlsx directly to S3 (no file through Vercel).
 */
export async function POST(request: NextRequest) {
  let json: {
    projectId?: string;
    fileName?: string;
    fileSize?: number;
    headerRow?: number;
    mimeType?: string;
  };
  try {
    json = (await request.json()) as typeof json;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof json.projectId === "string" ? json.projectId.trim() : "";
  const fileName = typeof json.fileName === "string" ? json.fileName.trim() : "";
  const fileSize = typeof json.fileSize === "number" ? json.fileSize : 0;
  const headerRow =
    typeof json.headerRow === "number" && Number.isInteger(json.headerRow)
      ? json.headerRow
      : NaN;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!fileName || !isXlsxName(fileName)) {
    return NextResponse.json({ error: "Only .xlsx file names are allowed." }, { status: 415 });
  }
  if (!Number.isFinite(fileSize) || fileSize < 1 || fileSize > MAX_BYTES) {
    return NextResponse.json(
      { error: `fileSize must be between 1 and ${MAX_BYTES / (1024 * 1024)}MB.` },
      { status: 400 },
    );
  }
  if (!Number.isFinite(headerRow) || headerRow < HEADER_ROW_MIN || headerRow > HEADER_ROW_MAX) {
    return NextResponse.json(
      { error: `headerRow must be between ${HEADER_ROW_MIN} and ${HEADER_ROW_MAX}.` },
      { status: 400 },
    );
  }

  try {
    const presigned = await getPresignedPutXlsxUrl({
      projectId,
      fileName,
      mimeType: json.mimeType,
    });
    return NextResponse.json({
      ok: true,
      ...presigned,
      headerRow: Math.floor(headerRow),
      projectId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "S3 presign failed";
    if (message.includes("Missing AWS_") || message.includes("AWS_ACCESS_KEY")) {
      return NextResponse.json(
        { error: "S3 is not configured. Set AWS env vars in .env.local and redeploy." },
        { status: 503 },
      );
    }
    const aws = formatAwsS3Error(e);
    console.error("[upload-xlsx/presign]", aws.logLine, e);
    return NextResponse.json({ error: aws.userMessage, code: aws.code }, { status: 500 });
  }
}
