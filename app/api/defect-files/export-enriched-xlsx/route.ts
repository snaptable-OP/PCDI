import { NextRequest, NextResponse } from "next/server";
import {
  buildProposedResponseColumnHeader,
  enrichMergeXlsxWithResponseColumns,
} from "@/lib/pcdi/enrich-merge-xlsx-with-responses";
import { isMergeFileProxyAllowed } from "@/lib/pcdi/allowed-merge-fetch-url";

export const runtime = "nodejs";
export const maxDuration = 120;

type PatchIn = {
  sheetRow?: unknown;
  proposedResponse?: unknown;
};

function sanitizeFilenameBase(s: string): string {
  const t = s.trim().slice(0, 80);
  const cleaned = t.replace(/[^\w\- ().]+/g, "_").replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned : "export";
}

/** Downloads an S3-hosted XLSX (original upload URL), appends / updates the Proposed Response [date, time] column by sheet row. */
export async function POST(request: NextRequest) {
  let json: {
    sourceUrl?: unknown;
    headerRow?: unknown;
    patches?: unknown;
    downloadBasename?: unknown;
  };
  try {
    json = (await request.json()) as typeof json;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceUrlRaw = typeof json.sourceUrl === "string" ? json.sourceUrl.trim() : "";
  if (!sourceUrlRaw) {
    return NextResponse.json({ error: "sourceUrl is required" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(sourceUrlRaw);
  } catch {
    return NextResponse.json({ error: "Invalid sourceUrl" }, { status: 400 });
  }

  if (!isMergeFileProxyAllowed(url)) {
    return NextResponse.json({ error: "URL host is not allowed" }, { status: 403 });
  }

  const headerRowNum =
    typeof json.headerRow === "number" && Number.isFinite(json.headerRow) && json.headerRow >= 1
      ? Math.floor(json.headerRow)
      : 1;

  const patchesRaw = Array.isArray(json.patches) ? json.patches : [];
  const patches: { sheetRow: number; proposedResponse: string }[] = [];
  for (const p of patchesRaw as PatchIn[]) {
    const sr = p.sheetRow;
    const sheetRow =
      typeof sr === "number" && Number.isFinite(sr)
        ? Math.floor(sr)
        : typeof sr === "string" && /^\d+$/.test(sr.trim())
          ? parseInt(sr.trim(), 10)
          : NaN;
    if (!Number.isFinite(sheetRow) || sheetRow < 1) continue;
    patches.push({
      sheetRow,
      proposedResponse: typeof p.proposedResponse === "string" ? p.proposedResponse : "",
    });
  }

  let res: Response;
  try {
    res = await fetch(sourceUrlRaw, { cache: "no-store", redirect: "follow" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: `Could not download spreadsheet: ${msg}` }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `Spreadsheet HTTP ${res.status}` }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) {
    return NextResponse.json({ error: "Downloaded file is empty" }, { status: 502 });
  }

  const ExcelJS = (await import("exceljs")).default;

  let out: Buffer;
  try {
    const columnHeader = buildProposedResponseColumnHeader();
    out = await enrichMergeXlsxWithResponseColumns(buf, ExcelJS, {
      headerRow: headerRowNum,
      patches,
      columnHeader,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Excel processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const base =
    typeof json.downloadBasename === "string" && json.downloadBasename.trim()
      ? sanitizeFilenameBase(json.downloadBasename)
      : "defect-export";
  const filename = `${base}.xlsx`;

  return new NextResponse(new Uint8Array(out), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
