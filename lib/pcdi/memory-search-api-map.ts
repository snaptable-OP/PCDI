import { unwrapBillieEnvelope } from "@/lib/pcdi/defect-agent-api-map";
import type { AgentTestReference, AgentTestResult } from "@/lib/pcdi/defect-agent-test-api-map";

export type MemorySearchFilter = {
  type: "knowledge" | "file" | "project";
  ids: string[];
};

export type MemorySearchRequest = {
  index: number;
  query: string;
  messages: string[];
  type: "GlobalKnowledgeQA" | "LocalKnowledgeQA";
  filter_conditions: MemorySearchFilter[];
};

/** Body for AI `POST /search/memory` (see memory_flow.md). */
export function buildMemorySearchRequest(input: {
  query: string;
  knowledgeId: string;
  projectId?: string;
  referenceFileIds?: string[];
}): MemorySearchRequest {
  const query = input.query.trim();
  const filters: MemorySearchFilter[] = [];

  if (input.referenceFileIds?.length) {
    filters.push({ type: "file", ids: input.referenceFileIds });
  } else if (input.knowledgeId.trim()) {
    filters.push({ type: "knowledge", ids: [input.knowledgeId.trim()] });
  }

  if (input.projectId?.trim()) {
    filters.push({ type: "project", ids: [input.projectId.trim()] });
  }

  return {
    index: 0,
    query,
    messages: [query],
    type: "GlobalKnowledgeQA",
    filter_conditions: filters,
  };
}

function mapContextRow(row: unknown): AgentTestReference | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const excerpt = typeof r.context === "string" ? r.context : "";
  const fileId = typeof r.file_id === "string" ? r.file_id : "";
  const fileName =
    (typeof r.display_name === "string" && r.display_name) ||
    (typeof r.file_name === "string" && r.file_name) ||
    (fileId ? `File ${fileId.slice(0, 8)}…` : "Reference");
  if (!excerpt && !fileName) return null;
  const pageNo = typeof r.page_no === "number" ? r.page_no : undefined;
  const score = typeof r.score === "number" ? r.score : undefined;
  return { fileName, pageNo, excerpt, score };
}

/** Parse `POST /search/memory` — `{ result: { answer, context_list } }` or Billie `{ code, data }` wrappers. */
export function extractMemorySearchResult(data: unknown): AgentTestResult | null {
  let payload = unwrapBillieEnvelope(data);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    if (o.result && typeof o.result === "object") {
      payload = o.result;
    }
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const o = payload as Record<string, unknown>;
  const answer = typeof o.answer === "string" ? o.answer : "";
  const contextList = Array.isArray(o.context_list) ? o.context_list : [];
  const references = contextList
    .map((row) => mapContextRow(row))
    .filter((x): x is AgentTestReference => x != null);
  if (!answer.trim() && references.length === 0) return null;
  return { answer, references };
}
