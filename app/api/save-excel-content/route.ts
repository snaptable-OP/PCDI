import { NextRequest, NextResponse } from "next/server";
import { billieLongRunningFetch } from "@/lib/billie/upstream-fetch-options";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";

export const runtime = "nodejs";
/** Large workbooks; Vercel Pro max is 800s. */
export const maxDuration = 800;

const DEFAULT_BILLIE_BASE = "https://billie-alb-dev-s3.wonderbricks.com:6070";
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

  const base = (process.env.BILLIE_API_BASE || DEFAULT_BILLIE_BASE).replace(/\/$/, "");
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
