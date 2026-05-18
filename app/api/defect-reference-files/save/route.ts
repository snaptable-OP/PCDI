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
export const maxDuration = 120;

/** Proxies POST /api/defect-reference-files/save — registers files and starts AI indexing. */
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
      ? String((body as { defectKnowledgeProjectId?: unknown }).defectKnowledgeProjectId ?? "").trim()
      : "";

  const result = await billieFetch("defect-reference-files/save", "/api/defect-reference-files/save", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (result instanceof NextResponse) return result;

  const { res, data } = result;
  if (!res.ok) return upstreamErrorResponse(data, res.status);

  const dtos = extractReferenceFileList(data, folderId);
  const documents = dtos.map(dtoToKnowledgeDocument);
  return NextResponse.json({ ok: true, documents, detail: data });
}
