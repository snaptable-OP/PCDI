import { isUpstreamGatewayTimeout } from "@/lib/billie/gateway-timeout";

/** True when saveExcelContent failed due to upstream / gateway timeout (not auth or validation). */
export function isSaveExcelGatewayTimeout(
  status: number,
  body: { error?: string; cause?: string; gatewayTimeout?: boolean },
): boolean {
  if (body.gatewayTimeout === true || status === 504) return true;
  const blob = [body.error, body.cause].filter(Boolean).join(" ");
  return isUpstreamGatewayTimeout(status, blob);
}
