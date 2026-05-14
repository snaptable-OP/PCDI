"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ProjectMetadataFormFields, type ProjectMetadataValues } from "@/components/pcdi/project-metadata-form";
import { useLiveSelectedProjectStore } from "@/lib/pcdi/live-selected-project-store";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AssetType, StructuralType } from "@/lib/pcdi/types";

export function CreateLiveProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const idPrefix = useId();
  const setSelected = useLiveSelectedProjectStore((s) => s.setSelectedProjectId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metaDefault: ProjectMetadataValues = {
    assetType: "residential",
    floorLevels: "",
    location: "",
    structuralType: "concrete",
  };

  async function onCreateProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("projectName") ?? "").trim() || "New project";
    const floorLevelsStr = String(fd.get("floorLevels") ?? "").trim();
    const locationStr = String(fd.get("location") ?? "").trim();
    const structuralType = fd.get("structuralType") as StructuralType;
    const assetType = fd.get("assetType") as AssetType;

    const apiPayload = {
      name,
      code: "",
      location: locationStr === "" ? null : locationStr,
      region: "",
      floorLevels: floorLevelsStr,
      structureTypes: [structuralType],
      assetType,
    };

    setBusy(true);
    try {
      const res = await fetch("/api/defect-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
        detail?: unknown;
        cause?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError(
          [body.error ?? "Could not create project on the analysis server.", body.hint, body.cause]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }
      const projectId = body.id;
      if (!projectId || typeof projectId !== "string") {
        setError(body.error ?? "Could not create project — no project id in the response.");
        return;
      }

      useHistoricalProjectsStore.getState().addProject({
        id: projectId,
        name,
        assetType,
        floorLevels: floorLevelsStr,
        location: locationStr,
        structuralType,
        createdAt: new Date().toISOString(),
        analysisModule: "live",
      });
      setSelected(projectId);
      onClose();
      router.push("/live");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const shell = (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 p-4 backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-2xl shadow-black/20"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-live-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-live-project-title" className="text-lg font-semibold text-foreground">
          New project
        </h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Creates a Billie defect project (same as before), then you can add one or more analyses per project.
        </p>

        <form onSubmit={onCreateProject} className="mt-5 space-y-5">
          <div>
            <label htmlFor={`${idPrefix}-projectName`} className="block text-sm font-medium text-foreground">
              Project name
            </label>
            <input
              id={`${idPrefix}-projectName`}
              name="projectName"
              required
              autoComplete="off"
              disabled={busy}
              placeholder="e.g. North Wharf — Phase 1"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none ring-accent/0 focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
            />
          </div>

          <div>
            <p className="text-sm font-medium text-foreground">Project metadata</p>
            <p className="mt-1 text-sm text-foreground-muted">Asset, location, and structural context (sent to the API).</p>
            <div className="mt-4 flex flex-col gap-5">
              <ProjectMetadataFormFields idPrefix={`${idPrefix}-meta`} defaultValues={metaDefault} />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(shell, document.body);
}
