"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import { ProjectMetadataFormFields, type ProjectMetadataValues } from "@/components/pcdi/project-metadata-form";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AssetType, StructuralType } from "@/lib/pcdi/types";

const DEFAULT_METADATA: ProjectMetadataValues = {
  assetType: "residential",
  floorLevels: "",
  location: "",
  structuralType: "concrete",
};

type ProjectMetadataStepProps = {
  projectId: string;
  basePath: string;
};

export function ProjectMetadataStep({ projectId, basePath }: ProjectMetadataStepProps) {
  const router = useRouter();
  const idPrefix = useId();
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const updateProject = useHistoricalProjectsStore((s) => s.updateProject);

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found.</p>
        <Link href={basePath} className="mt-2 inline-block text-teal-700 underline dark:text-teal-300">
          Back to projects
        </Link>
      </div>
    );
  }

  const defaultMeta: ProjectMetadataValues = {
    assetType: project.assetType,
    floorLevels: project.floorLevels,
    location: project.location,
    structuralType: project.structuralType,
  };

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateProject(projectId, {
      assetType: fd.get("assetType") as AssetType,
      floorLevels: String(fd.get("floorLevels") ?? "").trim(),
      location: String(fd.get("location") ?? "").trim(),
      structuralType: fd.get("structuralType") as StructuralType,
    });
    router.push(`${basePath}/${projectId}/setup`);
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-xl">
      <IngestionFlowNav currentStep={2} className="mb-6" />
      <div className="mb-2 text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-teal-700 hover:underline dark:text-teal-300">
          ← Projects
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Project metadata</h1>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
        {project.name} — set asset and context used when routing defects and response strategies. You can change
        this later (store is local to this browser).
      </p>

      <form key={projectId} onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <ProjectMetadataFormFields idPrefix={idPrefix} defaultValues={defaultMeta} />
        <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:justify-end sm:gap-3">
          <Link
            href={basePath}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-[var(--border)] px-4 py-2.5 text-center text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Save and continue to upload
          </button>
        </div>
      </form>
    </div>
  );
}
