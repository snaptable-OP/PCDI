import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import {
  extractDefectProjectId,
  mapDefectProjectsResponseToHistorical,
} from "@/lib/pcdi/defect-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";
const CREATE_PATH = "/api/defect-projects";

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
 * Proxies GET /api/defect-projects — authoritative project list for the live analysis home screen.
 */
export async function GET() {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
  }

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}${CREATE_PATH}`;

  const headers: Record<string, string> = {};
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e) {
    return upstreamFetchFailedResponse("defect-projects GET", e);
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
    return NextResponse.json({ error: msg, detail: data }, { status: 502 });
  }

  const projects = mapDefectProjectsResponseToHistorical(data, "live");
  return NextResponse.json({ ok: true, projects });
}

/**
 * Creates a defect project on the Billie stack; returns the server project id for uploads and saveExcel.
 */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_DEFECT_PROJECT_CREATE === "1") {
    const id = randomUUID();
    return NextResponse.json({ ok: true, id, skipped: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
  const url = `${base}${CREATE_PATH}`;

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
      body: JSON.stringify(body),
    });
  } catch (e) {
    return upstreamFetchFailedResponse("defect-projects", e);
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
    return NextResponse.json({ error: msg, detail: data }, { status: 502 });
  }

  const id = extractDefectProjectId(data);
  if (!id) {
    console.error("[defect-projects] missing id in response", data);
    return NextResponse.json(
      { error: "Server response did not include a project id.", detail: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, id, data });
}
