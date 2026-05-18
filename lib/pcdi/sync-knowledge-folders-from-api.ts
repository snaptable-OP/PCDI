import { useKnowledgeFoldersStore, type KnowledgeFolder } from "@/lib/pcdi/knowledge-folders-store";

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

/**
 * Loads Knowledge Folders for a project from GET /api/defect-knowledge-projects/by-project/{projectId}.
 */
export async function syncKnowledgeFoldersFromApi(
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
    const res = await fetch(
      `/api/defect-knowledge-projects/by-project/${encodeURIComponent(pid)}`,
      { cache: "no-store", signal: sig },
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      folders?: KnowledgeFolder[];
    };
    if (!res.ok) {
      return {
        ok: false,
        error: body.error ?? "Could not load knowledge folders from the analysis server.",
      };
    }
    const list = Array.isArray(body.folders) ? body.folders : [];
    useKnowledgeFoldersStore.getState().replaceFoldersForProject(pid, list);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: isAbortError(e)
        ? "Timed out waiting for the analysis server."
        : "Could not load knowledge folders from the analysis server.",
    };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}

export async function createKnowledgeFolderOnApi(input: {
  projectId: string;
  displayName: string;
  description?: string;
}): Promise<{ ok: boolean; folder?: KnowledgeFolder; error?: string }> {
  const projectId = input.projectId.trim();
  const displayName = input.displayName.trim();
  if (!projectId || !displayName) {
    return { ok: false, error: "Project and folder name are required." };
  }

  const knowledgeId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `kn_${Date.now()}`;

  const res = await fetch("/api/defect-knowledge-projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      knowledgeId,
      projectId,
      displayName,
      description: input.description?.trim() || null,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    folder?: KnowledgeFolder;
    id?: string;
  };

  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not create knowledge folder." };
  }

  if (body.folder) {
    useKnowledgeFoldersStore.getState().upsertFolder(body.folder);
    return { ok: true, folder: body.folder };
  }

  await syncKnowledgeFoldersFromApi(projectId);
  const folder = useKnowledgeFoldersStore
    .getState()
    .folders.find((f) => f.projectId === projectId && f.name === displayName);
  return folder ? { ok: true, folder } : { ok: true };
}

export async function deleteKnowledgeFolderOnApi(
  folderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = folderId.trim();
  if (!id) return { ok: false, error: "Folder id is required." };

  const res = await fetch(`/api/defect-knowledge-projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not delete knowledge folder." };
  }

  useKnowledgeFoldersStore.getState().removeFolderLocal(id);
  return { ok: true };
}

export async function updateKnowledgeFolderOnApi(
  folderId: string,
  patch: { displayName?: string; description?: string | null; status?: string | null },
): Promise<{ ok: boolean; folder?: KnowledgeFolder; error?: string }> {
  const id = folderId.trim();
  if (!id) return { ok: false, error: "Folder id is required." };

  const res = await fetch(`/api/defect-knowledge-projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    folder?: KnowledgeFolder;
  };
  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not update knowledge folder." };
  }
  if (body.folder) {
    useKnowledgeFoldersStore.getState().upsertFolder(body.folder);
    return { ok: true, folder: body.folder };
  }
  return { ok: true };
}
