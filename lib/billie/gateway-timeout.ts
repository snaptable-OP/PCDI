export const GATEWAY_TIMEOUT_HINT =
  "The analysis API (AWS API Gateway) often times out after about 30 seconds. Ask your backend team to increase the integration/Lambda timeout or fix slow database startup — this is not something the UI can fix by waiting longer.";

export function isUpstreamGatewayTimeout(
  status: number,
  message: string,
  rawText = "",
): boolean {
  const blob = `${message} ${rawText}`.toLowerCase();
  return (
    status === 504 ||
    blob.includes("gateway timeout") ||
    blob.includes("endpoint request timed out")
  );
}
