/**
 * strategy_taxonomy_v2 — authorized leaf labels (docs/strategy-taxonomy-v2-historical-matching-prompt.md).
 * Order matches the prompt: R1 → R9.
 */
export const STRATEGY_TAXONOMY_V2_OPTIONS: readonly string[] = [
  "R1.1 Tested System Compliance",
  "R1.2 Code Specification Compliance",
  "R1.3 Manufacturer Specification Compliance",
  "R1.4 Documentary Certification",
  "R1.5 Bare Assertion",
  "R2 BC Post-Completion",
  "R3.1 Routine Maintenance",
  "R3.2 Service Life / Weathering",
  "R4.1 Informative → No Defect",
  "R4.2 Informative → BC Responsibility",
  "R5 Accessibility Exclusion",
  "R6.1 Simple Concession",
  "R6.2 Qualified Concession",
  "R7.1 Specialist Referral",
  "R7.2 Scope Exclusion (contractual)",
  "R8 Scope Exclusion (technical applicability)",
  "R9 Outside Limitation Period",
] as const;

export const STRATEGY_TAXONOMY_V2_COUNT = STRATEGY_TAXONOMY_V2_OPTIONS.length;
