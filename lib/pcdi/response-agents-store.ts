"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const RESPONSE_AGENTS_STORAGE_KEY = "pcdi-response-agents-v3";

export type ResponseStrategyAgent = {
  id: string;
  projectId: string;
  /** Selected taxonomy v2 response strategy label (same strings as live strategy picker). */
  name: string;
  /** Instruction / system-style prompt for this agent (saved on server). */
  prompt: string;
  knowledgeFolderId: string;
  createdAt: number;
  updatedAt: number;
};

type ResponseAgentsState = {
  agents: ResponseStrategyAgent[];
  replaceAgentsForProject: (projectId: string, agents: ResponseStrategyAgent[]) => void;
  upsertAgent: (agent: ResponseStrategyAgent) => void;
  removeAgentLocal: (id: string) => void;
};

export const useResponseAgentsStore = create<ResponseAgentsState>()(
  persist(
    (set) => ({
      agents: [],

      replaceAgentsForProject: (projectId, agents) =>
        set((s) => ({
          agents: [...s.agents.filter((a) => a.projectId !== projectId), ...agents],
        })),

      upsertAgent: (agent) =>
        set((s) => {
          const rest = s.agents.filter((a) => a.id !== agent.id);
          return { agents: [...rest, agent] };
        }),

      removeAgentLocal: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
    }),
    {
      name: RESPONSE_AGENTS_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ agents: s.agents }),
    },
  ),
);
