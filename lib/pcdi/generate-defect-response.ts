import { buildAgentTestQuery } from "@/lib/pcdi/defect-agent-test-api-map";
import type { GenerateResponseResult } from "@/lib/pcdi/defect-generate-response-api-map";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import { resolveResponseAgentForStrategy } from "@/lib/pcdi/resolve-knowledge-id-for-strategy";

export type GenerateDefectResponseOutcome =
  | { ok: true; mode: "api" | "mock"; result: GenerateResponseResult }
  | { ok: false; error: string };

export async function generateDefectResponse(input: {
  query: string;
  knowledgeId: string;
  messages?: string[];
  /** Passed to the route for demo mock text when backend handoff is skipped. */
  strategyLabel?: string;
  defectCategory?: string;
}): Promise<GenerateDefectResponseOutcome> {
  const query = input.query.trim();
  const knowledgeId = input.knowledgeId.trim();
  if (!query) return { ok: false, error: "A defect description or query is required." };
  if (!knowledgeId) return { ok: false, error: "Knowledge id is required." };

  const messages =
    input.messages?.map((m) => m.trim()).filter(Boolean) ?? [query];

  const res = await fetch("/api/defect-files/generate-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      knowledgeId,
      messages,
      strategyLabel: input.strategyLabel,
      defectCategory: input.defectCategory,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    mode?: "api" | "mock";
    answer?: string;
    references?: GenerateResponseResult["references"];
  };

  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not generate response." };
  }

  const answer = typeof body.answer === "string" ? body.answer : "";
  if (!answer.trim()) {
    return { ok: false, error: "The analysis server returned an empty response." };
  }

  return {
    ok: true,
    mode: body.mode === "mock" ? "mock" : "api",
    result: {
      answer,
      references: Array.isArray(body.references) ? body.references : [],
    },
  };
}

/** Live analysis: strategy label → knowledge folder via saved response agent. */
export async function generateDefectResponseForLiveRow(input: {
  projectId: string;
  strategyLabel: string;
  defectDescription: string;
  defectCategory?: string;
}): Promise<GenerateDefectResponseOutcome> {
  const strategy = input.strategyLabel.trim();
  const agent = resolveResponseAgentForStrategy(input.projectId, strategy);
  if (!agent) {
    return {
      ok: false,
      error: `No response agent found for “${strategy}”. Under Response agents, create an agent whose strategy name matches this label and link a knowledge folder.`,
    };
  }

  const folder = useKnowledgeFoldersStore
    .getState()
    .folders.find((f) => f.id === agent.knowledgeFolderId);
  const knowledgeId = folder?.knowledgeId?.trim() || "";
  if (!knowledgeId) {
    return {
      ok: false,
      error: `Response agent “${strategy}” has no knowledge id on its folder. Re-sync knowledge folders or re-save the folder on the server.`,
    };
  }

  const description = input.defectDescription.trim();
  const category = (input.defectCategory ?? "").trim();
  const claim =
    description ||
    category ||
    "Generate a contractor defect response for this item.";

  const query = buildAgentTestQuery({
    defectClaim: claim,
    strategy: agent.name,
    prompt: agent.prompt,
  });

  return generateDefectResponse({
    query,
    knowledgeId,
    messages: [query],
    strategyLabel: agent.name,
    defectCategory: category,
  });
}

/** Response agent test panel. */
export async function generateDefectResponseForAgentTest(input: {
  defectClaim: string;
  knowledgeId: string;
  strategy: string;
  prompt: string;
}): Promise<GenerateDefectResponseOutcome> {
  const query = buildAgentTestQuery({
    defectClaim: input.defectClaim,
    strategy: input.strategy,
    prompt: input.prompt,
  });
  return generateDefectResponse({
    query,
    knowledgeId: input.knowledgeId,
    messages: [query],
  });
}
