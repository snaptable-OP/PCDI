import { NextRequest, NextResponse } from "next/server";
import { getPresignedGetObjectUrl } from "@/lib/s3/presign-get";
import { isValidXlsxUploadKey } from "@/lib/s3/validate-xlsx-upload-key";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * After browser PUT to S3, mint the presigned GET URL used by saveExcelContent (small JSON only).
 */
export async function POST(request: NextRequest) {
  let json: {
    projectId?: string;
    bucket?: string;
    key?: string;
    region?: string;
    headerRow?: number;
  };
  try {
    json = (await request.json()) as typeof json;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof json.projectId === "string" ? json.projectId.trim() : "";
  const bucket = typeof json.bucket === "string" ? json.bucket.trim() : "";
  const key = typeof json.key === "string" ? json.key.trim() : "";
  const region = typeof json.region === "string" ? json.region.trim() : "";
  const headerRow =
    typeof json.headerRow === "number" && Number.isInteger(json.headerRow)
      ? json.headerRow
      : 1;

  if (!projectId || !bucket || !key || !region) {
    return NextResponse.json({ error: "projectId, bucket, key, and region are required." }, { status: 400 });
  }
  if (!isValidXlsxUploadKey(key, projectId)) {
    return NextResponse.json({ error: "Invalid S3 key for this project." }, { status: 400 });
  }

  try {
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
    const msg = e instanceof Error ? e.message : "Could not create download URL";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
