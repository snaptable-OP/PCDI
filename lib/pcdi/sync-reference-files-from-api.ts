import {
  ANALYSIS_MAX_WAIT_MS,
  ANALYSIS_POLL_INTERVAL_MS,
  analysisPollMaxAttempts,
} from "@/lib/pcdi/analysis-timeouts";
import type { KnowledgeDocument } from "@/lib/pcdi/knowledge-folders-store";
import { useKnowledgeFoldersStore } from "@/lib/pcdi/knowledge-folders-store";
import {
  saveReferenceFileToFolder,
  uploadReferencePdfToStorage,
} from "@/lib/pcdi/reference-file-client-upload";

const INDEX_POLL_INTERVAL_MS = ANALYSIS_POLL_INTERVAL_MS;
const INDEX_POLL_MAX_ATTEMPTS = analysisPollMaxAttempts(ANALYSIS_MAX_WAIT_MS, INDEX_POLL_INTERVAL_MS);

function isMemoryIndexingReady(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === "ready" || s === "success" || s === "indexed" || s === "complete";
}

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
    await reconcileReferenceFileIndexingStatuses(fid, signal);
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

async function checkReferenceFileMemoryReady(
  referenceFileId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; ready: boolean; error?: string }> {
  const id = referenceFileId.trim();
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
  const status = body.memory?.status ?? "";
  return { ok: true, ready: isMemoryIndexingReady(status) };
}

async function pollReferenceFileIndexing(
  referenceFileId: string,
  signal?: AbortSignal,
): Promise<{ ok: boolean; ready: boolean; error?: string }> {
  const id = referenceFileId.trim();
  for (let attempt = 0; attempt < INDEX_POLL_MAX_ATTEMPTS; attempt++) {
    const check = await checkReferenceFileMemoryReady(id, signal);
    if (!check.ok) return check;
    if (check.ready) return { ok: true, ready: true };
    await sleep(INDEX_POLL_INTERVAL_MS, signal);
  }
  return {
    ok: true,
    ready: false,
    error: "Indexing is still in progress. Use Refresh on this page to update status.",
  };
}

/** Updates PDF rows stuck on Indexing when check-memory is already ready (e.g. after refresh). */
export async function reconcileReferenceFileIndexingStatuses(
  folderId: string,
  signal?: AbortSignal,
): Promise<void> {
  const fid = folderId.trim();
  if (!fid) return;

  const pending = useKnowledgeFoldersStore
    .getState()
    .documents.filter(
      (d) =>
        d.folderId === fid &&
        d.source === "pdf" &&
        (d.status === "parsing" || d.status === "uploading"),
    );

  for (const doc of pending) {
    const refId = (doc.referenceFileId ?? doc.id).trim();
    if (!refId || refId.startsWith("pending_")) continue;
    const check = await checkReferenceFileMemoryReady(refId, signal);
    if (check.ok && check.ready) {
      useKnowledgeFoldersStore.getState().upsertDocument({ ...doc, status: "active" });
    }
  }
}

function markReferenceFileActiveInStore(referenceFileId: string, folderId: string): KnowledgeDocument | null {
  const id = referenceFileId.trim();
  const store = useKnowledgeFoldersStore.getState();
  const doc = store.documents.find((d) => d.id === id || d.referenceFileId === id);
  if (!doc) return null;
  const active: KnowledgeDocument = { ...doc, folderId, status: "active" };
  store.upsertDocument(active);
  return active;
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
    const stored = await uploadReferencePdfToStorage(file, signal);
    if (!stored.ok) {
      useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
      const step = stored.step ? ` (${stored.step})` : "";
      return { ok: false, error: `${stored.error}${step}` };
    }

    const registered = await saveReferenceFileToFolder(folderId, file, stored.fileUrl, signal);
    if (!registered.ok) {
      useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
      return { ok: false, error: `${registered.error} (${registered.step})` };
    }

    setDocStatus(placeholderId, { status: "parsing" });

    const saved = registered.document ?? registered.documents[0];
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

    if (poll.ready) {
      const active =
        markReferenceFileActiveInStore(saved.id, folderId) ??
        ({ ...saved, status: "active" as const });
      return { ok: true, document: active };
    }

    const latest =
      useKnowledgeFoldersStore.getState().documents.find((d) => d.id === saved.id) ?? {
        ...saved,
        status: "parsing" as const,
      };
    return {
      ok: true,
      document: latest,
      error: poll.error,
    };
  } catch (e) {
    useKnowledgeFoldersStore.getState().removeDocumentLocal(placeholderId);
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "Upload cancelled." };
    }
    const msg = e instanceof Error ? e.message : "Upload failed.";
    const friendly =
      msg === "Failed to fetch" || msg.includes("NetworkError")
        ? "Could not reach the app or storage. For large PDFs the browser uploads directly to S3 — check network, Vercel env (BILLIE_API_BASE), and S3 CORS on the reference-file bucket."
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
