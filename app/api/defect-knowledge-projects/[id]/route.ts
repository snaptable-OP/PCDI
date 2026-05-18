import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToKnowledgeFolder,
  extractKnowledgeProjectOne,
} from "@/lib/pcdi/defect-knowledge-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Proxies GET /api/defect-knowledge-projects/{id}. */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const folderId = id?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-knowledge-projects/${encodeURIComponent(folderId)}`;
  const result = await billieFetch(`defect-knowledge-projects/${folderId} GET`, path, { method: "GET" });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractKnowledgeProjectOne(data, "");
  const folder = dto ? dtoToKnowledgeFolder(dto) : null;
  return NextResponse.json({ ok: true, folder, detail: data });
}

/** Proxies PUT /api/defect-knowledge-projects/{id}. */
export async function PUT(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const folderId = id?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const path = `/api/defect-knowledge-projects/${encodeURIComponent(folderId)}`;
  const result = await billieFetch(`defect-knowledge-projects/${folderId} PUT`, path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractKnowledgeProjectOne(data, "");
  const folder = dto ? dtoToKnowledgeFolder(dto) : null;
  return NextResponse.json({ ok: true, folder, detail: data });
}

/** Proxies DELETE /api/defect-knowledge-projects/{id}. */
export async function DELETE(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const folderId = id?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-knowledge-projects/${encodeURIComponent(folderId)}`;
  const result = await billieFetch(`defect-knowledge-projects/${folderId} DELETE`, path, {
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
