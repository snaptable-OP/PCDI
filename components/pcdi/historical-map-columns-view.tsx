"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ColumnMapper } from "@/components/pcdi/column-mapper";
import { IngestionFlowNav } from "@/components/pcdi/ingestion-flow-nav";
import { readUploadPayload } from "@/lib/pcdi/upload-session";

type Props = { projectId: string; basePath: string; mode?: "historical" | "live" };

export function HistoricalMapColumnsView({ projectId, basePath, mode = "historical" }: Props) {
  const [state, setState] = useState<
    | "pending"
    | "missing-upload"
    | { columns: string[]; fileName: string; headerRow: number }
  >("pending");

  useEffect(() => {
    const p = readUploadPayload(projectId);
    if (!p || p.columns.length === 0) {
      setState("missing-upload");
      return;
    }
    setState({
      columns: p.columns,
      fileName: p.fileName,
      headerRow: p.headerRow,
    });
  }, [projectId]);

  if (state === "pending") {
    return (
      <p className="text-sm text-[var(--muted-foreground)]">Loading column list…</p>
    );
  }

  if (state === "missing-upload") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>No upload found for this project in this tab.</p>
        <Link
          href={`${basePath}/${projectId}/setup`}
          className="mt-2 inline-block font-medium text-teal-700 underline hover:underline dark:text-teal-300"
        >
          Go to project setup
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <IngestionFlowNav currentStep={4} className="mb-6" />
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
        <Link href={basePath} className="text-teal-700 hover:underline dark:text-teal-300">
          ← Projects
        </Link>
        <Link
          href={`${basePath}/${projectId}/setup`}
          className="text-teal-700 hover:underline dark:text-teal-300"
        >
          ← Project setup
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Column selection</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted-foreground)]">
        Choose which spreadsheet columns will provide text for <strong>defect category</strong> parsing. Response
        strategy and reference documents are derived from the matrix next — not from column mapping.
      </p>
      <div className="mt-8 max-w-5xl">
        <ColumnMapper
          projectId={projectId}
          columns={state.columns}
          source={{ fileName: state.fileName, headerRow: state.headerRow }}
          continueHref={`${basePath}/${projectId}/defects`}
          continueLabel="Analyse Defects"
          mode={mode}
        />
      </div>
    </div>
  );
}
