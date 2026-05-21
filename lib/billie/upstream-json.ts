import "server-only";
import { NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";

export const DEFAULT_BILLIE_BASE =
  "https://t6hoa3aw78.execute-api.ap-southeast-2.amazonaws.com";

export function getBillieBase(): string {
  return (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
}

export function billieAuthHeaders(jsonBody = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (jsonBody) headers["Content-Type"] = "application/json";
  const token = process.env.BILLIE_API_KEY;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function isBillieEndpointUnavailable(data: unknown, status: number): boolean {
  if (status !== 403 && status !== 404 && status !== 405) return false;
  const blob =
    typeof data === "object" && data !== null
      ? JSON.stringify(data).toLowerCase()
      : String(data ?? "").toLowerCase();
  return blob.includes("not available") || blob.includes("endpoint is not available");
}

export function upstreamErrorMessage(data: unknown, fallbackStatus: number): string {
  if (isBillieEndpointUnavailable(data, fallbackStatus)) {
    return (
      "Generate response is not available on the analysis server yet. " +
      "Ask your backend team to enable POST /api/defect-files/generate-response on the environment this app uses."
    );
  }
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
  ) {
    return (data as { error: string }).error;
  }
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

export async function readUpstreamJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

export function billieHandoffDisabledResponse(): NextResponse {
  return NextResponse.json({ error: "Backend handoff disabled." }, { status: 503 });
}

export async function billieFetch(
  logLabel: string,
  path: string,
  init: RequestInit = {},
): Promise<{ res: Response; data: unknown } | NextResponse> {
  const base = getBillieBase();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const body = init.body;
  const isFormData =
    body != null &&
    typeof body === "object" &&
    typeof (body as { append?: unknown }).append === "function" &&
    typeof (body as { get?: unknown }).get === "function";
  const jsonBody = body != null && typeof body === "string" && !isFormData;
  const headers = {
    ...billieAuthHeaders(jsonBody),
    ...(init.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (e) {
    return upstreamFetchFailedResponse(logLabel, e);
  }

  const data = await readUpstreamJson(res);
  return { res, data };
}

export function upstreamErrorResponse(
  data: unknown,
  status: number,
  fallbackStatus = 502,
): NextResponse {
  const msg = upstreamErrorMessage(data, status);
  return NextResponse.json({ error: msg, detail: data }, { status: fallbackStatus });
}
