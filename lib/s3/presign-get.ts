import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client } from "@/lib/s3/s3-client";

// IAM for the key used in .env.local: needs s3:PutObject to upload; s3:GetObject so presigned download URLs work.

/** S3 presigned GET upper bound (SigV4, typical use). */
const MAX_EXPIRES = 60 * 60 * 24 * 7; // 7 days
const MIN_EXPIRES = 60;

function presignTtlSeconds(): number {
  const raw = process.env.S3_PRESIGN_TTL_SECONDS;
  if (raw == null || raw === "") return MAX_EXPIRES;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return MAX_EXPIRES;
  return Math.min(MAX_EXPIRES, Math.max(MIN_EXPIRES, n));
}

/**
 * Returns a time-limited HTTPS URL the backend (or any client) can use to download the object.
 */
export async function getPresignedGetObjectUrl(options: {
  region: string;
  bucket: string;
  key: string;
}): Promise<{ fileUrl: string; expiresInSeconds: number }> {
  const expiresInSeconds = presignTtlSeconds();
  const client = createS3Client(options.region);
  const command = new GetObjectCommand({
    Bucket: options.bucket,
    Key: options.key,
  });
  const fileUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { fileUrl, expiresInSeconds };
}
