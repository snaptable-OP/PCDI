import { getCandidateStrategiesForDefectCategory } from "@/lib/pcdi/defect-response-strategy-matrix";
import { extractDocCitationsFromDefectDescription } from "./extract-doc-citations";
import { buildLiveReferencesDocsColumn } from "./live-mock-reference-citations";
import type {
  AnalysisModule,
  AnalysisSession,
  DiscoveryCategorySuggestion,
  EnrichedDefectRow,
  HistoricalDefectTableRow,
  HistoricalProject,
} from "./types";

export const seedProjects: HistoricalProject[] = [
  {
    id: "seed-proj-riverside",
    name: "Riverside Tower — Phase 2",
    assetType: "residential",
    floorLevels: "G + 24",
    location: "London",
    structuralType: "concrete",
    createdAt: "2025-11-02T09:00:00.000Z",
    analysisModule: "historical",
  },
  {
    id: "seed-proj-harbour",
    name: "Harbour Works — Shell & core",
    assetType: "commercial",
    floorLevels: "B2 + 8",
    location: "Bristol",
    structuralType: "steel",
    createdAt: "2025-10-18T14:30:00.000Z",
    analysisModule: "historical",
  },
];

export const seedSessions: AnalysisSession[] = [
  {
    id: "seed-sess-alpha",
    label: "Site walk — Block A",
    status: "in_progress",
    assetType: "residential",
    floorLevels: "G + 12",
    location: "Manchester",
    structuralType: "masonry",
    createdAt: "2026-01-10T11:00:00.000Z",
    updatedAt: "2026-01-11T08:15:00.000Z",
  },
  {
    id: "seed-sess-beta",
    label: "Handover defects — retail",
    status: "draft",
    assetType: "commercial",
    floorLevels: "G + 3",
    location: "Leeds",
    structuralType: "mixed",
    createdAt: "2026-02-01T16:45:00.000Z",
    updatedAt: "2026-02-01T16:45:00.000Z",
  },
];

/**
 * Contractor response taxonomy (mock) — strategy names, signals, and example wording.
 * Source: strategy list provided for Historical Core prototypes.
 */
export type MockResponseCategoryStrategy = {
  strategy: string;
  keywordsSignals: string;
  typicalExample: string;
};

export const MOCK_RESPONSE_CATEGORY_STRATEGIES: MockResponseCategoryStrategy[] = [
  {
    strategy: "No Defect declaration",
    keywordsSignals: '"No defect"',
    typicalExample:
      "No defect, bulkhead has been mastic sealed as per tested system detail.",
  },
  {
    strategy: "Citation of test reports / standards",
    keywordsSignals: "FAS report numbers, BCA/NCC, Section C3.15, AS 4072.1",
    typicalExample:
      "...as per the tested system detail FAS 190202 R4.4, as required under BCA Volume 1, Section C3.15.",
  },
  {
    strategy: "Responsibility to Body Corporate",
    keywordsSignals: '"body corporate", "BC", "maintenance"',
    typicalExample: "Post completion works, however require fire sealing by the BC.",
  },
  {
    strategy: "Compliant with design / code",
    keywordsSignals: '"as per design", "in accordance", "compliant"',
    typicalExample: "Compliant installation as per hydraulic design.",
  },
  {
    strategy: "Labelling requirement downgraded",
    keywordsSignals: '"informative not mandatory", "label", "tagging"',
    typicalExample:
      "The labelling aspect of A.S. 4072.1 is informative not mandatory.",
  },
  {
    strategy: "Evidence provided",
    keywordsSignals: '"see below", "photo", "form 11", "excerpt"',
    typicalExample: "No defect, see below: [excerpt from form 11]",
  },
  {
    strategy: "Not applicable / out of scope",
    keywordsSignals: '"not required", "same compartment", "not a penetration"',
    typicalExample:
      "No defect, this part of the wall is the same compartment. Fire rating not required.",
  },
  {
    strategy: "Referred to engineer",
    keywordsSignals: '"engineer", "hydraulic", "fire engineer"',
    typicalExample: "Hydraulic engineer to comment.",
  },
  {
    strategy: "Accessibility exemption",
    keywordsSignals: '"non-accessible", "not accessible", "riser"',
    typicalExample:
      "Any risers which are non-accessible do not require the insulation criteria to be enforced under the BCA.",
  },
  {
    strategy: "Outside limitation period",
    keywordsSignals: '"out of time", "statute", "limitation"',
    typicalExample: "None structural defect out of time.",
  },
];

/** Ordered strategy labels for dropdowns, discovery, and register mock data. */
export const MOCK_RESPONSE_CATEGORY_STRATEGY_LABELS: string[] =
  MOCK_RESPONSE_CATEGORY_STRATEGIES.map((s) => s.strategy);

/** Typical first-row headers from a defects spreadsheet (upload stub). */
export const sampleSpreadsheetColumns: string[] = [
  "Defect ID",
  "Location / Zone",
  "Defect description",
  "Contractor response",
  "Photo ref",
  "Spec / drawing ref",
  "Closing notes",
];

/** Mock AI output for discovery step — editable in UI later. */
export const discoverySuggestionsByProject: Record<string, DiscoveryCategorySuggestion> = {
  "seed-proj-riverside": {
    defectCategories: [
      "Water ingress — façade cavity",
      "Fire stopping — service penetrations",
      "Acoustic bridging — party floor",
    ],
    responseCategories: [
      "Citation of test reports / standards",
      "Evidence provided",
      "Compliant with design / code",
    ],
    referenceDocuments: ["NHBC Chapter 6.2", "BS EN 1366-3", "Acoustic report AR-104"],
  },
  "seed-proj-harbour": {
    defectCategories: ["Steel connection — bolt slip", "Curtain wall — gasket shrinkage"],
    responseCategories: ["Referred to engineer", "Compliant with design / code"],
    referenceDocuments: ["Structural calc SC-12", "CW spec §4.2"],
  },
  default: {
    defectCategories: ["Finishes — cracking", "M&E — ventilation imbalance"],
    responseCategories: [...MOCK_RESPONSE_CATEGORY_STRATEGY_LABELS],
    referenceDocuments: ["O&M manual Vol 2"],
  },
};

export function getDiscoverySuggestions(projectId: string): DiscoveryCategorySuggestion {
  return discoverySuggestionsByProject[projectId] ?? discoverySuggestionsByProject.default;
}

/** Per knowledge-map category: how many register rows matched (mock preview for Discover Categories). */
export type KnowledgeMapMatchRow = {
  knowledgeMapCategory: string;
  matchedRowCount: number;
};

export type DiscoverCategoriesKmMatchMock = {
  defect: KnowledgeMapMatchRow[];
  response: KnowledgeMapMatchRow[];
};

/**
 * Mock breakdown for the “Compared to the knowledge map” panel — demonstrates which existing
 * categories registered hits and row counts until a backend supplies real aggregation.
 */
export const discoverCategoriesKmMatchMockByProject: Record<string, DiscoverCategoriesKmMatchMock> = {
  "seed-proj-riverside": {
    defect: [
      { knowledgeMapCategory: "Water ingress — façade cavity", matchedRowCount: 1 },
      { knowledgeMapCategory: "Fire stopping — service penetrations", matchedRowCount: 1 },
      { knowledgeMapCategory: "Acoustic bridging — party floor", matchedRowCount: 1 },
    ],
    response: [
      { knowledgeMapCategory: "Citation of test reports / standards", matchedRowCount: 1 },
      { knowledgeMapCategory: "Evidence provided", matchedRowCount: 1 },
      { knowledgeMapCategory: "Compliant with design / code", matchedRowCount: 1 },
    ],
  },
  "seed-proj-harbour": {
    defect: [
      { knowledgeMapCategory: "Steel connection — bolt slip", matchedRowCount: 1 },
      { knowledgeMapCategory: "Curtain wall — gasket shrinkage", matchedRowCount: 1 },
    ],
    response: [
      { knowledgeMapCategory: "Referred to engineer", matchedRowCount: 1 },
      { knowledgeMapCategory: "Compliant with design / code", matchedRowCount: 1 },
    ],
  },
  default: {
    defect: [
      { knowledgeMapCategory: "Finishes — cracking", matchedRowCount: 2 },
      { knowledgeMapCategory: "M&E — ventilation imbalance", matchedRowCount: 2 },
      { knowledgeMapCategory: "Concrete — durability", matchedRowCount: 1 },
    ],
    response: [
      { knowledgeMapCategory: "No Defect declaration", matchedRowCount: 2 },
      { knowledgeMapCategory: "Citation of test reports / standards", matchedRowCount: 2 },
      { knowledgeMapCategory: "Evidence provided", matchedRowCount: 2 },
      { knowledgeMapCategory: "Compliant with design / code", matchedRowCount: 2 },
      { knowledgeMapCategory: "Referred to engineer", matchedRowCount: 1 },
    ],
  },
};

export function getDiscoverCategoriesKmMatchMock(projectId: string): DiscoverCategoriesKmMatchMock {
  return discoverCategoriesKmMatchMockByProject[projectId] ?? discoverCategoriesKmMatchMockByProject.default;
}

/** Curated register rows for demo seed projects (categories align with discovery suggestions). */
const HISTORICAL_DEFECT_REGISTER_SEED: Record<string, HistoricalDefectTableRow[]> = {
  "seed-proj-riverside": [
    {
      id: "rv-1",
      defectDescription:
        "Staining and elevated damp readings along cavity tray line — grids D4–E4, levels 8–12.",
      historicalResponse:
        "Remediation as per tested system detail FAS 190202 R4.4 and NHBC Chapter 6.2 / weathertightness scope (BCA/NCC Section C3.15 alignment on site).",
      defectCategory: "Water ingress — façade cavity",
      responseCategory: "Citation of test reports / standards",
      referenceDocuments: "NHBC Chapter 6.2; BS EN 1366-3 (fire stopping interface)",
    },
    {
      id: "rv-2",
      defectDescription:
        "Incomplete fire stopping around MEP penetrations — risers R12 / R14, levels 4–6.",
      historicalResponse:
        "Open up, photograph, reinstate fire barrier to NHBC detail; sign-off by FR consultant — evidence pack on Form 11 excerpt attached.",
      defectCategory: "Fire stopping — service penetrations",
      responseCategory: "Evidence provided",
      referenceDocuments: "NHBC Chapter 6.2; Approved Document B (fire safety)",
    },
    {
      id: "rv-3",
      defectDescription:
        "Impact sound failures on party floor — apartment stack 08 vs 09, FFT test Ln,w 64 dB.",
      historicalResponse:
        "Compliant installation path: isolate services runs; acoustic infill per spec; re-test after make-good.",
      defectCategory: "Acoustic bridging — party floor",
      responseCategory: "Compliant with design / code",
      referenceDocuments: "Acoustic report AR-104; Building Regs Part E",
    },
  ],
  "seed-proj-harbour": [
    {
      id: "hb-1",
      defectDescription:
        "Visual slip at primary steel splice — gridline B2, level 03, bolts below torque spec.",
      historicalResponse:
        "Structural engineer review; torque check all splices in run; replace non-conforming bolts.",
      defectCategory: "Steel connection — bolt slip",
      responseCategory: "Referred to engineer",
      referenceDocuments: "Structural calc SC-12; BS EN 1090 execution record",
    },
    {
      id: "hb-2",
      defectDescription:
        "Curtain wall gaskets hardened / shrunk — south elevation zones S3–S5, water ingress risk.",
      historicalResponse:
        "Replace gasket sets per CW spec; hose test sample bays before full replacement — compliant with curtain wall design.",
      defectCategory: "Curtain wall — gasket shrinkage",
      responseCategory: "Compliant with design / code",
      referenceDocuments: "CW spec §4.2; CW manufacturer O&M",
    },
  ],
};

function buildSyntheticRegisterRows(projectId: string): HistoricalDefectTableRow[] {
  const s = getDiscoverySuggestions(projectId);
  const defectCats = s.defectCategories.length > 0 ? s.defectCategories : ["Unclassified defect"];
  const responseCats =
    s.responseCategories.length > 0
      ? s.responseCategories
      : MOCK_RESPONSE_CATEGORY_STRATEGY_LABELS.slice(0, 3);
  const refs = s.referenceDocuments.length > 0 ? s.referenceDocuments : ["Site records"];
  const n = Math.max(defectCats.length, responseCats.length, 2);
  const rows: HistoricalDefectTableRow[] = [];
  for (let i = 0; i < n; i++) {
    const dc = defectCats[i % defectCats.length];
    const rc = responseCats[i % responseCats.length];
    const rf = refs[i % refs.length];
    rows.push({
      id: `${projectId}-synth-${i + 1}`,
      defectDescription: `Recorded condition for “${dc}”. Mock register narrative for this project (prototype data).`,
      historicalResponse: `Recorded contractor / consultant response aligned with “${rc}”.`,
      defectCategory: dc,
      responseCategory: rc,
      referenceDocuments: rf,
    });
  }
  return rows;
}

/** Full defect register — mock data keyed by project. */
export function getHistoricalDefectTableRows(projectId: string): HistoricalDefectTableRow[] {
  const curated = HISTORICAL_DEFECT_REGISTER_SEED[projectId];
  if (curated && curated.length > 0) return curated;
  return buildSyntheticRegisterRows(projectId);
}

/** Live projects: defect list only — response / strategy columns left empty for AI to suggest (prototype clears mock responses). */
export function getDefectTableRowsForModule(
  projectId: string,
  module: AnalysisModule,
): HistoricalDefectTableRow[] {
  const rows = getHistoricalDefectTableRows(projectId);
  if (module === "historical") return rows;
  return rows.map((r, i) => {
    const pool = getCandidateStrategiesForDefectCategory(r.defectCategory);
    const strategy = pool[0] ?? "N/A";
    const references = buildLiveReferencesDocsColumn({
      projectId,
      rowIndex: i,
      defectCategory: r.defectCategory,
      responseStrategy: strategy,
      extractedFromDescription: extractDocCitationsFromDefectDescription(r.defectDescription),
    });
    return {
      ...r,
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: references,
      extractedDocCitations: references,
    };
  });
}

export const enrichedRowFixtures: EnrichedDefectRow[] = [
  {
    id: "enr-1",
    defectDescription: "Horizontal crack to RC parapet — south elevation",
    historicalResponse: "Structural engineer review; carbon fibre banding proposed",
    referenceDocumentName: "SI-2024-08",
    defectCategory: "Concrete — cracking",
    responseCategory: "Referred to engineer",
    referencesRequired: "BS EN 1992-1-1; engineer calc pack",
  },
  {
    id: "enr-2",
    defectDescription: "Condensation staining around MVHR terminals",
    historicalResponse:
      "Insulation continuity verified per commissioning cert excerpt; duct insulation upgraded.",
    referenceDocumentName: "M&E commissioning cert Cx-77",
    defectCategory: "Building services — ventilation",
    responseCategory: "Evidence provided",
    referencesRequired: "BS 7671; CIBSE Guide B",
  },
];
