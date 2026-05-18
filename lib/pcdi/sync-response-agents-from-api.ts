import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import {
  useResponseAgentsStore,
  type ResponseStrategyAgent,
} from "@/lib/pcdi/response-agents-store";
import { syncKnowledgeFoldersFromApi } from "@/lib/pcdi/sync-knowledge-folders-from-api";

const SYNC_TIMEOUT_MS = 18_000;

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (typeof e === "object" &&
      e !== null &&
      "name" in e &&
      (e as { name?: string }).name === "AbortError")
  );
}

async function fetchAgentsForFolder(
  projectId: string,
  folderId: string,
  signal?: AbortSignal,
): Promise<ResponseStrategyAgent[]> {
  const res = await fetch(
    `/api/defect-agents/by-knowledge-project/${encodeURIComponent(folderId)}?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store", signal },
  );
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    agents?: ResponseStrategyAgent[];
  };
  if (!res.ok) {
    throw new Error(body.error ?? "Could not load agents for a knowledge folder.");
  }
  return Array.isArray(body.agents) ? body.agents : [];
}

/**
 * Loads all response agents for a project (one request per knowledge folder).
 */
export async function syncResponseAgentsFromApi(
  projectId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const pid = projectId.trim();
  if (!pid) return { ok: false, error: "Project id is required." };

  const controller = signal ? null : new AbortController();
  const timeoutId =
    controller !== null
      ? window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
      : undefined;
  const sig = signal ?? controller!.signal;

  try {
    let folders = useKnowledgeFoldersStore
      .getState()
      .folders.filter((f) => f.projectId === pid);
    if (folders.length === 0) {
      const folderSync = await syncKnowledgeFoldersFromApi(pid, sig);
      if (!folderSync.ok) {
        return { ok: false, error: folderSync.error };
      }
      folders = useKnowledgeFoldersStore
        .getState()
        .folders.filter((f) => f.projectId === pid);
    }

    const batches = await Promise.all(
      folders.map((f) => fetchAgentsForFolder(pid, f.id, sig)),
    );
    const agents = batches.flat();
    useResponseAgentsStore.getState().replaceAgentsForProject(pid, agents);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: isAbortError(e)
        ? "Timed out waiting for the analysis server."
        : e instanceof Error
          ? e.message
          : "Could not load response agents from the analysis server.",
    };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export async function createResponseAgentOnApi(input: {
  projectId: string;
  knowledgeFolderId: string;
  userChosenResponseStrategy: string;
  prompt: string;
}): Promise<{ ok: boolean; agent?: ResponseStrategyAgent; error?: string }> {
  const projectId = input.projectId.trim();
  const knowledgeFolderId = input.knowledgeFolderId.trim();
  const userChosenResponseStrategy = input.userChosenResponseStrategy.trim();
  const prompt = input.prompt.trim();
  if (!projectId || !knowledgeFolderId || !userChosenResponseStrategy || !prompt) {
    return { ok: false, error: "Strategy, prompt, and knowledge folder are required." };
  }

  const res = await fetch("/api/defect-agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      defectKnowledgeProjectId: knowledgeFolderId,
      userChosenResponseStrategy,
      prompt,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    agent?: ResponseStrategyAgent;
    id?: string;
  };

  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not save response agent." };
  }

  if (body.agent) {
    useResponseAgentsStore.getState().upsertAgent(body.agent);
    return { ok: true, agent: body.agent };
  }

  await syncResponseAgentsFromApi(projectId);
  return { ok: true };
}

export async function updateResponseAgentOnApi(
  agent: ResponseStrategyAgent,
  updates: {
    name?: string;
    prompt?: string;
    knowledgeFolderId?: string;
  },
): Promise<{ ok: boolean; agent?: ResponseStrategyAgent; error?: string }> {
  const strategy = (updates.name ?? agent.name).trim();
  const prompt = (updates.prompt ?? agent.prompt).trim();
  const folderId = (updates.knowledgeFolderId ?? agent.knowledgeFolderId).trim();
  if (!strategy || !prompt || !folderId) {
    return { ok: false, error: "Strategy, prompt, and knowledge folder are required." };
  }

  const folderChanged = folderId !== agent.knowledgeFolderId;

  if (folderChanged) {
    const created = await createResponseAgentOnApi({
      projectId: agent.projectId,
      knowledgeFolderId: folderId,
      userChosenResponseStrategy: strategy,
      prompt,
    });
    if (!created.ok) return created;
    const deleted = await deleteResponseAgentOnApi(agent.id);
    if (!deleted.ok) return deleted;
    return created;
  }

  const res = await fetch(`/api/defect-agents/${encodeURIComponent(agent.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: agent.projectId,
      defectKnowledgeProjectId: folderId,
      userChosenResponseStrategy: strategy,
      prompt,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    agent?: ResponseStrategyAgent;
  };

  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not update response agent." };
  }

  if (body.agent) {
    useResponseAgentsStore.getState().upsertAgent(body.agent);
    return { ok: true, agent: body.agent };
  }

  const next: ResponseStrategyAgent = {
    ...agent,
    name: strategy,
    prompt,
    knowledgeFolderId: folderId,
    updatedAt: Date.now(),
  };
  useResponseAgentsStore.getState().upsertAgent(next);
  return { ok: true, agent: next };
}

export async function deleteResponseAgentOnApi(
  agentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = agentId.trim();
  if (!id) return { ok: false, error: "Agent id is required." };

  const res = await fetch(`/api/defect-agents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not delete response agent." };
  }

  useResponseAgentsStore.getState().removeAgentLocal(id);
  return { ok: true };
}
