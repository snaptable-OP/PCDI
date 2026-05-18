import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  dtoToResponseStrategyAgent,
  extractDefectAgentId,
  extractDefectAgentOne,
} from "@/lib/pcdi/defect-agent-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

const CREATE_PATH = "/api/defect-agents";

/** Proxies POST /api/defect-agents — create (save) a response strategy agent. */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
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

  const upstreamBody =
    body && typeof body === "object" && body !== null
      ? {
          defectKnowledgeProjectId: (body as { defectKnowledgeProjectId?: unknown })
            .defectKnowledgeProjectId,
          userChosenResponseStrategy: (body as { userChosenResponseStrategy?: unknown })
            .userChosenResponseStrategy,
          prompt: (body as { prompt?: unknown }).prompt,
        }
      : body;

  const result = await billieFetch("defect-agents POST", CREATE_PATH, {
    method: "POST",
    body: JSON.stringify(upstreamBody),
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dto = extractDefectAgentOne(data, folderId);
  const id = dto?.id ?? extractDefectAgentId(data);
  if (!id) {
    return NextResponse.json(
      { error: "Could not read agent id from the analysis server response.", detail: data },
      { status: 502 },
    );
  }

  const agent =
    dto && projectId ? dtoToResponseStrategyAgent(dto, projectId) : null;
  return NextResponse.json({ ok: true, id, agent, detail: data });
}
