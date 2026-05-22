import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client } from "@/lib/s3/s3-client";
import { buildXlsxS3Key, xlsxContentType } from "@/lib/s3/xlsx-s3-key";

const UPLOAD_PRESIGN_EXPIRES = 60 * 60; // 1 hour to complete PUT

export function requireXlsxS3Env(): { region: string; bucket: string } {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!region) throw new Error("Missing AWS_REGION");
  if (!bucket) throw new Error("Missing AWS_S3_BUCKET");
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY");
  }
  return { region, bucket };
}

export async function getPresignedPutXlsxUrl(options: {
  projectId: string;
  fileName: string;
  mimeType?: string;
}): Promise<{
  uploadUrl: string;
  bucket: string;
  key: string;
  region: string;
  contentType: string;
}> {
  const { region, bucket } = requireXlsxS3Env();
  const key = buildXlsxS3Key(options.projectId, options.fileName);
  const contentType = xlsxContentType(options.fileName, options.mimeType);
  const client = createS3Client(region);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_PRESIGN_EXPIRES,
  });
  return { uploadUrl, bucket, key, region, contentType };
}
