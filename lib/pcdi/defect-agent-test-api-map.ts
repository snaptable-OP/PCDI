import { unwrapBillieEnvelope } from "@/lib/pcdi/defect-agent-api-map";

export type AgentTestReference = {
  fileName: string;
  pageNo?: number;
  excerpt: string;
  score?: number;
};

export type AgentTestResult = {
  answer: string;
  references: AgentTestReference[];
  sessionId?: string;
};

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function mapReference(row: unknown): AgentTestReference | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const excerpt = asString(r.context) ?? "";
  const fileName =
    asString(r.display_name) ?? asString(r.file_name) ?? asString(r.fileName) ?? "Reference";
  if (!excerpt && !fileName) return null;
  const pageNo = typeof r.page_no === "number" ? r.page_no : undefined;
  const score = typeof r.score === "number" ? r.score : undefined;
  return { fileName, pageNo, excerpt, score };
}

/** Unwrap Billie `AskAgentResponse` from `{ result }` / `{ data }` envelopes. */
export function extractAgentTestResult(data: unknown): AgentTestResult | null {
  const unwrapped = unwrapBillieEnvelope(data);
  if (!unwrapped || typeof unwrapped !== "object") return null;
  const o = unwrapped as Record<string, unknown>;
  const answer = asString(o.answer) ?? "";
  const contextList = Array.isArray(o.context_list) ? o.context_list : [];
  const references = contextList
    .map((row) => mapReference(row))
    .filter((x): x is AgentTestReference => x != null);
  const sessionId = asString(o.sessionId) ?? undefined;
  if (!answer && references.length === 0) return null;
  return { answer, references, sessionId };
}

export function buildAgentTestQuery(input: {
  defectClaim: string;
  strategy: string;
  prompt: string;
}): string {
  const claim = input.defectClaim.trim();
  const strategy = input.strategy.trim();
  const prompt = input.prompt.trim();
  return [
    "Draft a contractor defect response for the claim below.",
    strategy ? `Response strategy: ${strategy}` : "",
    "",
    "Agent instructions:",
    prompt || "(none)",
    "",
    "Defect claim:",
    claim,
  ]
    .filter((line, i, arr) => line !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n");
}
