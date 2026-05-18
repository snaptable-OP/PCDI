import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  extractKnowledgeProjectId,
  extractKnowledgeProjectOne,
  dtoToKnowledgeFolder,
} from "@/lib/pcdi/defect-knowledge-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 60;

const CREATE_PATH = "/api/defect-knowledge-projects";

/** Proxies POST /api/defect-knowledge-projects — create a Knowledge Folder. */
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

  const result = await billieFetch("defect-knowledge-projects POST", CREATE_PATH, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const bodyProjectId =
    body && typeof body === "object" && body !== null && "projectId" in body
      ? String((body as { projectId: unknown }).projectId ?? "").trim()
      : "";
  const dto = extractKnowledgeProjectOne(data, bodyProjectId);
  const id = dto?.id ?? extractKnowledgeProjectId(data);
  if (!id) {
    return NextResponse.json(
      { error: "Could not read Knowledge Folder id from the analysis server response.", detail: data },
      { status: 502 },
    );
  }

  const folder = dto ? dtoToKnowledgeFolder(dto) : null;
  return NextResponse.json({ ok: true, id, folder, detail: data });
}
