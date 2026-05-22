import "server-only";

/** Surface SDK / service errors in the client without leaking request IDs as the only help. */
export function formatAwsS3Error(e: unknown): {
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
