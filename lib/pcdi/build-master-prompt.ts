import { hashString } from "./hash";
import { extractStandardLikeReferences, textHasStandardLikeReferences } from "./mock-ai";
import type { AnalysisSession, AssetType, EnrichedDefectRow, StructuralType } from "./types";

/** Session fields injected as site/asset context in the master prompt. */
export type MasterPromptMetadata = Pick<
  AnalysisSession,
  "label" | "assetType" | "floorLevels" | "location" | "structuralType"
>;

export type PromptOutputRoute = "document_search_only" | "document_plus_onsite";

/**
 * Mock routing: first matching pattern wins; otherwise deterministic hash split.
 * Tuned so discovery-style labels from the graph map to plausible tracks.
 */
export const MOCK_RESPONSE_CATEGORY_ROUTE_RULES: ReadonlyArray<{
  pattern: RegExp;
  route: PromptOutputRoute;
}> = [
  {
    pattern:
      /\b(make\s+good\s+and\s+monitor|monitor\s+only|document\s+search|desk\s*[- ]?based|o\s*&\s*m|commissioning\s+cert)/i,
    route: "document_search_only",
  },
  {
    pattern:
      /\b(open\s+up|structural|nhbc|weathering|fire\s+stop|fire\s+barrier|re-?test|site\s+walk|survey|probe|opening\s+up|remediate\s+and)/i,
    route: "document_plus_onsite",
  },
  {
    pattern: /\b(general\s+remediation|unclassified\s+defect)/i,
    route: "document_search_only",
  },
];

export function mockRouteForResponseCategory(responseCategory: string): PromptOutputRoute {
  const label = responseCategory.trim();
  if (!label) {
    return "document_search_only";
  }
  for (const { pattern, route } of MOCK_RESPONSE_CATEGORY_ROUTE_RULES) {
    if (pattern.test(label)) return route;
  }
  const h = parseInt(hashString(label.toLowerCase()).slice(0, 8), 16) || 0;
  return h % 2 === 0 ? "document_search_only" : "document_plus_onsite";
}

function formatAssetType(a: AssetType): string {
  return a === "residential" ? "Residential" : "Commercial";
}

function formatStructural(s: StructuralType): string {
  const map: Record<StructuralType, string> = {
    steel: "Steel",
    concrete: "Concrete",
    timber: "Timber",
    masonry: "Masonry",
    mixed: "Mixed / hybrid",
  };
  return map[s];
}

function corpusForReferenceScan(rows: EnrichedDefectRow[]): string {
  return rows
    .map(
      (r) =>
        [r.defectDescription, r.historicalResponse, r.referenceDocumentName, r.referencesRequired].join(
          "\n",
        ),
    )
    .join("\n");
}

const EVIDENCE_TOLERANCE_PARAGRAPH = `Evidence & tolerance (standards-like references detected)
--------------------------------------------------------------------------------
The brief contains text that matches standard-like citation patterns (e.g. BS/BS EN, EN, ISO, PD, NHBC, CIBSE, Approved Documents). For those items:
- Anchor recommendations to the cited publication and clause where identifiable; flag uncertainty if only a partial reference is given.
- Express acceptance limits in the vocabulary of the controlling standard (structure, weathertightness, fire, services, finishes) and note where physical survey or testing would be needed to verify compliance.
- Prefer conservative interpretation when multiple standards could apply; call out conflicts explicitly.`;

function formatDefectBlock(row: EnrichedDefectRow): string {
  return [
    `Defect id: ${row.id}`,
    `  Defect description: ${row.defectDescription || "—"}`,
    `  Historical / contractor response: ${row.historicalResponse || "—"}`,
    `  Reference document name: ${row.referenceDocumentName || "—"}`,
    `  Defect category (graph): ${row.defectCategory || "—"}`,
    `  Response category (graph): ${row.responseCategory || "—"}`,
    `  References required (synthesised): ${row.referencesRequired || "—"}`,
  ].join("\n");
}

export type BuildMasterPromptInput = {
  metadata: MasterPromptMetadata;
  enrichedRows: EnrichedDefectRow[];
};

/**
 * Single master-agent prompt: injected site context, routing rules, optional standards/tolerance
 * block when regex-like references appear, and split work instructions by mock response-category route.
 */
export function buildMasterPrompt({ metadata, enrichedRows }: BuildMasterPromptInput): string {
  const refCorpus = corpusForReferenceScan(enrichedRows);
  const standardsLikely = textHasStandardLikeReferences(refCorpus);
  const uniqueRefs = standardsLikely
    ? [...new Set(extractStandardLikeReferences(refCorpus).map((m) => m.text))]
    : [];

  const docSearch: EnrichedDefectRow[] = [];
  const docOnsite: EnrichedDefectRow[] = [];
  for (const row of enrichedRows) {
    const route = mockRouteForResponseCategory(row.responseCategory);
    if (route === "document_search_only") docSearch.push(row);
    else docOnsite.push(row);
  }

  const routingKeyLines: string[] = [];
  const seen = new Set<string>();
  for (const row of enrichedRows) {
    const key = row.responseCategory.trim() || "(empty)";
    if (seen.has(key)) continue;
    seen.add(key);
    const route = mockRouteForResponseCategory(row.responseCategory);
    routingKeyLines.push(
      `  • "${key}" → ${route === "document_search_only" ? "Document search only" : "Document + on-site findings"}`,
    );
  }

  const lines: string[] = [
    "MASTER AGENT — RESOLV MACHINE CURRENT DEFECT BRIEF",
    "========================================",
    "",
    "Routing instruction",
    "--------------------",
    "You are the master analysis agent for a current-site defect register. Each defect is assigned ONE output track using the mock routing table keyed on Response Category (see end of prompt).",
    "• Document search only — Synthesise answers from drawings, specifications, submittals, test certificates, O&M, and correspondence. Do not assume new site visits unless the user explicitly adds that scope.",
    "• Document + on-site findings — Combine documentary sources with observations that imply or require verification on site (opening up, intrusive survey, specialist measurement, re-test).",
    "Follow the track per defect unless the user’s instructions explicitly override it.",
    "",
    "Injected context — site & asset",
    "-------------------------------",
    `  Session / site label: ${metadata.label}`,
    `  Asset type: ${formatAssetType(metadata.assetType)}`,
    `  Floor levels: ${metadata.floorLevels}`,
    `  Location: ${metadata.location}`,
    `  Primary structural system: ${formatStructural(metadata.structuralType)}`,
    "",
    "Enriched defect register",
    "------------------------",
  ];

  if (enrichedRows.length === 0) {
    lines.push("  (No defect rows are loaded in this session — complete upload, mapping, and enrichment to populate this section.)");
  } else {
    lines.push(...enrichedRows.map((row) => formatDefectBlock(row)), "");
  }

  lines.push("");

  if (standardsLikely) {
    lines.push(EVIDENCE_TOLERANCE_PARAGRAPH);
    if (uniqueRefs.length > 0) {
      lines.push("");
      lines.push(`Detected standard-like spans (deduped): ${uniqueRefs.slice(0, 24).join("; ")}${uniqueRefs.length > 24 ? " …" : ""}`);
    }
    lines.push("");
  }

  lines.push(
    "Work instructions by route (mock — Response Category)",
    "-------------------------------------------------------",
    "",
    "Track A — Document search only",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "For defects listed below, stay within documentary evidence. Note gaps where a drawing revision, test report, or formal response is missing.",
    "",
  );

  if (docSearch.length === 0) {
    lines.push("  (None under this track for the current register.)");
  } else {
    lines.push(...docSearch.map((row) => formatDefectBlock(row)));
  }

  lines.push(
    "",
    "Track B — Document + on-site findings",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "For defects listed below, integrate site-observable checks (visual, intrusive, or specialist) with document review. State what must be witnessed or measured on site to close the item.",
    "",
  );

  if (docOnsite.length === 0) {
    lines.push("  (None under this track for the current register.)");
  } else {
    lines.push(...docOnsite.map((row) => formatDefectBlock(row)));
  }

  lines.push(
    "",
    "Mock routing key (Response Category → track)",
    "--------------------------------------------",
    ...(routingKeyLines.length > 0
      ? routingKeyLines
      : ["  (No response categories in register yet.)"]),
    "",
    "Rules are defined in code (MOCK_RESPONSE_CATEGORY_ROUTE_RULES); unmatched labels split by deterministic hash for demo variety.",
  );

  return lines.join("\n");
}
