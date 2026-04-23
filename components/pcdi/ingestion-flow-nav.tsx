type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Create project" },
  { n: 2, label: "Project metadata" },
  { n: 3, label: "Upload & starting row" },
  { n: 4, label: "Column selection" },
];

type IngestionFlowNavProps = {
  /** Per-step page flow. Use `"all"` for the one-page setup (no step highlighted). */
  currentStep: Step | "all";
  className?: string;
};

/**
 * Shown on project ingest screens so the sequence is obvious: name → metadata → upload → columns.
 */
export function IngestionFlowNav({ currentStep, className = "" }: IngestionFlowNavProps) {
  const singlePage = currentStep === "all";
  return (
    <nav aria-label="Ingestion progress" className={className}>
      {singlePage ? (
        <p className="text-xs text-[var(--muted-foreground)] sm:text-sm">
          <span className="font-medium text-[var(--foreground)]">Single-page setup.</span> Complete all four
          blocks in order, then go to the register.
        </p>
      ) : null}
      <ol className={`${singlePage ? "mt-2 " : ""}flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-sm`}>
        {STEPS.map(({ n, label }, i) => {
          const done = !singlePage && n < (currentStep as Step);
          const active = !singlePage && n === (currentStep as Step);
          return (
            <li key={n} className="flex min-w-0 items-center gap-2 sm:gap-3">
              {i > 0 ? <span className="text-[var(--muted-foreground)]" aria-hidden>→</span> : null}
              <span
                className={
                  singlePage
                    ? "text-[var(--muted-foreground)]"
                    : active
                      ? "font-semibold text-teal-800 dark:text-teal-200"
                      : done
                        ? "text-[var(--muted-foreground)]"
                        : "text-[var(--muted-foreground)]/80"
                }
              >
                <span className="tabular-nums">{n}.</span> {label}
                {active ? <span className="sr-only"> (current step)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
