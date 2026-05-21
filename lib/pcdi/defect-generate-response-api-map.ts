import { unwrapBillieEnvelope } from "@/lib/pcdi/defect-agent-api-map";

export type GenerateResponseReference = {
  fileName: string;
  pageNo?: number;
  excerpt: string;
  score?: number;
};

export type GenerateResponseResult = {
  answer: string;
  references: GenerateResponseReference[];
};

export type GenerateResponseRequestBody = {
  query: string;
  knowledgeId: string;
  messages: string[];
};

export function buildGenerateResponseRequest(input: {
  query: string;
  knowledgeId: string;
  messages?: string[];
}): GenerateResponseRequestBody {
  const query = input.query.trim();
  return {
    query,
    knowledgeId: input.knowledgeId.trim(),
    messages: input.messages?.length ? input.messages.map((m) => m.trim()).filter(Boolean) : [query],
  };
}

function mapContextRow(row: unknown): GenerateResponseReference | null {
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

/** Parse `POST /api/defect-files/generate-response` (nested `result.result` or flat). */
export function extractGenerateResponseResult(data: unknown): GenerateResponseResult | null {
  let node: unknown = unwrapBillieEnvelope(data);

  for (let depth = 0; depth < 5; depth++) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return null;
    const o = node as Record<string, unknown>;

    const answer = typeof o.answer === "string" ? o.answer : "";
    const contextList = Array.isArray(o.context_list) ? o.context_list : [];
    if (answer.trim() || contextList.length > 0) {
      const references = contextList
        .map((row) => mapContextRow(row))
        .filter((x): x is GenerateResponseReference => x != null);
      if (!answer.trim() && references.length === 0) return null;
      return { answer, references };
    }

    const inner = o.result;
    if (inner != null && typeof inner === "object") {
      node = inner;
      continue;
    }
    break;
  }

  return null;
}
