import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_MAX_WAIT_MS } from "@/lib/pcdi/analysis-timeouts";
import { parseBillieMergeXlsxBuffer } from "@/lib/pcdi/parse-billie-merge-xlsx";

export const runtime = "nodejs";
/** Vercel Pro max is 800s. */
export const maxDuration = 800;

type Body = {
  projectId?: string;
  mergeFileUrl?: string;
};

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Downloads merged XLSX from S3 URL and returns parsed defect rows (server-side: avoids client CORS). */
export async function POST(request: NextRequest) {
  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const projectId = typeof json.projectId === "string" ? json.projectId.trim() : "";
  const mergeFileUrl = typeof json.mergeFileUrl === "string" ? json.mergeFileUrl.trim() : "";

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }
  if (!mergeFileUrl || !isHttpsUrl(mergeFileUrl)) {
    return NextResponse.json({ error: "mergeFileUrl must be a valid http(s) URL" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(mergeFileUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(ANALYSIS_MAX_WAIT_MS),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: `Could not download merge file: ${msg}` }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Merge file HTTP ${res.status}` }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const { rows } = parseBillieMergeXlsxBuffer(buf, projectId);

  return NextResponse.json({ ok: true as const, rows });
}
