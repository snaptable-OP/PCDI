import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import { extractPresignedUpload } from "@/lib/pcdi/defect-reference-file-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Proxies GET /api/defect-reference-files/presigned-url?fileName=… (S3 bucket: billie-defect-reference-file). */
export async function GET(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const fileName = request.nextUrl.searchParams.get("fileName")?.trim();
  if (!fileName) {
    return NextResponse.json({ error: "fileName query parameter is required" }, { status: 400 });
  }

  const path = `/api/defect-reference-files/presigned-url?fileName=${encodeURIComponent(fileName)}`;
  const result = await billieFetch("defect-reference-files/presigned-url", path, { method: "GET" });
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
