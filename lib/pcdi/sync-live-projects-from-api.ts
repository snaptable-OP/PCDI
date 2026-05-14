import { useHistoricalProjectsStore } from "@/lib/pcdi/projects-store";
import type { HistoricalProject } from "@/lib/pcdi/types";

const SYNC_TIMEOUT_MS = 18_000;

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === "AbortError") ||
    (typeof e === "object" &&
      e !== null &&
      "name" in e &&
      (e as { name?: string }).name === "AbortError")
  );
}

/**
 * Fetches live defect projects from `GET /api/defect-projects` and replaces the in-memory live module list.
 * Used by the live project table and the global project selector.
 */
export async function syncLiveProjectsFromApi(signal?: AbortSignal): Promise<{
  ok: boolean;
  error?: string;
}> {
  const controller = signal ? null : new AbortController();
  const timeoutId =
    controller !== null
      ? window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS)
      : undefined;
  const sig = signal ?? controller!.signal;
  try {
    const res = await fetch("/api/defect-projects", {
      cache: "no-store",
      signal: sig,
    });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      projects?: HistoricalProject[];
    };
    if (!res.ok) {
      return { ok: false, error: body.error ?? "Could not load projects from the analysis server." };
    }
    const list = Array.isArray(body.projects) ? body.projects : [];
    useHistoricalProjectsStore.getState().replaceProjectsForModule("live", list);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: isAbortError(e)
        ? "Timed out waiting for the analysis server. Check BILLIE_API_BASE / network, or try again."
        : "Could not load projects from the analysis server.",
    };
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
}
