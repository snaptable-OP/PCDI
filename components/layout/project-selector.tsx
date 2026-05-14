"use client";

import { ChevronDown, FolderKanban, Plus } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CreateLiveProjectDialog } from "@/components/pcdi/create-live-project-dialog";
import { useLiveSelectedProjectStore } from "@/lib/pcdi/live-selected-project-store";
import { syncLiveProjectsFromApi } from "@/lib/pcdi/sync-live-projects-from-api";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";

export function ProjectSelector() {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const allProjects = useHistoricalProjectsStore((s) => s.projects);
  const projects = useMemo(
    () => allProjects.filter((p) => p.analysisModule === "live"),
    [allProjects],
  );
  const selectedId = useLiveSelectedProjectStore((s) => s.selectedProjectId);
  const setSelected = useLiveSelectedProjectStore((s) => s.setSelectedProjectId);

  const selected = selectedId ? projects.find((p) => p.id === selectedId) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = containerRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!open) return;
      await syncLiveProjectsFromApi();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const label =
    selected?.name ??
    (selectedId ? `${selectedId.slice(0, 8)}…` : "Choose project");

  return (
    <>
      <div ref={containerRef} className="relative border-b border-[color:var(--sidebar-border)] px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sidebar-subtitle-text)]">
          Project
        </p>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full min-h-[44px] items-center justify-between gap-2 rounded-lg border border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-nav-hover-bg)]/25 px-3 py-2 text-left text-sm text-[color:var(--sidebar-nav-text)] outline-none transition hover:bg-[color:var(--sidebar-nav-hover-bg)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0 text-[color:var(--sidebar-icon)]" />
            <span className="min-w-0 truncate font-medium">{label}</span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div
            id={`${id}-listbox`}
            role="listbox"
            aria-labelledby={`${id}-trigger`}
            className="absolute left-4 right-4 top-full z-[250] mt-1 max-h-[min(50vh,320px)] overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-xl"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-accent transition hover:bg-surface-muted"
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New project…
            </button>
            <div className="my-1 border-t border-border" />
            {projects.length === 0 ? (
              <p className="px-3 py-4 text-xs text-foreground-muted">No projects synced yet.</p>
            ) : (
              projects
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={p.id === selectedId}
                    className={`flex w-full items-center truncate px-3 py-2.5 text-left text-sm transition hover:bg-surface-muted ${
                      p.id === selectedId ? "bg-accent/10 font-medium text-accent" : "text-foreground"
                    }`}
                    onClick={() => {
                      setSelected(p.id);
                      setOpen(false);
                    }}
                  >
                    {p.name}
                  </button>
                ))
            )}
          </div>
        ) : null}
      </div>

      <CreateLiveProjectDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
