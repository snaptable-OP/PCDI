import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seedProjects } from "./mock-data";
import type { HistoricalProject } from "./types";

export const PCDI_PROJECTS_STORAGE_KEY = "pcdi-historical-projects-v1";

const STORE_VERSION = 3;

type HistoricalProjectsState = {
  projects: HistoricalProject[];
  addProject: (project: HistoricalProject) => void;
  updateProject: (id: string, updates: Partial<Pick<HistoricalProject, "name" | "assetType" | "floorLevels" | "location" | "structuralType">>) => void;
  removeProject: (id: string) => void;
};

function migrateProjects(projects: HistoricalProject[]): HistoricalProject[] {
  return projects.map((p) => ({
    ...p,
    analysisModule: p.analysisModule ?? "historical",
  }));
}

export const useHistoricalProjectsStore = create<HistoricalProjectsState>()(
  persist(
    (set) => ({
      projects: [...seedProjects],
      addProject: (project) =>
        set((s) => ({ projects: [project, ...s.projects] })),
      updateProject: (id, updates) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removeProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    }),
    {
      name: PCDI_PROJECTS_STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ projects: s.projects }),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as { projects?: HistoricalProject[] } | null;
        if (!state?.projects) return { projects: [...seedProjects] };
        if (version < 2) {
          return { projects: migrateProjects(state.projects) };
        }
        return state;
      },
    },
  ),
);
