import {
  extractHistoricalRowsFromDefectFilePayload,
  extractMergeFileInfoFromDefectFilePayload,
  mergeDefectFilePayloadsForHydration,
} from "@/lib/pcdi/defect-file-merge-info";
import { extractDefectFileIdFromProjectDefectFilesQueryBody } from "@/lib/pcdi/extract-backend-columns";
import { rowSignatureFromRows, writeBillieMergeSession } from "@/lib/pcdi/billie-merge-session";
import { notifyLiveSelectionsUpdated } from "@/lib/pcdi/live-rows";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

export type HydrateFromDefectFileResult =
  | { ok: true; source: "json-rows" | "merge-xlsx" | "project-query" }
  | { ok: false; error: string };

/**
 * Turns a Billie defect-file JSON payload into session rows (shared by project query and by-file-id GET).
 */
async function applyDefectFilePayloadToSession(
  projectId: string,
  body: unknown,
  defectFileIdForSession: string,
): Promise<HydrateFromDefectFileResult> {
  const id = defectFileIdForSession.trim();
  if (!id) {
    return { ok: false, error: "Missing defect file id for session." };
  }

  const fromJson = extractHistoricalRowsFromDefectFilePayload(body, projectId);
  if (fromJson?.length) {
    writeBillieMergeSession({
      projectId,
      defectFileId: id,
      mergeFileUrl: "",
      rows: fromJson,
      rowSignature: rowSignatureFromRows(fromJson),
      updatedAt: new Date().toISOString(),
    });
    notifyLiveSelectionsUpdated(projectId);
    return { ok: true, source: "json-rows" };
  }

  const merge = extractMergeFileInfoFromDefectFilePayload(body);
  if (merge?.mergeFileUrl) {
    const parseRes = await fetch("/api/defect-files/parse-merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, mergeFileUrl: merge.mergeFileUrl }),
    });
    const pj = (await parseRes.json().catch(() => ({}))) as {
      error?: string;
      rows?: HistoricalDefectTableRow[];
    };
    if (!parseRes.ok || !pj.rows?.length) {
      return {
        ok: false,
        error: pj.error ?? "Could not parse the merged spreadsheet from the defect file.",
      };
    }
    writeBillieMergeSession({
      projectId,
      defectFileId: id,
      mergeFileUrl: merge.mergeFileUrl,
      mergeFileName: merge.mergeFileName,
      rows: pj.rows,
      rowSignature: rowSignatureFromRows(pj.rows),
      updatedAt: new Date().toISOString(),
    });
    notifyLiveSelectionsUpdated(projectId);
    return { ok: true, source: "merge-xlsx" };
  }

  return {
    ok: false,
    error:
      "Defect file response had no rows and no merge file URL. If analysis just finished, wait a moment and refresh — or open the defect register and return. The server may still be building the merge file, or the response shape may differ from what this UI expects.",
  };
}

function mapApplySuccessToProjectQueryResult(applied: HydrateFromDefectFileResult): HydrateFromDefectFileResult {
  if (!applied.ok) return applied;
  if (applied.source === "merge-xlsx") return applied;
  return { ok: true, source: "project-query" };
}

/**
 * When opening a live project: (1) GET /api/defect-files?projectId=… to resolve defectFileId,
 * (2) GET /api/defect-files/{defectFileId} for parsed rows / merge file (same as column-map flow).
 * Falls back to applying the project-query body directly if id is missing or the by-id fetch fails without legacy rows.
 */
export async function hydrateBillieSessionFromProjectDefectFilesQuery(
  projectId: string,
): Promise<HydrateFromDefectFileResult> {
  const pid = projectId.trim();
  if (!pid) {
    return { ok: false, error: "Missing project id." };
  }

  const res = await fetch(`/api/defect-files?projectId=${encodeURIComponent(pid)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown; [k: string]: unknown };

  if (!res.ok) {
    return { ok: false, error: body.error ?? `Defect files by project failed (${res.status}).` };
  }

  const defectFileId = extractDefectFileIdFromProjectDefectFilesQueryBody(body)?.trim() ?? "";

  if (defectFileId) {
    const byId = await hydrateBillieSessionFromDefectFile(projectId, defectFileId);
    if (byId.ok) {
      return mapApplySuccessToProjectQueryResult(byId);
    }
    const legacy = await applyDefectFilePayloadToSession(projectId, body, defectFileId);
    if (legacy.ok) {
      return mapApplySuccessToProjectQueryResult(legacy);
    }
    return byId;
  }

  const syntheticId = `project:${pid}`;
  const applied = await applyDefectFilePayloadToSession(projectId, body, syntheticId);
  return mapApplySuccessToProjectQueryResult(applied);
}

/**
 * Loads parsed defect data via GET /api/defect-files/:id, then either uses embedded rows
 * or downloads the merge spreadsheet through /api/defect-files/parse-merge (same as post–column-map flow).
 */
export async function hydrateBillieSessionFromDefectFile(
  projectId: string,
  defectFileId: string,
): Promise<HydrateFromDefectFileResult> {
  const id = defectFileId.trim();
  if (!id) {
    return { ok: false, error: "Missing defect file id." };
  }

  const res = await fetch(`/api/defect-files/${encodeURIComponent(id)}`, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { error?: string; detail?: unknown; [k: string]: unknown };

  if (!res.ok) {
    return { ok: false, error: body.error ?? `Defect file request failed (${res.status}).` };
  }

  const primary = await applyDefectFilePayloadToSession(projectId, body, id);
  if (primary.ok) return primary;

  /** Detail GET often returns before `mergeFileUrl` is populated; status endpoint usually has it first. */
  try {
    const stRes = await fetch(`/api/defect-files/${encodeURIComponent(id)}/status`, { cache: "no-store" });
    if (stRes.ok) {
      const stBody = (await stRes.json().catch(() => ({}))) as unknown;
      const merged = await applyDefectFilePayloadToSession(
        projectId,
        mergeDefectFilePayloadsForHydration(body, stBody),
        id,
      );
      if (merged.ok) return merged;
      const fromStatus = await applyDefectFilePayloadToSession(projectId, stBody, id);
      if (fromStatus.ok) return fromStatus;
    }
  } catch {
    /* keep primary error */
  }

  return primary;
}
