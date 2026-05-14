"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const STORAGE_KEY = "pcdi-selected-live-project-id-v1";

type LiveSelectedProjectState = {
  /** Billie / UI defect project UUID; drives Live + Response agents + Knowledge folders scope. */
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;
};

export const useLiveSelectedProjectStore = create<LiveSelectedProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      setSelectedProjectId: (id) => set({ selectedProjectId: id?.trim() || null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ selectedProjectId: s.selectedProjectId }),
    },
  ),
);
