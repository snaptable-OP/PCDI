import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "@/lib/s3/s3-client";

const MAX_KEY_FILENAME = 180;

function sanitizeFileNameForKey(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return base
    .replace(/[^\w.\-()+ ]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_KEY_FILENAME) || "upload.xlsx";
}

/**
 * Puts an .xlsx buffer into the configured bucket under `uploads/{projectId}/{timestamp}-{fileName}`.
 * Uses env: AWS_REGION, AWS_S3_BUCKET, and standard AWS credential env vars.
 */
export async function putXlsxToS3(options: {
  projectId: string;
  fileName: string;
  contentType: string;
  body: Buffer;
}): Promise<{ bucket: string; key: string; region: string }> {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_S3_BUCKET;
  if (!region) throw new Error("Missing AWS_REGION");
  if (!bucket) throw new Error("Missing AWS_S3_BUCKET");
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY");
  }

  const safe = sanitizeFileNameForKey(options.fileName);
  const key = `uploads/${options.projectId}/${Date.now()}-${safe}`;

  const client = createS3Client(region);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: options.body,
      ContentType: options.contentType,
    }),
  );

  return { bucket, key, region };
}
