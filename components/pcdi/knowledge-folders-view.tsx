"use client";

import { FolderPlus, Link2, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  formatBytes,
  PDF_MAX_BYTES,
  type KnowledgeDocument,
  type KnowledgeFolder,
  useKnowledgeFoldersStore,
} from "@/lib/pcdi/knowledge-folders-store";
import { useLiveSelectedProjectStore } from "@/lib/pcdi/live-selected-project-store";
import {
  createKnowledgeFolderOnApi,
  deleteKnowledgeFolderOnApi,
} from "@/lib/pcdi/sync-knowledge-folders-from-api";
import {
  deleteReferenceFileOnApi,
  uploadReferenceFileToFolder,
} from "@/lib/pcdi/sync-reference-files-from-api";
import { useKnowledgeFoldersSync } from "@/lib/pcdi/use-knowledge-folders-sync";

function StatusBadge({ status }: { status: KnowledgeDocument["status"] }) {
  if (status === "active") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        Active
      </span>
    );
  }
  if (status === "parsing" || status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {status === "uploading" ? "Uploading" : "Indexing"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
      Error
    </span>
  );
}

function FolderStatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === "SUCCESS") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        Ready
      </span>
    );
  }
  if (s === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Processing
      </span>
    );
  }
  if (s === "FAIL") {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
        Failed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-foreground-muted">
      {status}
    </span>
  );
}

export function KnowledgeFoldersView() {
  const projectId = useLiveSelectedProjectStore((s) => s.selectedProjectId);
  const { loading, error, refresh } = useKnowledgeFoldersSync(projectId);
  const foldersAll = useKnowledgeFoldersStore((s) => s.folders);
  const folders = useMemo(() => foldersAll.filter((f) => projectId && f.projectId === projectId), [
    foldersAll,
    projectId,
  ]);
  const documents = useKnowledgeFoldersStore((s) => s.documents);
  const connectSharePointFolder = useKnowledgeFoldersStore((s) => s.connectSharePointFolder);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<KnowledgeFolder | null>(null);
  const [spUrl, setSpUrl] = useState("");
  const [spLabel, setSpLabel] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const docsByFolder = (folderId: string) => documents.filter((d) => d.folderId === folderId);

  const onCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setActionError(null);
    const result = await createKnowledgeFolderOnApi({ projectId, displayName: name });
    setCreating(false);
    if (!result.ok) {
      setActionError(result.error ?? "Could not create folder.");
      return;
    }
    setNewName("");
  };

  const onDeleteFolder = async (folder: KnowledgeFolder) => {
    if (
      !window.confirm(
        `Delete folder “${folder.name}” on the server? Reference files in this folder will also be removed.`,
      )
    ) {
      return;
    }
    setDeletingId(folder.id);
    setActionError(null);
    const result = await deleteKnowledgeFolderOnApi(folder.id);
    setDeletingId(null);
    if (!result.ok) {
      setActionError(result.error ?? "Could not delete folder.");
    }
  };

  const onPickPdf = async (folder: KnowledgeFolder, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      window.alert("Please choose a PDF file.");
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      window.alert(`PDF must be at most ${formatBytes(PDF_MAX_BYTES)} (this file is ${formatBytes(file.size)}).`);
      return;
    }

    setUploadingFolderId(folder.id);
    setActionError(null);
    const result = await uploadReferenceFileToFolder(folder.id, file);
    setUploadingFolderId(null);
    if (!result.ok) {
      setActionError(result.error ?? "Upload failed.");
      return;
    }
    if (result.error) {
      setActionError(result.error);
    }
  };

  const onDeleteDocument = async (doc: KnowledgeDocument) => {
    if (doc.source === "sharepoint" || doc.id.startsWith("pending_") || doc.id.startsWith("sp_")) {
      useKnowledgeFoldersStore.getState().removeDocumentLocal(doc.id);
      return;
    }
    if (!window.confirm(`Remove “${doc.fileName}” from this folder?`)) return;
    setDeletingDocId(doc.id);
    setActionError(null);
    const result = await deleteReferenceFileOnApi(doc.id, doc.folderId);
    setDeletingDocId(null);
    if (!result.ok) {
      setActionError(result.error ?? "Could not delete file.");
    }
  };

  const closeShareModal = () => {
    setShareTarget(null);
    setSpUrl("");
    setSpLabel("");
  };

  const submitSharePoint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTarget) return;
    const url = spUrl.trim();
    if (!url) return;
    connectSharePointFolder(shareTarget.id, url, spLabel.trim() || undefined);
    closeShareModal();
  };

  const displayError = actionError ?? error;

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <header className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Knowledge folders</h1>
            <p className="mt-2 max-w-prose text-sm text-foreground-muted">
              Folders and PDFs are stored on the analysis server. Uploads go to the{" "}
              <strong className="font-medium text-foreground">billie-defect-reference-file</strong> bucket, then
              are indexed for agents. Max PDF size {formatBytes(PDF_MAX_BYTES)}.
            </p>
          </div>
          {projectId ? (
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </button>
          ) : null}
        </div>
        {displayError ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-200">
            {displayError}
          </p>
        ) : null}
      </header>

      {!projectId ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
          Choose a project from the sidebar selector to manage folders for that project.
        </p>
      ) : null}

      {projectId ? (
        <>
          <form
            onSubmit={onCreateFolder}
            className="mb-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="new-folder-name"
                className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted"
              >
                New folder
              </label>
              <input
                id="new-folder-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Façade defects — supplier briefs"
                disabled={creating}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-accent/0 transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover active:bg-accent-active disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FolderPlus className="h-4 w-4" aria-hidden />}
              Create folder
            </button>
          </form>

          {loading && folders.length === 0 ? (
            <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-sm text-foreground-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading folders…
            </p>
          ) : folders.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
              No folders yet. Create one to attach PDFs or SharePoint sources.
            </p>
          ) : (
            <ul className="space-y-6">
              {folders.map((folder) => {
                const folderUploading = uploadingFolderId === folder.id;
                return (
                  <li key={folder.id} className="rounded-xl border border-border bg-surface shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-foreground">{folder.name}</h2>
                          <FolderStatusBadge status={folder.status} />
                        </div>
                        {folder.description ? (
                          <p className="mt-1 text-sm text-foreground-muted">{folder.description}</p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          Created {new Date(folder.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          ref={(el) => {
                            fileRefs.current[folder.id] = el;
                          }}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          aria-label={`Upload PDF to ${folder.name}`}
                          onChange={(e) => void onPickPdf(folder, e)}
                          disabled={folderUploading}
                        />
                        <button
                          type="button"
                          onClick={() => fileRefs.current[folder.id]?.click()}
                          disabled={folderUploading}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80 disabled:opacity-50"
                        >
                          {folderUploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Upload className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Upload PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareTarget(folder)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80"
                        >
                          <Link2 className="h-3.5 w-3.5" aria-hidden />
                          SharePoint
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDeleteFolder(folder)}
                          disabled={deletingId === folder.id}
                          className="inline-flex items-center gap-1 rounded-lg p-2 text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700 disabled:opacity-50"
                          aria-label="Delete folder"
                        >
                          {deletingId === folder.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <ul className="divide-y divide-border-subtle px-4 py-2">
                      {docsByFolder(folder.id).length === 0 ? (
                        <li className="py-4 text-sm text-foreground-muted">No documents yet.</li>
                      ) : (
                        docsByFolder(folder.id).map((doc) => (
                          <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{doc.fileName}</p>
                              <p className="mt-0.5 text-[11px] text-foreground-muted">
                                {doc.source === "pdf" ? `PDF · ${formatBytes(doc.sizeBytes)}` : "SharePoint"}
                                {doc.remoteUrl ? ` · ${doc.remoteUrl}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <StatusBadge status={doc.status} />
                              {doc.source === "pdf" && !doc.id.startsWith("pending_") ? (
                                <button
                                  type="button"
                                  onClick={() => void onDeleteDocument(doc)}
                                  disabled={deletingDocId === doc.id}
                                  className="rounded-lg p-1.5 text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700 disabled:opacity-50"
                                  aria-label={`Delete ${doc.fileName}`}
                                >
                                  {deletingDocId === doc.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          </li>
                        ))
                      )}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}

      {shareTarget ? (
        <div
          className="fixed inset-0 z-[240] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[1px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sp-dialog-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <h2 id="sp-dialog-title" className="text-lg font-semibold text-foreground">
              Connect SharePoint folder
            </h2>
            <p className="mt-1 text-sm text-foreground-muted">
              Paste a folder URL from SharePoint. This is a local placeholder only — not saved to the reference-file
              API yet.
            </p>
            <form onSubmit={submitSharePoint} className="mt-4 space-y-3">
              <div>
                <label htmlFor="sp-url" className="mb-1 block text-xs font-medium text-foreground-muted">
                  Folder URL
                </label>
                <input
                  id="sp-url"
                  value={spUrl}
                  onChange={(e) => setSpUrl(e.target.value)}
                  placeholder="https://tenant.sharepoint.com/sites/..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="sp-label" className="mb-1 block text-xs font-medium text-foreground-muted">
                  Display label (optional)
                </label>
                <input
                  id="sp-label"
                  value={spLabel}
                  onChange={(e) => setSpLabel(e.target.value)}
                  placeholder="Design team — issued drawings"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeShareModal}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!spUrl.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
                >
                  Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
