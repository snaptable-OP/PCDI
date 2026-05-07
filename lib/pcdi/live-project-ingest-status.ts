import type { HistoricalProject } from "@/lib/pcdi/types";

/**
 * Primary entry when opening a live project from the list: category mind map / defects view.
 * Parsed rows are loaded on that route via GET defect-files (by project or defect file id), not from this link alone.
 */
export function liveProjectPrimaryHref(basePath: string, project: HistoricalProject): string {
  return `${basePath}/${project.id}/defects`;
}
