import "server-only";
import { Agent } from "undici";
import { ANALYSIS_MAX_WAIT_MS } from "@/lib/pcdi/analysis-timeouts";

/** Same cap as client analysis poll (saveExcelContent, etc.). */
export const BILLIE_LONG_RUNNING_MS = ANALYSIS_MAX_WAIT_MS;

const longRunningAgent = new Agent({
  connectTimeout: 60_000,
  headersTimeout: BILLIE_LONG_RUNNING_MS,
  bodyTimeout: BILLIE_LONG_RUNNING_MS,
});

/**
 * fetch() to the analysis server with extended timeouts (saveExcelContent on big workbooks).
 * Pair with `export const maxDuration = 900` on the route handler.
 */
export function billieLongRunningFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(BILLIE_LONG_RUNNING_MS);
  const signal =
    init.signal != null
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
  return fetch(url, {
    ...init,
    signal,
    dispatcher: longRunningAgent,
  } as RequestInit & { dispatcher: Agent });
}
