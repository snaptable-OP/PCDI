import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import { mapKnowledgeProjectsResponseToFolders } from "@/lib/pcdi/defect-knowledge-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ projectId: string }> };

/** Proxies GET /api/defect-knowledge-projects/by-project/{projectId}. */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { projectId } = await ctx.params;
  const id = projectId?.trim();
  if (!id) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const path = `/api/defect-knowledge-projects/by-project/${encodeURIComponent(id)}`;
  const result = await billieFetch(`defect-knowledge-projects/by-project/${id}`, path, { method: "GET" });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const folders = mapKnowledgeProjectsResponseToFolders(data, id);
  return NextResponse.json({ ok: true, folders, detail: data });
}
