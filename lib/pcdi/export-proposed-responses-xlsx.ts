import { resolveOriginalUploadSheetRow } from "@/lib/pcdi/live-source-row";
import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";
import { readUploadPayload } from "@/lib/pcdi/upload-session";

export type ExportProposedResponsesArgs = {
  projectId: string;
  defectFileId?: string | null;
  rows: HistoricalDefectTableRow[];
  generatedResponsesByRowId: Record<string, string>;
  downloadBasename?: string;
};

export type ExportProposedResponsesResult =
  | { ok: true; rowCount: number; withTextCount: number }
  | { ok: false; error: string };

/**
 * Builds patches from register rows + lifted generated-response map, POSTs to export API, triggers browser download.
 */
export async function downloadProposedResponsesEnrichedXlsx(
  args: ExportProposedResponsesArgs,
): Promise<ExportProposedResponsesResult> {
  const upload = readUploadPayload(args.projectId);
  const sourceUrl = (upload?.fileUrl ?? "").trim();
  const headerRow = upload?.headerRow ?? 1;

  if (!sourceUrl) {
    return {
      ok: false,
      error:
        "No original upload URL in this session. Upload the Excel again (or refresh after upload) so the presigned S3 link is available for export.",
    };
  }

  const patches = args.rows
    .map((r) => {
      const sheetRow = resolveOriginalUploadSheetRow(args.projectId, r.id, args.defectFileId);
      if (sheetRow == null || sheetRow < 1) return null;
      return {
        sheetRow,
        proposedResponse: args.generatedResponsesByRowId[r.id] ?? "",
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (patches.length === 0) {
    return {
      ok: false,
      error:
        "Could not map defects to rows on the original sheet — open the project from a Billie merge (row_number) or live upload so rows align.",
    };
  }

  const base =
    typeof args.downloadBasename === "string" && args.downloadBasename.trim()
      ? args.downloadBasename.trim().replace(/[^\w\- ().]+/g, "_").slice(0, 80)
      : "defect-proposed-responses";

  const res = await fetch("/api/defect-files/export-enriched-xlsx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceUrl,
      headerRow,
      patches,
      downloadBasename: base,
    }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: err.error ?? `Export failed (${res.status}).` };
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${base}.xlsx`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);

  const withTextCount = patches.filter((p) => p.proposedResponse.trim().length > 0).length;
  return { ok: true, rowCount: patches.length, withTextCount };
}
