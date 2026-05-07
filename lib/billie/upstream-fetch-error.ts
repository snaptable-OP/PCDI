import "server-only";
import { NextResponse } from "next/server";

/**
 * When fetch() to Billie throws (DNS, TLS, ECONNREFUSED, VPN, etc.), return a JSON body the UI can show.
 */
export function upstreamFetchFailedResponse(logLabel: string, e: unknown): NextResponse {
  const err = e instanceof Error ? e : new Error(String(e));
  const cause =
    err.cause instanceof Error ? err.cause.message : err.cause != null ? String(err.cause) : undefined;
  const detail = [err.name !== "Error" ? err.name : null, err.message, cause].filter(Boolean).join(" · ");
  console.error(`[${logLabel}] upstream fetch failed`, e);
  return NextResponse.json(
    {
      error: "Could not reach the analysis server.",
      cause: detail,
      hint:
        "Your Mac must be able to reach the Billie URL (VPN/office network, or server running). For UI-only work: add BILLIE_SKIP_DEFECT_PROJECT_CREATE=1 and BILLIE_SKIP_BACKEND_HANDOFF=1 to .env.local and restart `npm run dev`.",
    },
    { status: 502 },
  );
}
