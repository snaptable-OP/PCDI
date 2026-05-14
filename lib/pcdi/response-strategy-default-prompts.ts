import { STRATEGY_TAXONOMY_V2_OPTIONS } from "@/lib/pcdi/strategy-taxonomy-v2-labels";

/**
 * Default instruction prompts for each strategy_taxonomy_v2 label (response strategy agents).
 * Shown when the user picks a strategy; they can edit before saving.
 */
export const RESPONSE_STRATEGY_DEFAULT_PROMPTS = {
  "R1.1 Tested System Compliance":
    "Draft a response that relies on tested-system evidence (commissioning records, witness tests, performance certificates). Cite only material from the linked knowledge folder that directly supports compliance with the specified system or installation. State conclusions clearly and avoid arguing beyond what the test evidence shows.",

  "R1.2 Code Specification Compliance":
    "Draft a response grounded in applicable codes, standards, and statutory guidance. Use the knowledge folder to reference clauses or sections that support compliance or partial compliance. Distinguish mandatory requirements from guidance. Keep tone factual and proportionate to the defect described.",

  "R1.3 Manufacturer Specification Compliance":
    "Draft a response that follows manufacturer installation, maintenance, and product literature. Pull specifics (limits, tolerances, compatible products) from the knowledge folder where available. If the manufacturer is silent on the point, say so plainly rather than inferring.",

  "R1.4 Documentary Certification":
    "Draft a response that leans on formal certification, accreditation, or third-party verification documents in the knowledge folder. Tie each claim to a named document or certificate. Do not treat informal emails as equivalent to certified evidence unless the contract clearly allows it.",

  "R1.5 Bare Assertion":
    "The counterparty may have asserted a position without supporting evidence. Draft a measured response that (1) identifies what is asserted, (2) asks for or notes the absence of substantiation, and (3) states our position only where we have folder-backed facts. Avoid aggressive tone; focus on burden and traceability.",

  "R2 BC Post-Completion":
    "Frame the response around post-completion building control / statutory context. Use the knowledge folder for relevant notices, completion certificates, or correspondence timelines. Separate statutory obligations from contractual ones and avoid conflating the two.",

  "R3.1 Routine Maintenance":
    "Explain that the issue falls within ordinary maintenance or user care, not a defect in design or workmanship. Reference maintenance schedules, O&M manuals, or similar material from the knowledge folder. Be specific about frequency, responsibility, and exclusions.",

  "R3.2 Service Life / Weathering":
    "Address normal ageing, weathering, or end-of-service-life behaviour. Use the knowledge folder for durability statements, warranties, or industry norms where helpful. Acknowledge appearance or performance changes that are expected rather than defect-driven.",

  "R4.1 Informative → No Defect":
    "Treat the item as informative or observational only—not an admission of defect. Draft concise wording that closes the loop without accepting liability. Use the knowledge folder only to clarify context or standards, not to concede fault.",

  "R4.2 Informative → BC Responsibility":
    "Acknowledge the observation but allocate statutory or procedural follow-up to building control (or the appropriate authority) where the knowledge folder supports that split. Do not volunteer contractor rework unless documents clearly require it.",

  "R5 Accessibility Exclusion":
    "Draft a response where accessibility is expressly excluded or governed by a separate regime. Cite contract clauses or guidance from the knowledge folder that define the exclusion or referral route. Remain respectful of accessibility concerns while holding the contractual line.",

  "R6.1 Simple Concession":
    "Prepare a straightforward concession: what we will do, by when, and any limits. Keep language unqualified except where the folder or contract requires conditions. Avoid opening unrelated topics.",

  "R6.2 Qualified Concession":
    "Prepare a concession that is explicitly conditional (e.g. access, weather, confirmation of scope). List conditions and dependencies drawn from the knowledge folder or contract. Make clear what happens if conditions are not met.",

  "R7.1 Specialist Referral":
    "Defer technical resolution to an appropriate specialist trade or consultant. Summarise facts only; avoid diagnosing outside competence. Use the knowledge folder for appointment letters, scopes, or warranty referral terms if present.",

  "R7.2 Scope Exclusion (contractual)":
    "Argue contractual scope exclusion: show the works package boundaries and exclusions from the knowledge folder (contracts, scopes, tender clarifications). Map the reported issue to the excluded package without overstating.",

  "R8 Scope Exclusion (technical applicability)":
    "Argue technical non-applicability (wrong system, wrong element, or not part of our delivery). Reference drawings, specifications, or as-builts from the knowledge folder. Stay technical and specific—avoid generic denials.",

  "R9 Outside Limitation Period":
    "Respond on limitation or contractual time-bar grounds. Reference dates of practical completion, notifications, or policy from the knowledge folder. If dates are incomplete, note what is needed to confirm—do not guess dates.",
} as const satisfies Record<(typeof STRATEGY_TAXONOMY_V2_OPTIONS)[number], string>;

export function getDefaultPromptForResponseStrategy(strategy: string): string {
  const s = strategy.trim();
  if (!s) return "";
  const hit = RESPONSE_STRATEGY_DEFAULT_PROMPTS[s as keyof typeof RESPONSE_STRATEGY_DEFAULT_PROMPTS];
  return typeof hit === "string" ? hit : "";
}
