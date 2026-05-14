"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import { ProjectMetadataFormFields, type ProjectMetadataValues } from "@/components/pcdi/project-metadata-form";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule, AssetType, HistoricalProject, StructuralType } from "@/lib/pcdi/types";

type ProjectSetupSinglePageProps = {
  basePath: string;
  module: AnalysisModule;
  /**
   * When set (e.g. `/live/[id]/setup`), only steps 1–2 (project details). Upload is on `/live/[id]/upload`.
   * Omit on `/live/new` — user creates the project via API first, then goes to the upload page.
   */
  initialProjectId?: string | null;
};

/**
 * Steps 1–2 only (metadata). Create project calls `POST /api/defect-projects`, then redirects to `/{id}/upload`.
 */
export function ProjectSetupSinglePage({
  basePath,
  module,
  initialProjectId = null,
}: ProjectSetupSinglePageProps) {
  if (!initialProjectId) {
    return <DraftProjectCreate basePath={basePath} module={module} />;
  }
  return <ProjectSetupWithId basePath={basePath} module={module} projectId={initialProjectId} />;
}

function DraftProjectCreate({ basePath, module }: { basePath: string; module: AnalysisModule }) {
  const router = useRouter();
  const idPrefix = useId();
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

    /** Body shape expected by Billie `POST /api/defect-projects`. */
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

      const p: HistoricalProject = {
        id: projectId,
        name,
        assetType,
        floorLevels: floorLevelsStr,
        location: locationStr,
        structuralType,
        createdAt: new Date().toISOString(),
        analysisModule: module,
      };
      useHistoricalProjectsStore.getState().addProject(p);
      router.replace(`${basePath}/${projectId}/upload`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pb-12">
      <div className="text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-link hover:underline">
          ← Back to projects
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">New project setup</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Complete <strong>steps 1 and 2</strong> below, then press <strong>Create project</strong>. You&apos;ll go to
          the <strong>spreadsheet upload</strong> page next (steps 3–4).
        </p>
      </div>

      <IngestionFlowNav currentStep="all" className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2" />

      <form onSubmit={onCreateProject} className="space-y-8">
        <section
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
          aria-labelledby="draft-steps-12"
        >
          <h2 id="draft-steps-12" className="text-lg font-semibold text-[var(--foreground)]">
            Steps 1 &amp; 2 — Project details
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Project name and metadata are required before upload.
          </p>

          <label htmlFor={`${idPrefix}-projectName`} className="mt-6 block text-sm font-medium text-[var(--foreground)]">
            1. Project name
          </label>
          <input
            id={`${idPrefix}-projectName`}
            name="projectName"
            required
            autoComplete="off"
            defaultValue=""
            disabled={busy}
            placeholder="e.g. North Wharf — Phase 1"
            className="mt-1 w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--ring)] focus:ring-2 disabled:opacity-60"
          />

          <div className="mt-8">
            <p className="text-sm font-medium text-[var(--foreground)]">2. Project metadata</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Asset, location, and structural context.</p>
            <div className="mt-5 flex max-w-lg flex-col gap-5">
              <ProjectMetadataFormFields idPrefix={`${idPrefix}-meta`} defaultValues={metaDefault} />
            </div>
          </div>

          {error ? (
            <p className="mt-6 text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[color:var(--water-2)] px-5 py-2.5 text-sm font-medium text-white hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating project…" : "Create project"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function ProjectSetupWithId({
  basePath,
  module,
  projectId,
}: {
  basePath: string;
  module: AnalysisModule;
  projectId: string;
}) {
  const router = useRouter();
  const idPrefix = useId();

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

  const updateProject = useHistoricalProjectsStore((s) => s.updateProject);
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));

  const [name, setName] = useState("New project");

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

  if (hasHydrated && !project) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found. It may have been removed from this browser.</p>
        <Link
          href={basePath}
          className="mt-2 inline-block font-medium text-link underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  if (project && project.analysisModule !== module) {
    const correct = project.analysisModule === "live" ? "/live" : "/historical";
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>
          This project is under <strong>{project.analysisModule === "live" ? "Live" : "Historical"}</strong>{" "}
          analysis. Open it from the matching list.
        </p>
        <Link
          href={correct}
          className="mt-2 inline-block font-medium text-link underline"
        >
          Go to {project.analysisModule === "live" ? "Live" : "Historical"} projects
        </Link>
      </div>
    );
  }

  if (!hasHydrated) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]" role="status">
        Loading project…
      </p>
    );
  }

  if (!project) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]" role="status">
        Loading project…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pb-12">
      <div className="text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-link hover:underline">
          ← Back to projects
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Project setup</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Edit project name and metadata here. Spreadsheet upload and column mapping are on the next page.
        </p>
      </div>

      <div className="rounded-lg border border-accent-tint-border bg-accent-tint px-4 py-3 text-sm text-[var(--foreground)]">
        <p className="font-medium">Steps 3–4 — Spreadsheet</p>
        <p className="mt-1 text-[var(--muted-foreground)]">
          Upload the Excel file, parse it, and map columns on the dedicated page.
        </p>
        <Link
          href={`${basePath}/${projectId}/upload`}
          className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active"
        >
          Go to spreadsheet upload →
        </Link>
      </div>

      <IngestionFlowNav currentStep="all" className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2" />

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
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Asset, location, and structural context. Update anytime — press save to persist locally.
        </p>
        <form onSubmit={onMetadataSubmit} className="mt-5 flex max-w-lg flex-col gap-5" key={`meta-${projectId}`}>
          <ProjectMetadataFormFields idPrefix={idPrefix} defaultValues={metaDefault} />
          <button
            type="submit"
            className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/60 px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
          >
            Save metadata
          </button>
        </form>
      </section>
    </div>
  );
}
