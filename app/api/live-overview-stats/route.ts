import { NextResponse } from "next/server";
import { getBillieBase } from "@/lib/billie/upstream-json";
import { defectRowsAndResponsesFromBillieDetail } from "@/lib/pcdi/live-overview-rollup";
import { extractDefectFileListFromProjectQueryBody } from "@/lib/pcdi/extract-backend-columns";
import { mapDefectProjectsResponseToHistorical } from "@/lib/pcdi/defect-project-api-map";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Cap Billie GET-by-id calls so the home page stays responsive with large tenants. */
const MAX_DEFECT_FILE_DETAIL_FETCHES = 160;
const DETAIL_CONCURRENCY = 10;

type FileTask = { projectId: string; id: string; isProcessed?: string };

async function fetchBillieJson(
  url: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(45_000) });
  } catch {
    return { ok: false, data: null, status: 0 };
  }
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  return { ok: res.ok, data, status: res.status };
}

function sortTasksForRollup(tasks: FileTask[]): FileTask[] {
  const rank = (s?: string): number => {
    const u = s?.toUpperCase() ?? "";
    if (u === "SUCCESS") return 0;
    if (u === "PROCESSING") return 1;
    if (u === "FAIL" || u === "FAILED") return 3;
    return 2;
  };
  return [...tasks].sort((a, b) => rank(a.isProcessed) - rank(b.isProcessed));
}

async function runPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;

  async function runWorker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await worker(items[i]!);
    }
  }

  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => runWorker()));
  return results;
}

/**
 * Aggregate counts across live defect projects: analyses (defect files), defect rows, response-rich rows.
 * Uses the same Billie proxy credentials as other `/api/defect-*` routes.
 */
export async function GET() {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({
      ok: true as const,
      stats: {
        projectsTotal: 0,
        analysesTotal: 0,
        defectItemsAnalysed: 0,
        responsesGenerated: 0,
      },
      meta: { skipped: true as const },
    });
  }

  const base = getBillieBase();
  const headers: Record<string, string> = {};
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const projUrl = `${base}/api/defect-projects`;
  const projRes = await fetchBillieJson(projUrl, headers);
  if (!projRes.ok) {
    return NextResponse.json(
      { error: "Could not load defect projects from the analysis server.", status: projRes.status },
      { status: 502 },
    );
  }

  const projects = mapDefectProjectsResponseToHistorical(projRes.data, "live");
  const projectsTotal = projects.length;

  const listResults = await Promise.all(
    projects.map(async (p) => {
      const url = `${base}/api/defect-files?projectId=${encodeURIComponent(p.id)}`;
      const r = await fetchBillieJson(url, headers);
      return { projectId: p.id, ...r };
    }),
  );

  const tasks: FileTask[] = [];
  let analysesTotal = 0;

  for (const lr of listResults) {
    if (!lr.ok || !lr.projectId) continue;
    const list = extractDefectFileListFromProjectQueryBody(lr.data);
    analysesTotal += list.length;
    for (const f of list) {
      tasks.push({ projectId: lr.projectId, id: f.id, isProcessed: f.isProcessed });
    }
  }

  const sorted = sortTasksForRollup(tasks).slice(0, MAX_DEFECT_FILE_DETAIL_FETCHES);
  const capped = tasks.length > MAX_DEFECT_FILE_DETAIL_FETCHES;

  let defectItemsAnalysed = 0;
  let responsesGenerated = 0;

  const detailPayloads = await runPool(sorted, DETAIL_CONCURRENCY, async (t) => {
    const proc = t.isProcessed?.toUpperCase() ?? "";
    if (proc === "FAIL" || proc === "FAILED") {
      return { defectRows: 0, responses: 0 };
    }
    const url = `${base}/api/defect-files/${encodeURIComponent(t.id)}`;
    const r = await fetchBillieJson(url, headers);
    if (!r.ok) {
      return { defectRows: 0, responses: 0 };
    }
    return defectRowsAndResponsesFromBillieDetail(r.data, t.projectId);
  });

  for (const d of detailPayloads) {
    defectItemsAnalysed += d.defectRows;
    responsesGenerated += d.responses;
  }

  return NextResponse.json({
    ok: true as const,
    stats: {
      projectsTotal,
      analysesTotal,
      defectItemsAnalysed,
      responsesGenerated,
    },
    meta: {
      defectFilesListed: tasks.length,
      detailFetches: sorted.length,
      capped,
    },
  });
}
