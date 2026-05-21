/** Max wait for async defect analysis (client status poll) and long-running server proxies. */
export const ANALYSIS_MAX_WAIT_MS = 15 * 60 * 1000;

/** Route `maxDuration` (seconds). Vercel Pro caps at 800; use literal in route files. */
export const ANALYSIS_MAX_DURATION_SEC = 800;

/** Interval between GET …/status polls from the column mapper. */
export const ANALYSIS_POLL_INTERVAL_MS = 3_000;

export function analysisPollMaxAttempts(
  maxWaitMs: number = ANALYSIS_MAX_WAIT_MS,
  intervalMs: number = ANALYSIS_POLL_INTERVAL_MS,
): number {
  return Math.ceil(maxWaitMs / intervalMs);
}
