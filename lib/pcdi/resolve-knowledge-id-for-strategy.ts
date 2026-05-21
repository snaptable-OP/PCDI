import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import {
  useResponseAgentsStore,
  type ResponseStrategyAgent,
} from "@/lib/pcdi/response-agents-store";

function normalizeStrategyLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Finds the response agent for a strategy label on this project (exact match, then case-insensitive).
 * When multiple agents share the same strategy label, the first match wins.
 */
export function resolveResponseAgentForStrategy(
  projectId: string,
  strategyLabel: string,
): ResponseStrategyAgent | null {
  const pid = projectId.trim();
  const strategy = strategyLabel.trim();
  if (!pid || !strategy) return null;

  const agents = useResponseAgentsStore
    .getState()
    .agents.filter((a) => a.projectId === pid);

  const exact = agents.find((a) => a.name.trim() === strategy);
  if (exact) return exact;

  const norm = normalizeStrategyLabel(strategy);
  return agents.find((a) => normalizeStrategyLabel(a.name) === norm) ?? null;
}

/**
 * Finds the knowledge folder `knowledgeId` for a response strategy agent on this project.
 */
export function resolveKnowledgeIdForStrategy(
  projectId: string,
  strategyLabel: string,
): string | null {
  const agent = resolveResponseAgentForStrategy(projectId, strategyLabel);
  if (!agent) return null;

  const folder = useKnowledgeFoldersStore
    .getState()
    .folders.find((f) => f.id === agent.knowledgeFolderId);
  return folder?.knowledgeId?.trim() || null;
}
