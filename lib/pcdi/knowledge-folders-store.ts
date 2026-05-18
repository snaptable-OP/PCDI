"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const KNOWLEDGE_FOLDERS_STORAGE_KEY = "pcdi-knowledge-folders-v4";

export type KnowledgeDocumentStatus = "uploading" | "parsing" | "active" | "error";

export type KnowledgeDocument = {
  /** Defect reference file id from API (or temporary client id while uploading). */
  id: string;
  folderId: string;
  fileName: string;
  sizeBytes: number;
  status: KnowledgeDocumentStatus;
  addedAt: number;
  source: "pdf" | "sharepoint";
  /** SharePoint link when source is sharepoint */
  remoteUrl?: string;
  sourceFileUrl?: string;
  referenceFileId?: string;
};

export type KnowledgeFolder = {
  id: string;
  projectId: string;
  knowledgeId: string;
  name: string;
  description?: string;
  status?: string;
  createdAt: number;
  updatedAt?: number;
};

type KnowledgeFoldersState = {
  folders: KnowledgeFolder[];
  documents: KnowledgeDocument[];
  replaceFoldersForProject: (projectId: string, folders: KnowledgeFolder[]) => void;
  upsertFolder: (folder: KnowledgeFolder) => void;
  removeFolderLocal: (id: string) => void;
  replaceDocumentsForFolder: (folderId: string, documents: KnowledgeDocument[]) => void;
  replaceDocumentsForProject: (projectId: string, documents: KnowledgeDocument[]) => void;
  upsertDocument: (document: KnowledgeDocument) => void;
  removeDocumentLocal: (id: string) => void;
  /** Local-only placeholder for SharePoint (not in reference-file API yet). */
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
    (set, get) => ({
      folders: [],
      documents: [],

      replaceFoldersForProject: (projectId, folders) =>
        set((s) => ({
          folders: [...s.folders.filter((f) => f.projectId !== projectId), ...folders],
        })),

      upsertFolder: (folder) =>
        set((s) => {
          const rest = s.folders.filter((f) => f.id !== folder.id);
          return { folders: [...rest, folder] };
        }),

      removeFolderLocal: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          documents: s.documents.filter((d) => d.folderId !== id),
        })),

      replaceDocumentsForFolder: (folderId, documents) =>
        set((s) => ({
          documents: [
            ...s.documents.filter((d) => d.folderId !== folderId),
            ...documents.map((d) => ({
              ...d,
              referenceFileId: d.referenceFileId ?? d.id,
            })),
          ],
        })),

      replaceDocumentsForProject: (projectId, documents) => {
        const folderIds = new Set(
          get()
            .folders.filter((f) => f.projectId === projectId)
            .map((f) => f.id),
        );
        set((s) => ({
          documents: [
            ...s.documents.filter((d) => !folderIds.has(d.folderId)),
            ...documents.map((d) => ({
              ...d,
              referenceFileId: d.referenceFileId ?? d.id,
            })),
          ],
        }));
      },

      upsertDocument: (document) =>
        set((s) => {
          const rest = s.documents.filter((d) => d.id !== document.id);
          return {
            documents: [
              ...rest,
              { ...document, referenceFileId: document.referenceFileId ?? document.id },
            ],
          };
        }),

      removeDocumentLocal: (id) =>
        set((s) => ({ documents: s.documents.filter((d) => d.id !== id) })),

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
