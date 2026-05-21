import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import { getBillieBase } from "@/lib/billie/upstream-json";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ defectFileId: string }> };

/**
 * Proxies GET /api/defect-files/:id/status to Billie (poll until merge file is ready).
 */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
  }

  const { defectFileId } = await ctx.params;
  const id = defectFileId?.trim();
  if (!id) {
    return NextResponse.json({ error: "defectFileId is required" }, { status: 400 });
  }

  const base = getBillieBase();
  const url = `${base}/api/defect-files/${encodeURIComponent(id)}/status`;

  const headers: Record<string, string> = {};
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  } catch (e) {
    return upstreamFetchFailedResponse(`defect-files/${id}/status`, e);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "errorMessage" in data &&
      typeof (data as { errorMessage: unknown }).errorMessage === "string"
        ? (data as { errorMessage: string }).errorMessage
      : typeof data === "object" &&
          data !== null &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Status server returned ${res.status}`;
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  return NextResponse.json(data);
}
