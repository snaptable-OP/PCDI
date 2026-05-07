"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ColumnMapper } from "@/components/pcdi/column-mapper";
import { HistoricalUploadPanel } from "@/components/pcdi/historical-upload-panel";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { AnalysisModule, HistoricalProject, PcdiUploadSessionPayload } from "@/lib/pcdi/types";

type ProjectIngestUploadPageProps = {
  basePath: string;
  module: AnalysisModule;
  projectId: string;
};

/**
 * Steps 3–4 on a dedicated route: upload + parse (backend may return column names) + column mapping.
 */
export function ProjectIngestUploadPage({ basePath, module, projectId }: ProjectIngestUploadPageProps) {
  const [hasHydrated, setHasHydrated] = useState(
    () => typeof window !== "undefined" && useHistoricalProjectsStore.persist.hasHydrated(),
  );
  const [uploadPayload, setUploadPayload] = useState<PcdiUploadSessionPayload | null>(null);

  useEffect(() => {
    if (useHistoricalProjectsStore.persist.hasHydrated()) {
      setHasHydrated(true);
      return;
    }
    return useHistoricalProjectsStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
  }, []);

  const project = useHistoricalProjectsStore((s) =>
    s.projects.find((p) => p.id === projectId) as HistoricalProject | undefined,
  );

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
          analysis.
        </p>
        <Link href={correct} className="mt-2 inline-block font-medium text-link underline">
          Go to {project.analysisModule === "live" ? "Live" : "Historical"} projects
        </Link>
      </div>
    );
  }

  if (!hasHydrated || !project) {
    return (
      <p className="text-sm text-[var(--muted-foreground)]" role="status">
        Loading…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-8 pb-12">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-link hover:underline">
          ← Projects
        </Link>
        <Link href={`${basePath}/${projectId}/setup`} className="text-link hover:underline">
          ← Project details (steps 1–2)
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          Spreadsheet — {project.name}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Step 3: set the header row, upload, and parse (the server returns column names when available). Step 4: map
          columns, then analyse defects.
        </p>
      </div>

      <IngestionFlowNav currentStep="all" className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2" />

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
          id="ingest-step-columns"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
          aria-labelledby="ingest-step-columns-heading"
        >
          <h2 id="ingest-step-columns-heading" className="mb-4 text-lg font-semibold text-[var(--foreground)]">
            4. Column selection
          </h2>
          <ColumnMapper
            key={uploadPayload.s3Key ?? `${uploadPayload.fileName}-${uploadPayload.headerRow}`}
            projectId={projectId}
            columns={uploadPayload.columns}
            source={{ fileName: uploadPayload.fileName, headerRow: uploadPayload.headerRow }}
            continueHref={`${basePath}/${projectId}/defects`}
            continueLabel="Analyse Defects"
            defectFileId={uploadPayload.defectFileId}
            mode={module === "live" ? "live" : "historical"}
          />
        </section>
      ) : (
        <section
          id="ingest-step-columns"
          className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 p-5 sm:p-6"
        >
          <h2 className="text-lg font-semibold text-[var(--foreground)]">4. Column selection</h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Complete step 3: choose the header row, click <strong>Parse</strong>, then map columns here.
          </p>
        </section>
      )}
    </div>
  );
}
