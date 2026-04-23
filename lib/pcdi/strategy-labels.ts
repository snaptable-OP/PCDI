/**
 * Strategy label strings (same order as MOCK_RESPONSE_CATEGORY_STRATEGIES in mock-data).
 * Isolated so defect-response-strategy-matrix does not import mock-data (avoids circular imports).
 */
export const STRATEGY_LABELS: readonly string[] = [
  "No Defect declaration",
  "Citation of test reports / standards",
  "Responsibility to Body Corporate",
  "Compliant with design / code",
  "Labelling requirement downgraded",
  "Evidence provided",
  "Not applicable / out of scope",
  "Referred to engineer",
  "Accessibility exemption",
  "Outside limitation period",
] as const;
