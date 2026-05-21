import { NextRequest, NextResponse } from "next/server";
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
 * Server-only upload of the raw .xlsx to S3. Called from the client after local validation
 * (same file the user is parsing in the browser).
 */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request body is too large or invalid. Try a file under 30MB." },
      { status: 400 },
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

/** Surface SDK / service errors in the client without leaking request IDs as the only help. */
function formatAwsS3Error(e: unknown): {
  userMessage: string;
  code: string;
  logLine: string;
} {
  if (e instanceof Error) {
    const ex = e as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
    const code = (ex.Code || ex.name || "Error").toString();
    const msg = ex.message || "Unknown error";
    const logLine = `${code}: ${msg}`;

    if (code === "AccessDenied" || msg.includes("Access Denied")) {
      return {
        userMessage: `S3 access denied. Ensure this IAM user can s3:PutObject (and s3:GetObject for download links) on bucket "${process.env.AWS_S3_BUCKET ?? "(bucket)"}". ${msg}`,
        code: "AccessDenied",
        logLine,
      };
    }
    if (code === "NoSuchBucket" || msg.includes("The specified bucket does not exist")) {
      return {
        userMessage: `S3 bucket not found. Check AWS_S3_BUCKET matches the real bucket name and AWS_REGION is the region where the bucket was created. ${msg}`,
        code: "NoSuchBucket",
        logLine,
      };
    }
    if (code === "InvalidAccessKeyId" || code === "SignatureDoesNotMatch") {
      return {
        userMessage: `Invalid AWS key or secret. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local (no extra spaces or quotes) and restart the dev server. ${msg}`,
        code,
        logLine,
      };
    }
    if (code === "PermanentRedirect" || code === "AuthorizationHeaderMalformed") {
      return {
        userMessage: `Region mismatch. Set AWS_REGION to the bucket's region. ${msg}`,
        code,
        logLine,
      };
    }
    if (code === "NetworkingError" || code === "TimeoutError") {
      return {
        userMessage: `Network error talking to S3. Check VPN, firewall, and AWS_REGION. ${msg}`,
        code,
        logLine,
      };
    }
    const errno = (ex as NodeJS.ErrnoException).code;
    if (errno === "ENOTFOUND" || msg.includes("ENOTFOUND") || msg.includes("getaddrinfo")) {
      return {
        userMessage:
          `Could not resolve AWS (DNS). You may be offline, on a VPN/DNS that blocks Amazon, or behind a strict firewall. ` +
          `Try: another network, disable VPN, or set DNS to 8.8.8.8. ` +
          `If virtual-hosted S3 is blocked, add S3_FORCE_PATH_STYLE=1 to .env.local and restart the dev server. ` +
          `Details: ${msg}`,
        code: "ENOTFOUND",
        logLine,
      };
    }

    return {
      userMessage: `S3 request failed: ${msg}`,
      code,
      logLine,
    };
  }
  return {
    userMessage: "Could not upload to S3. See server log for details.",
    code: "Unknown",
    logLine: String(e),
  };
}
