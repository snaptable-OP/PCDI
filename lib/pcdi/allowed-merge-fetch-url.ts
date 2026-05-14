/**
 * Allowed hosts for server-side merge-file proxy (SSRF guard).
 * Matches path-style and virtual-hosted Amazon S3 HTTPS URLs.
 */
export function isMergeFileProxyAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const h = url.hostname.toLowerCase();
  if (!h.endsWith(".amazonaws.com")) return false;
  if (h.includes(".s3.")) return true;
  if (h.startsWith("s3.")) return true;
  return false;
}
