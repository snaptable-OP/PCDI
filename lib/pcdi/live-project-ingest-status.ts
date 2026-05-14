import type { HistoricalProject } from "@/lib/pcdi/types";

/**
 * Primary entry when opening a live project from the list: category mind map / defects view.
 * When Billie attaches a defect file id to the project row, preserve it so the mind map opens the same analysis
 * (multi-file projects otherwise rely on fuzzy “pick one file” hydration).
 */
export function liveProjectPrimaryHref(basePath: string, project: HistoricalProject): string {
  const path = `${basePath}/${project.id}/defects`;
  const fid = project.defectFileId?.trim();
  if (fid && !fid.startsWith("project:")) {
    return `${path}?defectFile=${encodeURIComponent(fid)}`;
  }
  return path;
}
