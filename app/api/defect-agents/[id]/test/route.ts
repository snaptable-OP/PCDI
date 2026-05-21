import { NextRequest, NextResponse } from "next/server";
import { buildAgentTestQuery } from "@/lib/pcdi/defect-agent-test-api-map";
import {
  buildGenerateResponseRequest,
  extractGenerateResponseResult,
} from "@/lib/pcdi/defect-generate-response-api-map";
import { billieFetch, upstreamErrorResponse } from "@/lib/billie/upstream-json";
import { buildMockDefectResponseText } from "@/lib/pcdi/mock-defect-response-text";

export const runtime = "nodejs";
export const maxDuration = 120;

const GENERATE_RESPONSE_PATH = "/api/defect-files/generate-response";

type Body = {
  defectClaim?: string;
  knowledgeId?: string;
  knowledgeFolderId?: string;
  userChosenResponseStrategy?: string;
  prompt?: string;
};

/** Legacy path: forwards agent test to POST /api/defect-files/generate-response. */
export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> },
) {
  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const defectClaim = typeof json.defectClaim === "string" ? json.defectClaim.trim() : "";
  const prompt = typeof json.prompt === "string" ? json.prompt.trim() : "";
  const strategy =
    typeof json.userChosenResponseStrategy === "string"
      ? json.userChosenResponseStrategy.trim()
      : "";
  const knowledgeId =
    typeof json.knowledgeId === "string" && json.knowledgeId.trim()
      ? json.knowledgeId.trim()
      : typeof json.knowledgeFolderId === "string" && json.knowledgeFolderId.trim()
        ? json.knowledgeFolderId.trim()
        : "";

  if (!defectClaim) {
    return NextResponse.json({ error: "defectClaim is required" }, { status: 400 });
  }
  if (!knowledgeId) {
    return NextResponse.json({ error: "knowledgeId is required" }, { status: 400 });
  }

  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    const answer = buildMockDefectResponseText({
      defectCategory: "",
      defectDescription: defectClaim,
      strategyLabel: strategy || "General",
      variant: 0,
    });
    return NextResponse.json({
      mode: "mock" as const,
      answer: `[Demo mode — backend handoff disabled]\n\n${answer}`,
      references: [],
    });
  }

  const query = buildAgentTestQuery({ defectClaim, strategy, prompt });
  const upstreamBody = buildGenerateResponseRequest({
    query,
    knowledgeId,
    messages: [query],
  });

  const result = await billieFetch("defect-files/generate-response", GENERATE_RESPONSE_PATH, {
    method: "POST",
    body: JSON.stringify(upstreamBody),
  });

  if ("status" in result) return result;
  if (!result.res.ok) return upstreamErrorResponse(result.data, result.res.status);

  const parsed = extractGenerateResponseResult(result.data);
  if (!parsed?.answer?.trim()) {
    return NextResponse.json(
      { error: "No response from generate-response.", detail: result.data },
      { status: 502 },
    );
  }

  return NextResponse.json({
    mode: "api" as const,
    answer: parsed.answer,
    references: parsed.references,
  });
}
