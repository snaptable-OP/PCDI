"use client";

import { FolderPlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import {
  formatBytes,
  PDF_MAX_BYTES,
  type KnowledgeDocument,
  type KnowledgeFolder,
  useKnowledgeFoldersStore,
} from "@/lib/pcdi/knowledge-folders-store";

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
        {status === "uploading" ? "Uploading" : "Parsing"}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-800 dark:text-red-200">
      Error
    </span>
  );
}

export function KnowledgeFoldersView() {
  const folders = useKnowledgeFoldersStore((s) => s.folders);
  const documents = useKnowledgeFoldersStore((s) => s.documents);
  const addFolder = useKnowledgeFoldersStore((s) => s.addFolder);
  const removeFolder = useKnowledgeFoldersStore((s) => s.removeFolder);
  const addPdfDocument = useKnowledgeFoldersStore((s) => s.addPdfDocument);
  const connectSharePointFolder = useKnowledgeFoldersStore((s) => s.connectSharePointFolder);

  const [newName, setNewName] = useState("");
  const [shareTarget, setShareTarget] = useState<KnowledgeFolder | null>(null);
  const [spUrl, setSpUrl] = useState("");
  const [spLabel, setSpLabel] = useState("");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const docsByFolder = (folderId: string) => documents.filter((d) => d.folderId === folderId);

  const onCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const id = addFolder(newName);
    if (id) setNewName("");
  };

  const onPickPdf = (folder: KnowledgeFolder, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      window.alert("Please choose a PDF file.");
      return;
    }
    if (file.size > PDF_MAX_BYTES) {
      window.alert(`PDF must be at most ${formatBytes(PDF_MAX_BYTES)} (this file is ${formatBytes(file.size)}).`);
      return;
    }
    addPdfDocument(folder.id, file.name, file.size);
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

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Knowledge folders</h1>
        <p className="mt-2 max-w-prose text-sm text-foreground-muted">
          Create folders, upload PDFs (max {formatBytes(PDF_MAX_BYTES)}), or connect a SharePoint folder. Documents show{" "}
          <strong className="text-foreground">Active</strong> when indexing has finished (simulated in this UI).
        </p>
      </header>

      <form onSubmit={onCreateFolder} className="mb-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="new-folder-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground-muted">
            New folder
          </label>
          <input
            id="new-folder-name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Façade defects — supplier briefs"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-accent/0 transition focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover active:bg-accent-active"
        >
          <FolderPlus className="h-4 w-4" aria-hidden />
          Create folder
        </button>
      </form>

      {folders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-foreground-muted">
          No folders yet. Create one to attach PDFs or SharePoint sources.
        </p>
      ) : (
        <ul className="space-y-6">
          {folders.map((folder) => (
            <li key={folder.id} className="rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">{folder.name}</h2>
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
                    accept="application/pdf"
                    className="sr-only"
                    aria-label={`Upload PDF to ${folder.name}`}
                    onChange={(e) => onPickPdf(folder, e)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRefs.current[folder.id]?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-muted/80"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden />
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
                    onClick={() => {
                      if (window.confirm(`Delete folder “${folder.name}” and its documents?`)) removeFolder(folder.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg p-2 text-foreground-muted transition hover:bg-red-500/10 hover:text-red-700"
                    aria-label="Delete folder"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-border-subtle px-4 py-2">
                {docsByFolder(folder.id).length === 0 ? (
                  <li className="py-4 text-sm text-foreground-muted">No documents yet.</li>
                ) : (
                  docsByFolder(folder.id).map((doc) => (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{doc.fileName}</p>
                        <p className="mt-0.5 text-[11px] text-foreground-muted">
                          {doc.source === "pdf" ? `PDF · ${formatBytes(doc.sizeBytes)}` : "SharePoint"}
                          {doc.remoteUrl ? ` · ${doc.remoteUrl}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={doc.status} />
                    </li>
                  ))
                )}
              </ul>
            </li>
          ))}
        </ul>
      )}

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
              Paste a folder URL from SharePoint. This prototype simulates sync and parsing only.
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
