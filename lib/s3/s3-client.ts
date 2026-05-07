import "server-only";
import { S3Client, type S3ClientConfig } from "@aws-sdk/client-s3";

/**
 * Defaults to **path-style** (`https://s3.REGION.amazonaws.com/bucket/key`) because Node
 * sometimes hits `getaddrinfo ENOTFOUND` on virtual-hosted
 * `https://BUCKET.s3.REGION.amazonaws.com` even when `nslookup` works in Terminal (IPv6/DNS order/proxy).
 *
 * Opt back into virtual-hosted: `S3_VIRTUAL_HOST_STYLE=true`
 * Legacy override: `S3_FORCE_PATH_STYLE=0` also disables path-style.
 */
export function createS3Client(region: string): S3Client {
  const explicitVirtual =
    process.env.S3_VIRTUAL_HOST_STYLE === "1" ||
    process.env.S3_VIRTUAL_HOST_STYLE === "true";
  const explicitLegacyOff =
    process.env.S3_FORCE_PATH_STYLE === "0" ||
    process.env.S3_FORCE_PATH_STYLE === "false";
  const forcePathStyle = !(explicitVirtual || explicitLegacyOff);
  const config: S3ClientConfig = { region, forcePathStyle };
  return new S3Client(config);
}
