"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { buildMasterPrompt } from "@/lib/pcdi/build-master-prompt";
import { defectRegisterRowsToEnriched } from "@/lib/pcdi/defect-register-export";
import {
  getLiveRegisterMergedRows,
  liveExportAndPromptAllowed,
} from "@/lib/pcdi/live-rows";
import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";

type Props = { projectId: string; basePath: string };

export function DefectAnalysisPromptView({ projectId, basePath }: Props) {
  const project = useHistoricalProjectsStore((s) => s.projects.find((p) => p.id === projectId));
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  const promptReady = useMemo(() => liveExportAndPromptAllowed(projectId), [projectId]);

  const enrichedRows = useMemo(() => {
    const rows = getLiveRegisterMergedRows(projectId);
    return defectRegisterRowsToEnriched(rows);
  }, [projectId]);

  const promptText = useMemo(() => {
    if (!project || !promptReady) return "";
    return buildMasterPrompt({
      metadata: {
        label: project.name,
        assetType: project.assetType,
        floorLevels: project.floorLevels,
        location: project.location,
        structuralType: project.structuralType,
      },
      enrichedRows,
    });
  }, [project, enrichedRows, promptReady]);

  useEffect(() => {
    if (copyStatus !== "copied" && copyStatus !== "error") return;
    const id = window.setTimeout(() => setCopyStatus("idle"), 2500);
    return () => window.clearTimeout(id);
  }, [copyStatus]);

  const onCopy = useCallback(async () => {
    if (!promptText) return;
    try {
      await navigator.clipboard.writeText(promptText);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }, [promptText]);

  if (!project) {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>Project not found. It may have been removed from this browser.</p>
        <Link
          href={basePath}
          className="mt-2 inline-block font-medium text-link underline hover:underline"
        >
          Back to projects
        </Link>
      </div>
    );
  }

  if (project.analysisModule !== "live") {
    return (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
        <p>
          Master prompt with export workflow is for <strong>live project</strong> analysis. This project is in
          historical analysis.
        </p>
        <Link
          href="/historical"
          className="mt-2 inline-block font-medium text-link underline hover:underline"
        >
          Open historical projects
        </Link>
      </div>
    );
  }

  if (!promptReady) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-[var(--foreground)]">
          <p className="font-medium">Confirm response strategies first</p>
          <p className="mt-1 text-[var(--muted-foreground)]">
            The master prompt is available after you select a response strategy for every row and confirm
            that selection on the live defect register.
          </p>
        </div>
        <Link
          href={`${basePath}/${projectId}/defects`}
          className="inline-flex rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active"
        >
          Back to live defect register
        </Link>
      </div>
    );
  }

  const liveMessage =
    copyStatus === "copied"
      ? "Copied to clipboard."
      : copyStatus === "error"
        ? "Copy failed. Check browser permissions."
        : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-[var(--muted-foreground)]">
          {enrichedRows.length} defect row{enrichedRows.length === 1 ? "" : "s"} in prompt · metadata from this
          project ({project.name})
        </p>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void onCopy()}
            disabled={!promptText}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] outline-none ring-[var(--ring)] hover:bg-[var(--surface-muted)] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            Copy to clipboard
          </button>
          <div
            aria-live="polite"
            role="status"
            className="min-h-[1.25rem] text-sm text-foreground-emphasis"
          >
            {liveMessage}
          </div>
        </div>
      </div>

      <pre className="max-h-[min(70vh,42rem)] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 p-4 font-mono text-xs leading-relaxed text-[var(--foreground)] shadow-inner sm:text-sm">
        {promptText}
      </pre>

      <Link
        href={`${basePath}/${projectId}/defects`}
        className="inline-flex rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] hover:bg-accent-hover active:bg-accent-active"
      >
        Back to defect register
      </Link>
    </div>
  );
}
