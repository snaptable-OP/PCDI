import type { HistoricalDefectTableRow } from "@/lib/pcdi/types";

/**
 * Rich mock register for the Connectivity Mind Graph — always used on the data visualisation page
 * so clusters stay visible regardless of upload state (draft / layout preview).
 */
export function getLiveVisualisationDemoRows(projectId: string): HistoricalDefectTableRow[] {
  const key = projectId.replace(/[^a-zA-Z0-9_-]/g, "") || "demo";

  const rows: Omit<HistoricalDefectTableRow, "id">[] = [
    // Water ingress — façade cavity (large cluster)
    {
      defectCategory: "Water ingress — façade cavity",
      defectDescription:
        "Moisture staining along cavity tray line at levels 8–10; weep holes intermittently bridged. NHBC 6.2 / CW warranty concern.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "NHBC Ch 6.2; CW spec §4.1",
      extractedDocCitations: "NHBC Chapter 6.2",
    },
    {
      defectCategory: "Water ingress — façade cavity",
      defectDescription:
        "External brick leaf saturation above podium slab cold bridge; condensation risk to MVHR lobby intake.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "CW manufacturer detail DWG-112",
      extractedDocCitations: "BS EN 13565",
    },
    {
      defectCategory: "Water ingress — façade cavity",
      defectDescription:
        "Sealant joint loss of adhesion — south elevation zone S4; hose test requested on sample bays.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "CW hose test protocol",
      extractedDocCitations: "CW spec §4.2",
    },
    {
      defectCategory: "Water ingress — façade cavity",
      defectDescription:
        "Perimeter cavity barrier continuity gap above podium steel shelf angle — breach of compartment line.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Approved Document B",
      extractedDocCitations: "AD B Vol 2",
    },
    {
      defectCategory: "Water ingress — façade cavity",
      defectDescription:
        "Rain penetration at parapet coping junction — trace to detailing vs tested CW zone.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "CW warranty letter",
      extractedDocCitations: "NHBC 6.2",
    },
    // Fire stopping — service penetrations
    {
      defectCategory: "Fire stopping — service penetrations",
      defectDescription:
        "FireStopping missing around cable bundles riser 03; intumescent pillows displaced during M&E change.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "BS EN 1366-3 test evidence pack",
      extractedDocCitations: "BS EN 1366-3",
    },
    {
      defectCategory: "Fire stopping — service penetrations",
      defectDescription:
        "Pipe penetration through rated wall — non-compliant foam only; engineer review requested.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Structural fire strategy FS-18",
      extractedDocCitations: "AS 4072.1",
    },
    {
      defectCategory: "Fire stopping — service penetrations",
      defectDescription:
        "Fire damper access panel sealed shut — maintenance route blocked; contravenes O&M access.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "O&M Vol 3 — dampers",
      extractedDocCitations: "AS 1668.1",
    },
    {
      defectCategory: "Fire stopping — service penetrations",
      defectDescription:
        "Cable tray penetration fire blanket omitted — photograph evidence from riser walk-down.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Fire engineer observation sheet",
      extractedDocCitations: "BS EN 1366-3",
    },
    // Steel connection — bolt slip
    {
      defectCategory: "Steel connection — bolt slip",
      defectDescription:
        "Beam splice bolt packs under-torqued per random audit; slip marks visible on web splice plates.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Structural calc SC-12 rev C",
      extractedDocCitations: "AS 4100",
    },
    {
      defectCategory: "Steel connection — bolt slip",
      defectDescription:
        "Column base pack thickness inconsistent — grout pad cracked; survey vs GA mismatch.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Steelwork GA bundle",
      extractedDocCitations: "EN 1090 execution class",
    },
    {
      defectCategory: "Steel connection — bolt slip",
      defectDescription:
        "Cross-bracing gusset weld toe cracks noted — NDT requested at splices per engineer.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "SI photo pack",
      extractedDocCitations: "AS 4100",
    },
    // Finishes — cracking
    {
      defectCategory: "Finishes — cracking",
      defectDescription:
        "Hairline cracking to skim coat at movement joint — cosmetic only; monitor after heating season.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Finishes spec FS-04",
      extractedDocCitations: "—",
    },
    {
      defectCategory: "Finishes — cracking",
      defectDescription:
        "Ceiling board screw pops along corridor grid — settlement suspected at partition junction.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Architect internal memo",
      extractedDocCitations: "—",
    },
    // M&E — ventilation imbalance (medium cluster)
    {
      defectCategory: "M&E — ventilation imbalance",
      defectDescription:
        "Condensation staining around MVHR terminals — imbalance suspected per commissioning summary.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "M&E commissioning cert Cx-77",
      extractedDocCitations: "BS 7671",
    },
    {
      defectCategory: "M&E — ventilation imbalance",
      defectDescription:
        "Duct leakage at kitchen extract riser — acoustic performance concern at party wall.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Acoustic report AR-104",
      extractedDocCitations: "CIBSE Guide B",
    },
    // Concrete — durability
    {
      defectCategory: "Concrete — durability",
      defectDescription:
        "Carbonation front depth at RC parapet edge — engineer sample locations logged.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Concrete durability SI-22",
      extractedDocCitations: "BS EN 1992-1-1",
    },
    {
      defectCategory: "Concrete — durability",
      defectDescription:
        "Cover meter readings below nominal to exposed edge beam — remedial proposal pending.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "Cover survey spreadsheet",
      extractedDocCitations: "Eurocode exposure class",
    },
    // Curtain wall — gasket shrinkage (single + satellite)
    {
      defectCategory: "Curtain wall — gasket shrinkage",
      defectDescription:
        "Curtain wall gaskets hardened / shrunk — south elevation zones S3–S5, water ingress risk.",
      historicalResponse: "",
      responseCategory: "",
      referenceDocuments: "CW spec §4.2",
      extractedDocCitations: "CW manufacturer O&M",
    },
  ];

  return rows.map((r, i) => ({
    ...r,
    id: `${key}-viz-demo-${i + 1}`,
  }));
}
