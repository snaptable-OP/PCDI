import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToResponseStrategyAgent,
  extractDefectAgentList,
} from "@/lib/pcdi/defect-agent-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ knowledgeProjectId: string }> };

/** Proxies GET /api/defect-agents/by-knowledge-project/{knowledgeProjectId}. */
export async function GET(request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { knowledgeProjectId } = await ctx.params;
  const folderId = knowledgeProjectId?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "knowledgeProjectId is required" }, { status: 400 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";

  const path = `/api/defect-agents/by-knowledge-project/${encodeURIComponent(folderId)}`;
  const result = await billieFetch(
    `defect-agents/by-knowledge-project/${folderId}`,
    path,
    { method: "GET" },
  );
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dtos = extractDefectAgentList(data, folderId);
  const agents = projectId
    ? dtos.map((d) => dtoToResponseStrategyAgent(d, projectId))
    : [];
  return NextResponse.json({ ok: true, agents, detail: data });
}
