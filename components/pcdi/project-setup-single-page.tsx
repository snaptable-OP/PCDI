"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ColumnMapper } from "@/components/pcdi/column-mapper";
import { HistoricalUploadPanel } from "@/components/pcdi/historical-upload-panel";
import { ProjectMetadataFormFields, type ProjectMetadataValues } from "@/components/pcdi/project-metadata-form";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule, AssetType, HistoricalProject, StructuralType } from "@/lib/pcdi/types";
import type { PcdiUploadSessionPayload } from "@/lib/pcdi/types";

function newProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `proj_${Date.now()}`;
}

type ProjectSetupSinglePageProps = {
  basePath: string;
  module: AnalysisModule;
  /**
   * When set (e.g. `/live/[id]/setup`), the page edits that project instead of creating a new id
   * as with `/live/new`.
   */
  initialProjectId?: string | null;
};

/**
 * All four ingest steps on one scrollable page: name → metadata → upload → column selection.
 * Routes: `/historical/new`, `/live/new`, or `/…/[projectId]/setup` for an existing project.
 */
export function ProjectSetupSinglePage({
  basePath,
  module,
  initialProjectId = null,
}: ProjectSetupSinglePageProps) {
  const router = useRouter();
  const idPrefix = useId();
  const isExisting = Boolean(initialProjectId);
  const projectIdRef = useRef<string | null>(null);
  if (projectIdRef.current === null) {
    projectIdRef.current = initialProjectId ?? newProjectId();
  }
  const projectId = projectIdRef.current;

  const [hasHydrated, setHasHydrated] = useState(
    () =>
      typeof window !== "undefined" && useHistoricalProjectsStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (useHistoricalProjectsStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    return useHistoricalProjectsStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, []);

  const addProject = useHistoricalProjectsStore((s) => s.addProject);
  const updateProject = useHistoricalProjectsStore((s) => s.updateProject);
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));

  const [name, setName] = useState("New project");
  const [uploadPayload, setUploadPayload] = useState<PcdiUploadSessionPayload | null>(null);

  useEffect(() => {
    if (isExisting) return;
    const { projects } = useHistoricalProjectsStore.getState();
    if (projects.some((p) => p.id === projectId)) return;
    const p: HistoricalProject = {
      id: projectId,
      name: "New project",
      assetType: "residential",
      floorLevels: "",
      location: "",
      structuralType: "concrete",
      createdAt: new Date().toISOString(),
      analysisModule: module,
    };
    addProject(p);
  }, [addProject, isExisting, projectId, module]);

  useEffect(() => {
    if (project?.name) setName(project.name);
  }, [project?.name]);

  const onNameBlur = useCallback(() => {
    const t = name.trim() || "New project";
    setName(t);
    updateProject(projectId, { name: t });
  }, [name, projectId, updateProject]);

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const onMetadataSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    updateProject(projectId, {
      assetType: fd.get("assetType") as AssetType,
      floorLevels: String(fd.get("floorLevels") ?? "").trim(),
      location: String(fd.get("location") ?? "").trim(),
      structuralType: fd.get("structuralType") as StructuralType,
    });
  };

  const handleColumnFinish = useCallback(() => {
    router.push(`${basePath}/${projectId}/defects`);
  }, [basePath, projectId, router]);

  const metaDefault: ProjectMetadataValues = project
    ? {
        assetType: project.assetType,
        floorLevels: project.floorLevels,
        location: project.location,
        structuralType: project.structuralType,
      }
    : {
        assetType: "residential",
        floorLevels: "",
        location: "",
        structuralType: "concrete",
      };

  if (isExisting && hasHydrated && !project) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found. It may have been removed from this browser.</p>
        <Link
          href={basePath}
          className="mt-2 inline-block font-medium text-teal-700 underline dark:text-teal-300"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  if (isExisting && hasHydrated && project && project.analysisModule !== module) {
    const correct = project.analysisModule === "live" ? "/live" : "/historical";
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>
          This project is under <strong>{project.analysisModule === "live" ? "Live" : "Historical"}</strong>{" "}
          analysis. Open it from the matching list.
        </p>
        <Link
          href={correct}
          className="mt-2 inline-block font-medium text-teal-700 underline dark:text-teal-300"
        >
          Go to {project.analysisModule === "live" ? "Live" : "Historical"} projects
        </Link>
      </div>
    );
  }

  if (isExisting && !hasHydrated) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]" role="status">
        Loading project…
      </p>
    );
  }

  if (!project) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]" role="status">
        Preparing new project…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pb-12">
      <div className="text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-teal-700 hover:underline dark:text-teal-300">
          ← Back to projects
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          {isExisting ? "Project setup" : "New project setup"}
        </h1>
      </div>

      <section
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
        aria-labelledby="ingest-step-name"
      >
        <h2 id="ingest-step-name" className="text-lg font-semibold text-[var(--foreground)]">
          1. Project name
        </h2>
        <label htmlFor={`${idPrefix}-name`} className="mt-4 block text-sm font-medium text-[var(--foreground)]">
          Name
        </label>
        <input
          id={`${idPrefix}-name`}
          value={name}
          onChange={onNameChange}
          onBlur={onNameBlur}
          autoComplete="off"
          className="mt-1 w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2"
          placeholder="e.g. North Wharf — Phase 1"
        />
      </section>

      <section
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
        aria-labelledby="ingest-step-meta"
      >
        <h2 id="ingest-step-meta" className="text-lg font-semibold text-[var(--foreground)]">
          2. Project metadata
        </h2>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Asset, location, and structural context.</p>
        <form onSubmit={onMetadataSubmit} className="mt-5 flex max-w-lg flex-col gap-5" key={projectId}>
          <ProjectMetadataFormFields idPrefix={idPrefix} defaultValues={metaDefault} />
          <button
            type="submit"
            className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Save metadata
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6" aria-label="Upload">
        <HistoricalUploadPanel
          projectId={projectId}
          basePath={basePath}
          layout="embedded"
          onPayloadChange={setUploadPayload}
        />
      </section>

      {uploadPayload && uploadPayload.columns.length > 0 ? (
        <section
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
          aria-labelledby="ingest-step-columns"
        >
          <h2 id="ingest-step-columns" className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            4. Column selection
          </h2>
          <ColumnMapper
            projectId={projectId}
            columns={uploadPayload.columns}
            source={{ fileName: uploadPayload.fileName, headerRow: uploadPayload.headerRow }}
            continueHref={`${basePath}/${projectId}/defects`}
            continueLabel="Analyse Defects"
            onFinish={handleColumnFinish}
            mode={module === "live" ? "live" : "historical"}
          />
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">4. Column selection</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            In step 3, set the header row, click <strong>Parse</strong>, then map columns here.
          </p>
        </section>
      )}
    </div>
  );
}
