import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import {
  extractSingleDefectProjectFromDetailPayload,
  mapDefectProjectRowToHistorical,
  mapDefectProjectsResponseToHistorical,
} from "@/lib/pcdi/defect-project-api-map";
import type { HistoricalProject } from "@/lib/pcdi/types";

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

function shouldFallbackSingleProjectFetch(upstreamStatus: number, data: unknown): boolean {
  if (upstreamStatus === 403 || upstreamStatus === 404 || upstreamStatus === 405 || upstreamStatus === 501) {
    return true;
  }
  const blob =
    typeof data === "object" && data !== null
      ? JSON.stringify(data).toLowerCase()
      : String(data ?? "").toLowerCase();
  return blob.includes("not available") || blob.includes("endpoint is not available");
}

async function loadLiveProjectViaBillieList(
  base: string,
  projectId: string,
  headers: Record<string, string>,
): Promise<HistoricalProject | null> {
  const listUrl = `${base}/api/defect-projects`;
  let listRes: Response;
  try {
    listRes = await fetch(listUrl, { method: "GET", headers, cache: "no-store" });
  } catch {
    return null;
  }
  const text = await listRes.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }
  if (!listRes.ok) return null;
  const projects = mapDefectProjectsResponseToHistorical(data, "live");
  return projects.find((p) => p.id === projectId) ?? null;
}

/**
 * Proxies GET /api/defect-projects/:projectId when Billie exposes a single-project endpoint.
 * If Billie rejects that route (often 403 “not available”), falls back to GET /api/defect-projects and finds the row.
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
    if (shouldFallbackSingleProjectFetch(res.status, data)) {
      const fromList = await loadLiveProjectViaBillieList(base, id, headers);
      if (fromList) {
        return NextResponse.json({ ok: true as const, project: fromList, source: "list_fallback" as const });
      }
    }
    const msg = upstreamErrorMessage(data, res.status);
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  const row = extractSingleDefectProjectFromDetailPayload(data);
  const project = mapDefectProjectRowToHistorical(row ?? data, "live");
  return NextResponse.json({ ok: true as const, project, detail: data });
}

/** Proxies DELETE /api/defect-projects/:id — removes the project and all defect files under it. */
export async function DELETE(_request: NextRequest, ctx: Params) {
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
    res = await fetch(url, { method: "DELETE", headers, cache: "no-store" });
  } catch (e) {
    return upstreamFetchFailedResponse(`defect-projects/${id} DELETE`, e);
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

  if (res.status === 204 || !text.trim()) {
    return NextResponse.json(null);
  }
  return NextResponse.json(data);
}
