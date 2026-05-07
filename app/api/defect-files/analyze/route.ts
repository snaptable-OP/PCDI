import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";
const ANALYZE_PATH = "/api/defect-files/analyze";

type Body = {
  defectFileId?: string;
  headersToMerge?: unknown;
};

/**
 * Proxies POST /api/defect-files/analyze to Billie with body:
 * `{ defectFileId, headersToMerge }` (no projectId — matches upstream API).
 */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json(
      { error: "Backend handoff is disabled (BILLIE_SKIP_BACKEND_HANDOFF)." },
      { status: 503 },
    );
  }

  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { defectFileId, headersToMerge } = json;
  if (typeof defectFileId !== "string" || !defectFileId.trim()) {
    return NextResponse.json({ error: "defectFileId is required" }, { status: 400 });
  }
  if (!Array.isArray(headersToMerge) || headersToMerge.length === 0) {
    return NextResponse.json(
      { error: "headersToMerge must be a non-empty array of header strings" },
      { status: 400 },
    );
  }
  const headersList = headersToMerge.filter((h): h is string => typeof h === "string" && h.trim().length > 0);
  if (headersList.length === 0) {
    return NextResponse.json(
      { error: "headersToMerge must contain at least one non-empty string" },
      { status: 400 },
    );
  }

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}${ANALYZE_PATH}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        defectFileId: defectFileId.trim(),
        headersToMerge: headersList,
      }),
    });
  } catch (e) {
    return upstreamFetchFailedResponse("defect-files/analyze", e);
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
    return NextResponse.json(
      { error: msg, status: res.status, detail: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true as const, data });
}
