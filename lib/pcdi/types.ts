/** Residential vs commercial asset (project metadata). */
export type AssetType = "residential" | "commercial";

/** Primary structural system for the building / works. */
export type StructuralType =
  | "steel"
  | "concrete"
  | "timber"
  | "masonry"
  | "mixed";

/**
 * Active ingest: defect_description, historical_response, reference_document_name, unmapped
 */
export type PcdiMappedField =
  | "defect_description"
  | "historical_response"
  | "reference_document_name"
  | "unmapped";

/** Historical Core: which AI outputs a source column feeds (zero or more per column). */
export type HistoricalAiTarget =
  | "ai_defect_category"
  | "ai_response_category"
  | "ai_reference_documents";

/** Per spreadsheet column, list of AI extractions to parse from that column (may be empty). */
export type HistoricalColumnAiMapping = Record<string, HistoricalAiTarget[]>;

/** Knowledge graph node categories (colour legend in UI). */
export type PcdiGraphNodeKind =
  | "defect_category"
  | "response_category"
  | "reference_doc";

/**
 * Edge semantics for mock graph — kept explicit for styling / filtering later.
 * - correlation: defect ↔ response association from discovery
 * - taxonomy: grouping / hierarchy (reserved)
 * - reference_link: response ↔ document or defect ↔ document
 */
export type PcdiEdgeType = "correlation" | "taxonomy" | "reference_link";

/** Payload on React Flow nodes (`Node<PcdiNodeData>`). */
export type PcdiNodeData = {
  kind: PcdiGraphNodeKind;
  label: string;
  /** Optional provenance when ingested from discovery. */
  sourceProjectId?: string;
  /** Knowledge map: precomputed category-graph fill (array order, not hash). */
  bubbleFill?: string;
};

/** Payload on React Flow edges (`Edge<PcdiEdgeData>`). */
export type PcdiEdgeData = {
  kind: PcdiEdgeType;
};

/** Domain-level node (compatible with RF `Node` `id` + `data`). */
export type PcdiGraphNode = {
  id: string;
  data: PcdiNodeData;
};

export type PcdiGraphEdge = {
  id: string;
  source: string;
  target: string;
  data: PcdiEdgeData;
};

/** Which defect-analysis workflow a project belongs to (stored with the project). */
export type AnalysisModule = "historical" | "live";

export type HistoricalProject = {
  id: string;
  name: string;
  assetType: AssetType;
  floorLevels: string;
  location: string;
  structuralType: StructuralType;
  createdAt: string;
  /** Historical: full register + Discover Categories + KM. Live: defect upload for AI response suggestions — export & prompt. */
  analysisModule: AnalysisModule;
  /**
   * Live / Billie: primary defect spreadsheet record on the analysis server (GET /api/defect-files/:id).
   * Returned with GET /api/defect-projects when the backend includes it.
   */
  defectFileId?: string;
};

/** One row in the Historical Core defect register (mock ingest / discovery output). */
export type HistoricalDefectTableRow = {
  id: string;
  defectDescription: string;
  historicalResponse: string;
  defectCategory: string;
  responseCategory: string;
  /** Specs, reports, or drawing refs tied to the row (may list several). */
  referenceDocuments: string;
  /**
   * Live analysis: standards / publication-like citations parsed from the defect description text (mock extraction).
   */
  extractedDocCitations?: string;
  /**
   * Billie AI merge: strategy_taxonomy_v2 labels suggested for this row (subset of STRATEGY_TAXONOMY_V2_OPTIONS).
   */
  aiSuggestedStrategies?: string[];
  /**
   * Canonical taxonomy labels parsed only from the `response_strategy` column (spreadsheet row / API).
   * Defect sidebar “Data-suggested strategies” uses this field — not category heuristics or full-row scans.
   */
  responseStrategyTaxonomy?: string[];
  /**
   * 1-based worksheet row in the **original** upload to highlight in the Excel preview.
   * Prefer the merged export’s `row_number` (or Billie API field) when present; otherwise the physical row in the merged sheet.
   */
  excelSheetRow?: number;
  /**
   * Billie defect-file content key (`itemId`) for batch strategy / response saves — from API or merged column like `item_id`.
   */
  itemId?: string;
};

export type AnalysisSessionStatus = "draft" | "in_progress" | "complete";

export type AnalysisSession = {
  id: string;
  label: string;
  status: AnalysisSessionStatus;
  /** Mirrors historical metadata for active flow */
  assetType: AssetType;
  floorLevels: string;
  location: string;
  structuralType: StructuralType;
  createdAt: string;
  updatedAt: string;
};

/** Row shape after enrichment (mock AI + graph). */
export type EnrichedDefectRow = {
  id: string;
  defectDescription: string;
  historicalResponse: string;
  referenceDocumentName: string;
  defectCategory: string;
  responseCategory: string;
  referencesRequired: string;
};

export type DiscoveryCategorySuggestion = {
  defectCategories: string[];
  responseCategories: string[];
  referenceDocuments: string[];
};

export type SpreadsheetColumnMapping = Record<string, PcdiMappedField>;

/** Parsed upload stored in sessionStorage between upload → map-columns. */
export type PcdiUploadSessionPayload = {
  projectId: string;
  fileName: string;
  /** 1-based Excel row used as the header row when extracting column names. */
  headerRow: number;
  columns: string[];
  /**
   * Live analysis: data rows under the header (Live module only).
   * Keys are spreadsheet column headers; used with column mapping to build rows + mock AI categories.
   */
  dataRows?: Record<string, string>[];
  /** Set when the same file was stored on S3 via /api/upload-xlsx (server). */
  s3Bucket?: string;
  s3Key?: string;
  s3Region?: string;
  /**
   * Time-limited HTTPS URL to download the uploaded file (for backend / pipeline).
   * From POST /api/upload-xlsx; duration controlled by S3_PRESIGN_TTL_SECONDS.
   */
  fileUrl?: string;
  presignedUrlExpiresInSeconds?: number;
  /** Returned by the analysis backend after saveExcelContent / parse registration. */
  defectFileId?: string;
};

/** Active Analysis upload payload (sessionStorage before map-columns). */
export type PcdiActiveUploadSessionPayload = {
  sessionId: string;
  fileName: string;
  headerRow: number;
  columns: string[];
  /** Data rows under the header row, keyed by column header label (same keys as `columns`). */
  dataRows?: Record<string, string>[];
};
