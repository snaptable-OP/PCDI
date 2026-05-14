import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";

type Params = { params: Promise<{ contentRowId: string }> };

/**
 * Proxies PUT /api/defect-files/content/:id — updates a single content row (e.g. `response` text).
 */
export async function PUT(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  const { contentRowId } = await ctx.params;
  const cid = contentRowId?.trim();
  if (!cid) {
    return NextResponse.json({ error: "contentRowId is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}/api/defect-files/content/${encodeURIComponent(cid)}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    return upstreamFetchFailedResponse(`defect-files/content/${cid}`, e);
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
        : `Analysis server returned ${res.status}`;
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  return NextResponse.json(data ?? { ok: true });
}
