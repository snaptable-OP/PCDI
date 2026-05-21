import { NextRequest, NextResponse } from "next/server";
import {
  billieFetch,
  billieHandoffDisabledResponse,
  upstreamErrorResponse,
} from "@/lib/billie/upstream-json";
import {
  buildGenerateResponseRequest,
  extractGenerateResponseResult,
} from "@/lib/pcdi/defect-generate-response-api-map";
import { buildMockDefectResponseText } from "@/lib/pcdi/mock-defect-response-text";

export const runtime = "nodejs";
export const maxDuration = 120;

const GENERATE_RESPONSE_PATH = "/api/defect-files/generate-response";

type Body = {
  query?: string;
  knowledgeId?: string;
  messages?: string[];
  /** Optional hints for demo mock when backend is disabled. */
  defectCategory?: string;
  strategyLabel?: string;
};

/** Proxies POST /api/defect-files/generate-response (Billie defect file generate response). */
export async function POST(request: NextRequest) {
  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof json.query === "string" ? json.query.trim() : "";
  const knowledgeId = typeof json.knowledgeId === "string" ? json.knowledgeId.trim() : "";

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (!knowledgeId) {
    return NextResponse.json({ error: "knowledgeId is required" }, { status: 400 });
  }

  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    const strategy =
      typeof json.strategyLabel === "string" ? json.strategyLabel.trim() : "General";
    const answer = buildMockDefectResponseText({
      defectCategory: typeof json.defectCategory === "string" ? json.defectCategory : "",
      defectDescription: query,
      strategyLabel: strategy,
      variant: 0,
    });
    return NextResponse.json({
      mode: "mock" as const,
      answer: `[Demo mode — backend handoff disabled]\n\n${answer}`,
      references: [],
    });
  }

  const upstreamBody = buildGenerateResponseRequest({
    query,
    knowledgeId,
    messages: Array.isArray(json.messages)
      ? json.messages.filter((m): m is string => typeof m === "string")
      : undefined,
  });

  const result = await billieFetch("defect-files/generate-response", GENERATE_RESPONSE_PATH, {
    method: "POST",
    body: JSON.stringify(upstreamBody),
  });

  if ("status" in result) {
    return result;
  }

  if (!result.res.ok) {
    return upstreamErrorResponse(result.data, result.res.status);
  }

  const parsed = extractGenerateResponseResult(result.data);
  if (!parsed?.answer?.trim()) {
    return NextResponse.json(
      {
        error:
          "No response from generate-response. Ensure reference PDFs are indexed (check-memory status=ready).",
        detail: result.data,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    mode: "api" as const,
    answer: parsed.answer,
    references: parsed.references,
  });
}
