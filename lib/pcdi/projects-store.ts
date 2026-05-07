import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { seedProjects } from "./mock-data";
import type { HistoricalProject } from "./types";

export const PCDI_PROJECTS_STORAGE_KEY = "pcdi-historical-projects-v1";

const STORE_VERSION = 3;

type HistoricalProjectsState = {
  projects: HistoricalProject[];
  addProject: (project: HistoricalProject) => void;
  /** Insert or merge by `id` (used when hydrating a project from GET /api/defect-projects). */
  upsertProject: (project: HistoricalProject) => void;
  updateProject: (
    id: string,
    updates: Partial<
      Pick<
        HistoricalProject,
        "name" | "assetType" | "floorLevels" | "location" | "structuralType" | "defectFileId"
      >
    >,
  ) => void;
  removeProject: (id: string) => void;
  /** Replace all projects for one analysis module (e.g. sync live list from GET /api/defect-projects). */
  replaceProjectsForModule: (module: HistoricalProject["analysisModule"], projects: HistoricalProject[]) => void;
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
      upsertProject: (project) =>
        set((s) => {
          const i = s.projects.findIndex((p) => p.id === project.id);
          if (i === -1) return { projects: [project, ...s.projects] };
          const next = [...s.projects];
          next[i] = { ...next[i], ...project };
          return { projects: next };
        }),
      updateProject: (id, updates) =>
        set((s) => ({
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removeProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      replaceProjectsForModule: (module, incoming) =>
        set((s) => {
          const others = s.projects.filter((p) => p.analysisModule !== module);
          if (module !== "live") {
            return { projects: [...others, ...incoming] };
          }
          /**
           * GET /api/defect-projects often omits or strips metadata the user entered at create
           * (`floorLevels`, `location`, asset/structural). A blind replace wiped those cells on sync.
           * Merge by id: prefer non-empty API strings; otherwise keep what we already had in memory.
           * Prefer prior asset/structural — list payloads frequently default to residential/mixed when keys absent.
           */
          const prevLiveById = new Map(
            s.projects.filter((p) => p.analysisModule === "live").map((p) => [p.id, p]),
          );
          const merged = incoming.map((inc) => {
            const prev = prevLiveById.get(inc.id);
            if (!prev) return inc;
            const loc = inc.location?.trim() || prev.location?.trim() || "";
            const floors = inc.floorLevels?.trim() || prev.floorLevels?.trim() || "";
            return {
              ...inc,
              location: loc,
              floorLevels: floors,
              assetType: prev.assetType,
              structuralType: prev.structuralType,
            };
          });
          return { projects: [...others, ...merged] };
        }),
    }),
    {
      name: PCDI_PROJECTS_STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      /** Live projects come from GET /api/defect-projects; persisting them lets stale disk overwrite fresh API data on rehydrate. */
      partialize: (s) => ({
        projects: s.projects.filter((p) => p.analysisModule !== "live"),
      }),
      /**
       * Shallow merge would still replace `projects` with the partialized array only — wiping in-memory live rows.
       * Prefer memory live when present; otherwise keep live rows that older persisted blobs may still contain.
       */
      merge: (persistedState, currentState) => {
        const raw =
          persistedState &&
          typeof persistedState === "object" &&
          "projects" in persistedState &&
          Array.isArray((persistedState as { projects: unknown }).projects)
            ? (persistedState as { projects: HistoricalProject[] }).projects
            : [];
        const memoryLive = currentState.projects.filter((p) => p.analysisModule === "live");
        const persistedNonLive = raw.filter((p) => p.analysisModule !== "live");
        const persistedLive = raw.filter((p) => p.analysisModule === "live");
        const currentNonLive = currentState.projects.filter((p) => p.analysisModule !== "live");
        const nonLive =
          persistedNonLive.length > 0 ? persistedNonLive : currentNonLive;
        const live = memoryLive.length > 0 ? memoryLive : persistedLive;
        return {
          ...currentState,
          projects: [...nonLive, ...live],
        };
      },
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
