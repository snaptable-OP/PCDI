import { NextRequest, NextResponse } from "next/server";
import { billieLongRunningFetch } from "@/lib/billie/upstream-fetch-options";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import { GATEWAY_TIMEOUT_HINT, isUpstreamGatewayTimeout } from "@/lib/billie/gateway-timeout";
import { getBillieBase } from "@/lib/billie/upstream-json";

export const runtime = "nodejs";
/** Large workbooks; Vercel Pro max is 800s. */
export const maxDuration = 800;
const SAVE_PATH = "/api/defect-files/saveExcelContent";

type Body = {
  projectId?: string;
  fileUrl?: string;
  headerNum?: number;
};

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Forwards the S3 file URL and header row to the Billie backend (server-side: avoids CORS, can attach auth).
 */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { projectId, fileUrl, headerNum } = json;
  if (typeof projectId !== "string" || !projectId.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (typeof fileUrl !== "string" || !isHttpsUrl(fileUrl)) {
    return NextResponse.json({ error: "fileUrl must be a valid http(s) URL" }, { status: 400 });
  }
  if (typeof headerNum !== "number" || !Number.isInteger(headerNum) || headerNum < 1) {
    return NextResponse.json({ error: "headerNum must be a positive integer" }, { status: 400 });
  }

  const base = getBillieBase();
  const url = `${base}${SAVE_PATH}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await billieLongRunningFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        projectId: projectId.trim(),
        fileUrl: fileUrl.trim(),
        headerNum,
      }),
    });
  } catch (e) {
    return upstreamFetchFailedResponse("save-excel-content", e);
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
    const rawMsg =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : `Analysis server returned ${res.status}`;
    const gatewayTimeout = isUpstreamGatewayTimeout(res.status, rawMsg, text);
    const msg = gatewayTimeout
      ? "The analysis API gateway timed out while registering this spreadsheet (common limit ~30 seconds on AWS API Gateway)."
      : rawMsg;
    return NextResponse.json(
      {
        error: msg,
        status: res.status,
        gatewayTimeout,
        detail: data,
        hint: gatewayTimeout
          ? `${GATEWAY_TIMEOUT_HINT} Your file may already be on S3 — retry registration or use a smaller file.`
          : undefined,
      },
      { status: gatewayTimeout ? 504 : 502 },
    );
  }

  return NextResponse.json({ ok: true as const, data });
}
