import { NextRequest, NextResponse } from "next/server";
import { isMergeFileProxyAllowed } from "@/lib/pcdi/allowed-merge-fetch-url";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = { url?: string };

/** Same-origin proxy for S3 merge/upload URLs so the browser avoids cross-origin fetch + missing bucket CORS. */
export async function POST(request: NextRequest) {
  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = typeof json.url === "string" ? json.url.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!isMergeFileProxyAllowed(url)) {
    return NextResponse.json({ error: "URL host is not allowed for proxy" }, { status: 403 });
  }

  let res: Response;
  try {
    res = await fetch(raw, { cache: "no-store", redirect: "follow" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: `Upstream fetch failed: ${msg}` }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Upstream HTTP ${res.status}` }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "application/octet-stream";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": "no-store",
    },
  });
}
