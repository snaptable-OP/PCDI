import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import { extractPresignedUpload } from "@/lib/pcdi/defect-reference-file-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Proxies Billie `GET /api/defect-files/presigned-url` — browser PUTs .xlsx to S3 (no file through Vercel). */
export async function GET(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const fileName = request.nextUrl.searchParams.get("fileName")?.trim();
  if (!fileName) {
    return NextResponse.json({ error: "fileName query parameter is required" }, { status: 400 });
  }
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .xlsx file names are supported." }, { status: 415 });
  }

  const path = `/api/defect-files/presigned-url?fileName=${encodeURIComponent(fileName)}`;
  const result = await billieFetch("defect-files/presigned-url", path, { method: "GET" });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const presigned = extractPresignedUpload(data);
  if (!presigned) {
    return NextResponse.json(
      { error: "Could not read presigned upload URLs from the analysis server.", detail: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, ...presigned, detail: data });
}
