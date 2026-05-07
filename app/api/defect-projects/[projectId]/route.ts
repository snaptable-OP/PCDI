import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import {
  extractSingleDefectProjectFromDetailPayload,
  mapDefectProjectRowToHistorical,
} from "@/lib/pcdi/defect-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";

type Params = { params: Promise<{ projectId: string }> };

function upstreamErrorMessage(data: unknown, fallbackStatus: number): string {
  return typeof data === "object" &&
    data !== null &&
    "errorMessage" in data &&
    typeof (data as { errorMessage: unknown }).errorMessage === "string"
    ? (data as { errorMessage: string }).errorMessage
    : typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof (data as { message: unknown }).message === "string"
      ? (data as { message: string }).message
      : `Analysis server returned ${fallbackStatus}`;
}

/**
 * Proxies GET /api/defect-projects/:projectId when Billie exposes a single-project endpoint.
 * Used to refresh `defectFileId` for the mind map so it matches the server’s latest register file.
 */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
  }

  const { projectId } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}/api/defect-projects/${encodeURIComponent(id)}`;

  const headers: Record<string, string> = {};
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, cache: "no-store" });
  } catch (e) {
    return upstreamFetchFailedResponse(`defect-projects/${id}`, e);
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
    const msg = upstreamErrorMessage(data, res.status);
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  const row = extractSingleDefectProjectFromDetailPayload(data);
  const project = mapDefectProjectRowToHistorical(row ?? data, "live");
  return NextResponse.json({ ok: true as const, project, detail: data });
}
