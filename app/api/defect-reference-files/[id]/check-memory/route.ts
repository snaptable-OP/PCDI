import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import { extractCheckMemoryResult } from "@/lib/pcdi/defect-reference-file-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Proxies GET /api/defect-reference-files/{id}/check-memory — AI indexing status. */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const fileId = id?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-reference-files/${encodeURIComponent(fileId)}/check-memory`;
  const result = await billieFetch(
    `defect-reference-files/${fileId}/check-memory`,
    path,
    { method: "GET" },
  );
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const memory = extractCheckMemoryResult(data);
  if (!memory) {
    return NextResponse.json(
      { error: "Could not read check-memory response from the analysis server.", detail: data },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, memory, detail: data });
}
