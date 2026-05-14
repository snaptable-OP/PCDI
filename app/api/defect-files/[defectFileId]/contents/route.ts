import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";

type Params = { params: Promise<{ defectFileId: string }> };

/**
 * Proxies GET /api/defect-files/:id/contents (paginated defect-file content rows).
 */
export async function GET(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
  }

  const { defectFileId } = await ctx.params;
  const id = defectFileId?.trim();
  if (!id) {
    return NextResponse.json({ error: "defectFileId is required" }, { status: 400 });
  }

  const page = request.nextUrl.searchParams.get("page") ?? "0";
  const size = request.nextUrl.searchParams.get("size") ?? "500";

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}/api/defect-files/${encodeURIComponent(id)}/contents?page=${encodeURIComponent(page)}&size=${encodeURIComponent(size)}`;

  const headers: Record<string, string> = {};
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  } catch (e) {
    return upstreamFetchFailedResponse(`defect-files/${id}/contents`, e);
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
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Defect file server returned ${res.status}`;
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  return NextResponse.json(data);
}
