import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToKnowledgeDocument,
  extractReferenceFileList,
} from "@/lib/pcdi/defect-reference-file-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ knowledgeProjectId: string }> };

/** Proxies GET /api/defect-reference-files/by-knowledge-project/{knowledgeProjectId}. */
export async function GET(_request: NextRequest, ctx: Params) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  const { knowledgeProjectId } = await ctx.params;
  const folderId = knowledgeProjectId?.trim();
  if (!folderId) {
    return NextResponse.json({ error: "knowledgeProjectId is required" }, { status: 400 });
  }

  const path = `/api/defect-reference-files/by-knowledge-project/${encodeURIComponent(folderId)}`;
  const result = await billieFetch(
    `defect-reference-files/by-knowledge-project/${folderId}`,
    path,
    { method: "GET" },
  );
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dtos = extractReferenceFileList(data, folderId);
  const documents = dtos.map(dtoToKnowledgeDocument);
  return NextResponse.json({ ok: true, documents, detail: data });
}
