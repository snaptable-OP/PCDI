import { hashString } from "@/lib/pcdi/hash";

/**
 * Mock backend inference: document types typically needed to substantiate a response,
 * given defect category + selected response strategy. Replace with model / rules API.
 */
export function inferDocumentTypesFromCategoryAndStrategy(
  defectCategory: string,
  responseStrategy: string,
): string[] {
  const dc = defectCategory.trim().toLowerCase();
  const rs = responseStrategy.trim().toLowerCase();
  const bag = new Set<string>();

  const add = (s: string) => {
    const t = s.trim();
    if (t) bag.add(t);
  };

  if (/water|ingress|fa[cç]ade|weathertight|damp|cavity|curtain|glazing/i.test(dc)) {
    add("Façade / cladding specification & drawings");
    add("Weathertightness test reports & manufacturer warranty packs");
  }
  if (/fire|penetration|stop|barrier|intumescent/i.test(dc)) {
    add("Fire strategy & compartmentation drawings");
    add("Passive fire product test certificates & installation details");
  }
  if (/acoustic|sound|party/i.test(dc)) {
    add("Acoustic design report & site test certificates");
  }
  if (/steel|bolt|splice|structural|concrete|crack/i.test(dc)) {
    add("Structural engineer calculations & design assumptions");
  }
  if (/m&e|ventilation|mvhr|duct/i.test(dc)) {
    add("MEP design specification & commissioning records");
  }

  if (/test report|standard|nhbc|citation|bs\s*en/i.test(rs) || /citation|standard|nhbc/i.test(dc)) {
    add("Applicable building regulations & approved documents (as cited)");
  }
  if (/evidence|photo|form\s*11|excerpt/i.test(rs)) {
    add("Site QA records, photographs, and signed completion evidence");
  }
  if (/engineer|consultant/i.test(rs)) {
    add("Specialist consultant letter or design review correspondence");
  }
  if (/compliant|design|spec/i.test(rs)) {
    add("Contract specification & referenced drawing register");
  }
  if (/manufacturer|o\s*&\s*m|data sheet/i.test(rs)) {
    add("Manufacturer data sheets & test evidence for installed products");
  }

  if (bag.size === 0) {
    const h = parseInt(hashString(`${defectCategory}|${responseStrategy}`).slice(0, 8), 16) || 0;
    const fallback = [
      "Project specification & drawing register",
      "Relevant subcontractor warranties and test certificates",
      "Building control correspondence and condition sign-off records",
    ];
    add(fallback[h % fallback.length]);
  }

  return [...bag].slice(0, 6);
}
