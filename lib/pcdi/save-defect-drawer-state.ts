import {
  getLiveSelectionFingerprint,
  resolveLiveResponseStrategy,
} from "@/lib/pcdi/live-rows";
import { writeLiveSelectionState } from "@/lib/pcdi/live-selection-session";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

type ContentRow = { id?: string; itemId?: string; item_id?: string };

function extractContentsList(json: unknown): ContentRow[] {
  if (!json || typeof json !== "object") return [];
  const root = json as Record<string, unknown>;
  const data = root.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const c = (data as Record<string, unknown>).content;
    if (Array.isArray(c)) return c as ContentRow[];
  }
  const c2 = root.content;
  if (Array.isArray(c2)) return c2 as ContentRow[];
  return [];
}

export type SaveDefectDrawerResult = {
  strategiesPushed: number;
  responsesPushed: number;
  warnings: string[];
};

/** Writes current per-row strategy picks to the same session store as the register (confirmed). */
export function persistDrawerStrategyDrafts(
  projectId: string,
  defectFileId: string | null | undefined,
  aggregateRowIds: string[],
  draftByRow: Record<string, string>,
  previousSelections: Record<string, string>,
): Record<string, string> {
  const fp = getLiveSelectionFingerprint(projectId, defectFileId);
  const next = { ...previousSelections };
  for (const id of aggregateRowIds) {
    const v = (draftByRow[id] ?? "").trim();
    if (v) next[id] = v;
    else delete next[id];
  }
  writeLiveSelectionState(
    projectId,
    { selections: next, confirmed: true, fingerprint: fp },
    defectFileId,
  );
  return next;
}

export function effectiveStrategyByRow(
  rows: HistoricalDefectTableRow[],
  draftByRow: Record<string, string>,
  selectionsMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const d = (draftByRow[row.id] ?? "").trim();
    const effective = d || resolveLiveResponseStrategy(row, selectionsMap).trim();
    if (effective) out[row.id] = effective;
  }
  return out;
}

/**
 * Pushes strategies (Billie batch API) and generated responses (content PUT by itemId lookup).
 * Rows must include `itemId` when derived from the merged sheet / API for server updates to apply.
 */
export async function saveDefectDrawerToBackend(options: {
  defectFileId: string;
  rows: HistoricalDefectTableRow[];
  strategyByRowId: Record<string, string>;
  responseByRow: Record<string, string>;
}): Promise<SaveDefectDrawerResult> {
  const warnings: string[] = [];
  let strategiesPushed = 0;
  let responsesPushed = 0;

  const { defectFileId, rows, strategyByRowId, responseByRow } = options;

  const byStrategy = new Map<string, string[]>();
  for (const row of rows) {
    const strat = (strategyByRowId[row.id] ?? "").trim();
    const itemId = row.itemId?.trim();
    if (!strat || !itemId) continue;
    if (!byStrategy.has(strat)) byStrategy.set(strat, []);
    byStrategy.get(strat)!.push(itemId);
  }

  for (const [userChosenResponseStrategy, itemIds] of byStrategy) {
    const res = await fetch("/api/defect-files/content/user-chosen-response-strategy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defectFileId, itemIds, userChosenResponseStrategy }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      warnings.push(
        `Strategy batch "${userChosenResponseStrategy}": ${typeof err.error === "string" ? err.error : res.status}`,
      );
      continue;
    }
    strategiesPushed += itemIds.length;
  }

  const rowsNeedingResponse = rows.filter(
    (r) => (responseByRow[r.id] ?? "").trim().length > 0 && (r.itemId ?? "").trim().length > 0,
  );
  if (rowsNeedingResponse.length === 0) {
    return { strategiesPushed, responsesPushed, warnings };
  }

  let contentsRes: Response;
  try {
    contentsRes = await fetch(
      `/api/defect-files/${encodeURIComponent(defectFileId)}/contents?page=0&size=99999`,
      { cache: "no-store" },
    );
  } catch (e) {
    warnings.push(`Could not load content rows: ${e instanceof Error ? e.message : "fetch failed"}`);
    return { strategiesPushed, responsesPushed, warnings };
  }

  if (!contentsRes.ok) {
    warnings.push("Could not load content rows for response save.");
    return { strategiesPushed, responsesPushed, warnings };
  }

  const json = await contentsRes.json();
  const contentList = extractContentsList(json);

  const itemToContentId = new Map<string, string>();
  for (const c of contentList) {
    const raw = c as Record<string, unknown>;
    const iidRaw = raw.itemId ?? raw.item_id ?? raw.ItemId;
    const iid = typeof iidRaw === "string" ? iidRaw.trim() : "";
    const cid = typeof c.id === "string" ? c.id.trim() : "";
    if (iid && cid) itemToContentId.set(iid, cid);
  }

  for (const row of rowsNeedingResponse) {
    const text = (responseByRow[row.id] ?? "").trim();
    const itemId = row.itemId!.trim();
    const contentId = itemToContentId.get(itemId);
    if (!contentId) {
      warnings.push(`No database row for itemId "${itemId}" — generated response not saved.`);
      continue;
    }
    const put = await fetch(`/api/defect-files/content/${encodeURIComponent(contentId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: text }),
    });
    if (!put.ok) {
      const err = (await put.json().catch(() => ({}))) as { error?: string };
      warnings.push(`Response for ${itemId}: ${typeof err.error === "string" ? err.error : put.status}`);
      continue;
    }
    responsesPushed += 1;
  }

  return { strategiesPushed, responsesPushed, warnings };
}
