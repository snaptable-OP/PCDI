import "server-only";
import { NextResponse } from "next/server";

/**
 * When fetch() to Billie throws (DNS, TLS, ECONNREFUSED, VPN, etc.), return a JSON body the UI can show.
 */
function isUpstreamTimeoutError(detail: string): boolean {
  const d = detail.toLowerCase();
  return (
    d.includes("headers timeout") ||
    d.includes("body timeout") ||
    d.includes("timeout") ||
    d.includes("aborted") ||
    d.includes("abort")
  );
}

export function upstreamFetchFailedResponse(logLabel: string, e: unknown): NextResponse {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause =
    err.cause instanceof Error ? err.cause.message : err.cause != null ? String(err.cause) : undefined;
  const detail = [err.name !== "Error" ? err.name : null, err.message, cause].filter(Boolean).join(" · ");
  console.error(`[${logLabel}] upstream fetch failed`, e);

  if (isUpstreamTimeoutError(detail)) {
    return NextResponse.json(
      {
        error:
          "The analysis server took too long to register this spreadsheet (common with large files).",
        cause: detail,
        hint:
          "Wait and try again (large files may need up to 15 minutes), or use a smaller file. If this keeps happening, the analysis server may need a longer limit for saveExcelContent. Check VPN/network if the server is unreachable.",
      },
      { status: 504 },
    );
  }

  return NextResponse.json(
    {
      error: "Could not reach the analysis server.",
      cause: detail,
      hint:
        "Check VPN, network, or that the analysis server is running. For local UI-only work without the server, ask your developer to enable backend skip flags in .env.local.",
    },
    { status: 502 },
  );
}
