import type { GenerateResponseResult } from "@/lib/pcdi/defect-generate-response-api-map";
import { generateDefectResponseForAgentTest } from "@/lib/pcdi/generate-defect-response";

export type RunResponseAgentTestInput = {
  agentId: string;
  defectClaim: string;
  knowledgeFolderId: string;
  knowledgeId?: string;
  strategy: string;
  prompt: string;
};

export type RunResponseAgentTestOutcome =
  | { ok: true; mode: "api" | "mock"; result: GenerateResponseResult }
  | { ok: false; error: string };

export async function runResponseAgentTest(
  input: RunResponseAgentTestInput,
): Promise<RunResponseAgentTestOutcome> {
  const defectClaim = input.defectClaim.trim();
  if (!defectClaim) {
    return { ok: false, error: "Paste a defect claim before generating." };
  }

  const knowledgeId = (input.knowledgeId ?? input.knowledgeFolderId).trim();
  if (!knowledgeId) {
    return { ok: false, error: "Knowledge folder id is required." };
  }

  return generateDefectResponseForAgentTest({
    defectClaim,
    knowledgeId,
    strategy: input.strategy,
    prompt: input.prompt,
  });
}
