import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import {
  GATEWAY_TIMEOUT_HINT,
  isUpstreamGatewayTimeout,
} from "@/lib/billie/gateway-timeout";
import { getBillieBase } from "@/lib/billie/upstream-json";
import {
  extractDefectProjectId,
  mapDefectProjectsResponseToHistorical,
} from "@/lib/pcdi/defect-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

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
 * Billie may return HTTP 200 with `{ success: false, errorMessage, code, result: null }` (e.g. DB constraint).
 */
function billieApplicationErrorMessage(data: unknown): string | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  if (o.success !== false) return null;
  if (typeof o.errorMessage === "string" && o.errorMessage.trim()) return o.errorMessage.trim();
  if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  return null;
}

/** Shorter UI copy for common create failures (constraint messages are very long). */
function humanizeProjectCreateError(raw: string): string {
  if (
    /Defect_Project_name_key/i.test(raw) ||
    (/duplicate key value violates unique constraint/i.test(raw) && /\(name\)=/i.test(raw))
  ) {
    return "A project with this name already exists. Use a different name (for example add a phase or site code).";
  }
  return raw;
}

/**
 * Proxies GET /api/defect-projects — authoritative project list for the live analysis home screen.
 */
export async function GET() {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
  }

  const base = getBillieBase();
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
    const gatewayTimeout = isUpstreamGatewayTimeout(res.status, msg, text);
    return NextResponse.json(
      {
        error: gatewayTimeout
          ? "The analysis API timed out while loading projects (AWS API Gateway limit is often ~30 seconds)."
          : msg,
        detail: data,
        gatewayTimeout,
        hint: gatewayTimeout ? GATEWAY_TIMEOUT_HINT : undefined,
      },
      { status: gatewayTimeout ? 504 : 502 },
    );
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

  const base = getBillieBase();
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
    const gatewayTimeout = isUpstreamGatewayTimeout(res.status, msg, text);
    return NextResponse.json(
      {
        error: gatewayTimeout
          ? "The analysis API timed out while creating this project (AWS API Gateway limit is often ~30 seconds)."
          : humanizeProjectCreateError(msg),
        detail: data,
        gatewayTimeout,
        hint: gatewayTimeout ? GATEWAY_TIMEOUT_HINT : undefined,
      },
      { status: gatewayTimeout ? 504 : 502 },
    );
  }

  const appErr = billieApplicationErrorMessage(data);
  if (appErr) {
    return NextResponse.json(
      { error: humanizeProjectCreateError(appErr), detail: data },
      { status: 409 },
    );
  }

  const id = extractDefectProjectId(data);
  if (!id) {
    console.error("[defect-projects] missing id in response", data);
    return NextResponse.json(
      {
        error:
          "Could not read a project id from the analysis server response. If the request failed, details are in the payload below.",
        detail: data,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, id, data });
}
