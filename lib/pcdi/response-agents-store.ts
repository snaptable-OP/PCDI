"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const RESPONSE_AGENTS_STORAGE_KEY = "pcdi-response-agents-v2";

export type ResponseStrategyAgent = {
  id: string;
  projectId: string;
  /** Selected taxonomy v2 response strategy label (same strings as live strategy picker). */
  name: string;
  /** Instruction / system-style prompt for this agent */
  prompt: string;
  knowledgeFolderId: string;
  createdAt: number;
  updatedAt: number;
};

type ResponseAgentsState = {
  agents: ResponseStrategyAgent[];
  addAgent: (input: {
    projectId: string;
    name: string;
    prompt: string;
    knowledgeFolderId: string;
  }) => string;
  updateAgent: (
    id: string,
    updates: Partial<Pick<ResponseStrategyAgent, "name" | "prompt" | "knowledgeFolderId" | "projectId">>,
  ) => void;
  removeAgent: (id: string) => void;
};

export const useResponseAgentsStore = create<ResponseAgentsState>()(
  persist(
    (set) => ({
      agents: [],

      addAgent: ({ projectId, name, prompt, knowledgeFolderId }) => {
        const pid = projectId.trim();
        if (!pid) return "";
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `agent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        const now = Date.now();
        set((s) => ({
          agents: [
            ...s.agents,
            {
              id,
              projectId: pid,
              name: name.trim(),
              prompt: prompt.trim(),
              knowledgeFolderId,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return id;
      },

      updateAgent: (id, updates) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...updates,
                  name: updates.name !== undefined ? updates.name.trim() : a.name,
                  prompt: updates.prompt !== undefined ? updates.prompt.trim() : a.prompt,
                  projectId: updates.projectId !== undefined ? updates.projectId.trim() : a.projectId,
                  updatedAt: Date.now(),
                }
              : a,
          ),
        })),

      removeAgent: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
    }),
    {
      name: RESPONSE_AGENTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ agents: s.agents }),
    },
  ),
);
