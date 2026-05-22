import { isUpstreamGatewayTimeout } from "@/lib/billie/gateway-timeout";

export type SaveExcelErrorBody = {
  error?: string;
  cause?: string;
  hint?: string;
  gatewayTimeout?: boolean;
  status?: number;
};

export function isSaveExcelGatewayTimeout(
  status: number,
  body: SaveExcelErrorBody,
): boolean {
  if (body.gatewayTimeout === true || status === 504) return true;
  const blob = [body.error, body.cause].filter(Boolean).join(" ");
  return isUpstreamGatewayTimeout(status, blob);
}

/** Allow local column mapping when server registration failed transiently (S3 upload may still be OK). */
export function isSaveExcelRegistrationDegraded(
  status: number,
  body: SaveExcelErrorBody,
): boolean {
  if (isSaveExcelGatewayTimeout(status, body)) return true;
  if (status === 503 || status === 502) return true;
  const blob = [body.error, body.cause].filter(Boolean).join(" ").toLowerCase();
  return (
    blob.includes("service unavailable") ||
    blob.includes("bad gateway") ||
    blob.includes("temporarily unavailable")
  );
}

export function saveExcelRegistrationHint(status: number): string | undefined {
  if (status === 503) {
    return (
      "The analysis API returned 503 Service Unavailable. This is usually on the backend (Lambda cold start, overload, or misconfigured BILLIE_API_BASE / BILLIE_API_KEY on Vercel). " +
      "Wait a minute and use Retry server registration. Your file may already be in S3."
    );
  }
  return undefined;
}
