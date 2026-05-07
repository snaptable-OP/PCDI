"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 2800;

/**
 * Shown at the top of the defect register while the prototype "runs AI" in the background.
 * Determinate bar fills over a few seconds, then dismisses.
 */
export function DefectsAnalysisProgress() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(100, (elapsed / DURATION_MS) * 100);
      setProgress(p);
      if (p < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => setVisible(false), 400);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="mb-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
      role="status"
      aria-live="polite"
      aria-label="Analysing defects with AI in the background"
    >
      <p className="text-sm font-medium text-[var(--foreground)]">Analysing defects with AI</p>
      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Background analysis in progress</p>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
        aria-hidden
      >
        <div
          className="h-full min-w-0 rounded-full bg-accent transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
