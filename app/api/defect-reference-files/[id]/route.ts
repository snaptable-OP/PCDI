import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToKnowledgeDocument,
  extractReferenceFileOne,
} from "@/lib/pcdi/defect-reference-file-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Proxies GET /api/defect-reference-files/{id}. */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const fileId = id?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-reference-files/${encodeURIComponent(fileId)}`;
  const result = await billieFetch(`defect-reference-files/${fileId} GET`, path, { method: "GET" });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractReferenceFileOne(data, "");
  const document = dto ? dtoToKnowledgeDocument(dto) : null;
  return NextResponse.json({ ok: true, document, detail: data });
}

/** Proxies DELETE /api/defect-reference-files/{id}. */
export async function DELETE(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const fileId = id?.trim();
  if (!fileId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-reference-files/${encodeURIComponent(fileId)}`;
  const result = await billieFetch(`defect-reference-files/${fileId} DELETE`, path, {
    method: "DELETE",
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  if (res.status === 204) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: true, detail: data });
}
