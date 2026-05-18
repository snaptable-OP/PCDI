import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToResponseStrategyAgent,
  extractDefectAgentOne,
} from "@/lib/pcdi/defect-agent-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

/** Proxies GET /api/defect-agents/{id}. */
export async function GET(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const agentId = id?.trim();
  if (!agentId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";

  const path = `/api/defect-agents/${encodeURIComponent(agentId)}`;
  const result = await billieFetch(`defect-agents/${agentId} GET`, path, { method: "GET" });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractDefectAgentOne(data, "");
  const agent = dto && projectId ? dtoToResponseStrategyAgent(dto, projectId) : null;
  return NextResponse.json({ ok: true, agent, detail: data });
}

/** Proxies PUT /api/defect-agents/{id}. */
export async function PUT(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const agentId = id?.trim();
  if (!agentId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const folderId =
    body && typeof body === "object" && body !== null
      ? String(
          (body as { defectKnowledgeProjectId?: unknown }).defectKnowledgeProjectId ??
            "",
        ).trim()
      : "";
  const projectId =
    body && typeof body === "object" && body !== null && "projectId" in body
      ? String((body as { projectId: unknown }).projectId ?? "").trim()
      : "";

  const path = `/api/defect-agents/${encodeURIComponent(agentId)}`;
  const upstreamBody =
    body && typeof body === "object" && body !== null
      ? {
          userChosenResponseStrategy: (body as { userChosenResponseStrategy?: unknown })
            .userChosenResponseStrategy,
          prompt: (body as { prompt?: unknown }).prompt,
        }
      : body;

  const result = await billieFetch(`defect-agents/${agentId} PUT`, path, {
    method: "PUT",
    body: JSON.stringify(upstreamBody),
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractDefectAgentOne(data, folderId);
  const agent = dto && projectId ? dtoToResponseStrategyAgent(dto, projectId) : null;
  return NextResponse.json({ ok: true, agent, detail: data });
}

/** Proxies DELETE /api/defect-agents/{id}. */
export async function DELETE(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { id } = await ctx.params;
  const agentId = id?.trim();
  if (!agentId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const path = `/api/defect-agents/${encodeURIComponent(agentId)}`;
  const result = await billieFetch(`defect-agents/${agentId} DELETE`, path, {
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
