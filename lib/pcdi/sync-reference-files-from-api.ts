import type { KnowledgeDocument } from "@/lib/pcdi/knowledge-folders-store";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";

const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 90;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export async function syncReferenceFilesForFolder(
  folderId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  const fid = folderId.trim();
  if (!fid) return { ok: false, error: "Folder id is required." };

  try {
    const res = await fetch(
      `/api/defect-reference-files/by-knowledge-project/${encodeURIComponent(fid)}`,
      { cache: "no-store", signal },
    );
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      documents?: KnowledgeDocument[];
    };
    if (!res.ok) {
      return { ok: false, error: body.error ?? "Could not load reference files." };
    }
    const list = Array.isArray(body.documents) ? body.documents : [];
    useKnowledgeFoldersStore.getState().replaceDocumentsForFolder(fid, list);
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "Request cancelled." };
    }
    return { ok: false, error: "Could not load reference files from the analysis server." };
  }
}

export async function syncReferenceFilesForProject(
  projectId: string,
  folderIds: string[],
  signal?: AbortSignal,
): Promise<{ ok: boolean; error?: string }> {
  if (folderIds.length === 0) {
    useKnowledgeFoldersStore.getState().replaceDocumentsForProject(projectId, []);
    return { ok: true };
  }

  const results = await Promise.all(
    folderIds.map((id) => syncReferenceFilesForFolder(id, signal)),
  );
  const failed = results.find((r) => !r.ok);
  return failed ?? { ok: true };
}

async function pollReferenceFileIndexing(
  referenceFileId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; ready: boolean; error?: string }> {
  const id = referenceFileId.trim();
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS, signal);
    const res = await fetch(`/api/defect-reference-files/${encodeURIComponent(id)}/check-memory`, {
      cache: "no-store",
      signal,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      memory?: { status?: string };
    };
    if (!res.ok) {
      return { ok: false, ready: false, error: body.error ?? "Indexing status check failed." };
    }
    const status = (body.memory?.status ?? "").toLowerCase();
    if (status === "ready") {
      return { ok: true, ready: true };
    }
  }
  return { ok: true, ready: false, error: "Indexing is still in progress. Try refreshing later." };
}

/**
 * Recommended flow: presigned URL → PUT to S3 → save → poll check-memory.
 * Target bucket on Billie: billie-defect-reference-file.
 */
export async function uploadReferenceFileToFolder(
  knowledgeFolderId: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ ok: boolean; document?: KnowledgeDocument; error?: string }> {
  const folderId = knowledgeFolderId.trim();
  if (!folderId) return { ok: false, error: "Folder id is required." };

  const placeholderId = `pending_${Date.now()}`;
  const placeholder: KnowledgeDocument = {
    id: placeholderId,
    folderId,
    fileName: file.name,
    sizeBytes: file.size,
    status: "uploading",
    addedAt: Date.now(),
    source: "pdf",
  };
  useKnowledgeFoldersStore.getState().upsertDocument(placeholder);

  const setDocStatus = (id: string, patch: Partial<KnowledgeDocument>) => {
    const store = useKnowledgeFoldersStore.getState();
    const doc = store.documents.find((d) => d.id === id);
    if (!doc) return;
    store.upsertDocument({ ...doc, ...patch });
  };

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("knowledgeFolderId", folderId);

    const uploadRes = await fetch("/api/defect-reference-files/upload", {
      method: "POST",
      body: form,
      signal,
    });
    const uploadBody = (await uploadRes.json().catch(() => ({}))) as {
      error?: string;
      step?: string;
      documents?: KnowledgeDocument[];
      document?: KnowledgeDocument;
    };

    if (!uploadRes.ok) {
      useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
      const step = uploadBody.step ? ` (${uploadBody.step})` : "";
      return {
        ok: false,
        error:
          uploadBody.error ??
          `Upload failed${step}. Ensure the dev server and analysis API are reachable.`,
      };
    }

    setDocStatus(placeholderId, { status: "parsing" });

    const saved = uploadBody.document ?? uploadBody.documents?.[0];
    if (!saved?.id) {
      useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
      return { ok: false, error: "Could not read reference file id after save." };
    }

    useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
    useKnowledgeFoldersStore.getState().upsertDocument({
      ...saved,
      status: "parsing",
      folderId,
    });

    const poll = await pollReferenceFileIndexing(saved.id, signal);
    await syncReferenceFilesForFolder(folderId, signal);

    const latest =
      useKnowledgeFoldersStore.getState().documents.find((d) => d.id === saved.id) ?? saved;

    if (!poll.ready) {
      return {
        ok: true,
        document: { ...latest, status: "parsing" },
        error: poll.error,
      };
    }

    return { ok: true, document: { ...latest, status: "active" } };
  } catch (e) {
    useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "Upload cancelled." };
    }
    const msg = e instanceof Error ? e.message : "Upload failed.";
    const friendly =
      msg === "Failed to fetch" || msg.includes("NetworkError")
        ? "Could not reach the app server. Check that `npm run dev` is running and you are on http://127.0.0.1:3333."
        : msg;
    return { ok: false, error: friendly };
  }
}

export async function deleteReferenceFileOnApi(
  referenceFileId: string,
  folderId: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = referenceFileId.trim();
  if (!id) return { ok: false, error: "File id is required." };

  const res = await fetch(`/api/defect-reference-files/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? "Could not delete reference file." };
  }

  useKnowledgeFoldersStore.getState().removeDocumentLocal(id);
  await syncReferenceFilesForFolder(folderId);
  return { ok: true };
}
