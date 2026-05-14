"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const KNOWLEDGE_FOLDERS_STORAGE_KEY = "pcdi-knowledge-folders-v2";

export type KnowledgeDocumentStatus = "uploading" | "parsing" | "active" | "error";

export type KnowledgeDocument = {
  id: string;
  folderId: string;
  fileName: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  addedAt: number;
  source: "pdf" | "sharepoint";
  /** SharePoint link when source is sharepoint */
  remoteUrl?: string;
};

export type KnowledgeFolder = {
  id: string;
  /** Billie defect project id — folders are scoped per live project. */
  projectId: string;
  name: string;
  createdAt: number;
};

type KnowledgeFoldersState = {
  folders: KnowledgeFolder[];
  documents: KnowledgeDocument[];
  addFolder: (name: string, projectId: string) => string;
  removeFolder: (id: string) => void;
  /** Validates size elsewhere; simulates upload → parse → active */
  addPdfDocument: (folderId: string, fileName: string, sizeBytes: number) => void;
  /** Mock integration: queued doc goes parsing → active */
  connectSharePointFolder: (folderId: string, folderUrl: string, label?: string) => void;
};

function scheduleStatus(docId: string, status: KnowledgeDocumentStatus, delayMs: number) {
  window.setTimeout(() => {
    useKnowledgeFoldersStore.setState((s) => ({
      documents: s.documents.map((d) => (d.id === docId ? { ...d, status } : d)),
    }));
  }, delayMs);
}

export const useKnowledgeFoldersStore = create<KnowledgeFoldersState>()(
    persist(
    (set) => ({
      folders: [],
      documents: [],

      addFolder: (name, projectId) => {
        const trimmed = name.trim();
        const pid = projectId.trim();
        if (!trimmed || !pid) return "";
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `fld_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        set((s) => ({
          folders: [...s.folders, { id, projectId: pid, name: trimmed, createdAt: Date.now() }],
        }));
        return id;
      },

      removeFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          documents: s.documents.filter((d) => d.folderId !== id),
        })),

      addPdfDocument: (folderId, fileName, sizeBytes) => {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const doc: KnowledgeDocument = {
          id,
          folderId,
          fileName,
          sizeBytes,
          status: "uploading",
          addedAt: Date.now(),
          source: "pdf",
        };
        set((s) => ({ documents: [...s.documents, doc] }));
        scheduleStatus(id, "parsing", 400);
        scheduleStatus(id, "active", 1600);
      },

      connectSharePointFolder: (folderId, folderUrl, label) => {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `sp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const fileName = label?.trim() || "SharePoint folder";
        const doc: KnowledgeDocument = {
          id,
          folderId,
          fileName,
          sizeBytes: 0,
          status: "parsing",
          addedAt: Date.now(),
          source: "sharepoint",
          remoteUrl: folderUrl.trim(),
        };
        set((s) => ({ documents: [...s.documents, doc] }));
        scheduleStatus(id, "active", 1200);
      },
    }),
    {
      name: KNOWLEDGE_FOLDERS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ folders: s.folders, documents: s.documents }),
    },
  ),
);

export const PDF_MAX_BYTES = 25 * 1024 * 1024;

export function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(k)));
  return `${(n / k ** i).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`;
}
