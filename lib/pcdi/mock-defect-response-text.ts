/**
 * Deterministic two-line mock “AI” defect responses for the live sidebar demo.
 * Tone: register-style “No defect …” + cited assessment / report line (see product examples).
 */

export type MockDefectResponseInput = {
  defectCategory: string;
  defectDescription: string;
  strategyLabel: string;
  variant: number;
};

function stableHash(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 131 + s.charCodeAt(i)) | 0;
  return n;
}

function pick(seed: number, salt: number, arr: readonly string[]): string {
  if (arr.length === 0) return "";
  return arr[Math.abs(seed + salt * 503) % arr.length]!;
}

export function defectMockResponsePoolKey(category: string): string {
  const c = category.trim().toLowerCase();
  if (!c || c.includes("unclass")) return "generic";
  if (c.includes("fire") || c.includes("stopping") || c.includes("penetration")) return "fire";
  if (
    c.includes("water") ||
    c.includes("ingress") ||
    c.includes("façade") ||
    c.includes("facade") ||
    c.includes("cavity") ||
    c.includes("rainscreen") ||
    c.includes("weather")
  ) {
    return "water";
  }
  if (c.includes("acoustic")) return "acoustic";
  if (c.includes("steel") || c.includes("bolt") || c.includes("connection") || c.includes("splice")) {
    return "steel";
  }
  if (c.includes("curtain") || c.includes("gasket") || c.includes("glazing") || c.includes("spandrel")) {
    return "curtain";
  }
  if (c.includes("finishes") || c.includes("crack") || c.includes("plaster")) return "finishes";
  if (c.includes("m&e") || c.includes("ventilation") || c.includes("hvac") || c.includes("mechanical")) {
    return "mechanical";
  }
  if (c.includes("concrete") || c.includes("durability") || c.includes("cover")) return "concrete";
  return "generic";
}

const FIRE_LINE1: readonly string[] = [
  "No defect, Promat PSS collar is permitted to have Grafitex installed into the base.",
  "No defect, Rockwool FirePro sleeve packing matches the annulus tested for this cable grouping.",
  "No defect, Hilti CFS-C EL collar torque and backing washer arrangement follow the CodeMark installation sheet.",
  "No defect, intumescent wrap on plastic services remains continuous through the slab soffit zone.",
  "No defect, fire batts around the cable tray penetration are tightly packed with no unfilled voids visible.",
  "No defect, Promat FC collar and mineral wool infill accord with the penetration schedule P-FS-12.",
  "No defect, Nullifire FS702 coating build-up at the duct wrap meets the minimum wet-film specification.",
  "No defect, Tenmat fire pillows remain correctly layered and tagged for the mixed-services opening.",
  "No defect, fire-rated foam bead at the perimeter lining junction is within the tested bead depth.",
  "No defect, service sleeving projection beyond the fire line is trimmed and fire-stopped as per detail F3.",
  "No defect, ablative batt around data bundles is compressed to the manufacturer’s stated density range.",
  "No defect, combined mechanical and electrical penetrations use the approved composite detail only.",
  "No defect, fire collar orientation and slab penetration centring match the tested configuration drawing.",
  "No defect, temporary openings left during M&E install have been reinstated with listed materials only.",
  "No defect, Promat Grafitex annulus fill is complete before mortar backfill to the collar rebate.",
  "No defect, fire damper sleeve and actuator access panel clearances match the approved submittal.",
  "No defect, penetration fire index on the compartment drawing matches the as-built collar type.",
  "No defect, structural opening edges are sound and do not compromise the fire-stopping substrate.",
  "No defect, additional wrap layers at high cable fill remain within the tested cable density limit.",
  "No defect, label legibility on the fire-stopping product traceability stickers is retained for QA.",
  "No defect, smoke seal at the penetration periphery is continuous where the detail calls for cold-smoke control.",
  "No defect, fire stopping at riser floor transitions matches the riser matrix without substitution.",
];

const FIRE_LINE2: readonly string[] = [
  "Assessment report FAR 4670 allows Grafitex to be installed before backfilling with mortar.",
  "Assessment report FAR 5122 records mortar packing only after collar fixings are fully tightened.",
  "FER extract FER-CP-09 confirms Grafitex sequencing for Promat PSS before annular mortar closure.",
  "Fire test evidence FTE-8831 allows the collar and Grafitex combination for this service diameter.",
  "Manufacturer bulletin MB-PROMAT-4412 allows Grafitex in the base rebate prior to structural mortar fill.",
  "Compartmentation worksheet CW-FS-77 allows the penetration index as closed with the cited collar type.",
  "Independent review IRR-FS-2101 confirms installation matches FAR 4670 and the tested matrix row.",
  "Site inspection record SIR-FS-1904 allows sign-off subject to photograph pack FS-PH-44 on the register.",
  "FER Appendix C allows Grafitex installation before backfilling where slab edge formwork is removed.",
  "Witnessed trial panel WTP-FS-03 records acceptable Grafitex packing depth before mortar backfill.",
  "CodeMark certificate CM-PCDI-FS-12 allows the as-installed collar orientation shown on photo set A.",
  "Engineers comment EC-FS-08 allows proceed on the basis of FAR 4670 and manufacturer sequence notes.",
  "QA hold-point release QHP-FS-22 allows mortar backfill after Grafitex and collar inspection sign-off.",
  "Design clarification DC-FS-15 allows combined services in this opening with the specified composite detail.",
  "As-built fire register AFR-06 allows closure of the row once mortar cure cards are filed.",
  "Test report TR-EN-1366-3 excerpt allows the service bundle density shown at this penetration.",
  "FER penetration table row P-118 allows Hilti CFS-C EL with the stated annulus fill only.",
  "Work instruction WI-FS-09 allows Grafitex to be installed flush with the intrados before packing.",
  "Completion certificate CC-FS-301 allows the compartment boundary to be recorded as reinstated.",
  "Method statement MS-FS-44 allows reinstatement in two visits where access was staged for commissioning.",
  "Technical assessment TA-FS-901 allows minor field trimming of mineral wool provided density is recovered.",
  "Shop drawing SD-FS-712 allows the collar set-out relative to reinforcement cover at this core wall.",
];

const WATER_LINE1: readonly string[] = [
  "No defect, cavity barrier and membrane laps remain shingle-lapped in the queried zone.",
  "No defect, weep holes and perp vents along the spandrel zone read open and unobstructed.",
  "No defect, drained cavity retainers hold the insulation clear of the outer leaf as detailed.",
  "No defect, DPC at shelf angle is continuous and turned up correctly behind the inner lining.",
  "No defect, structural silicone bite at the corner transom matches the CW engineer’s minimum dimensions.",
  "No defect, EPDM upturn at the parapet capping is fully bonded without bridging stresses.",
  "No defect, pressure-equalisation baffle continuity is visible across the module joints inspected.",
  "No defect, insulation fixings do not bridge the cavity drainage path at the checked bays.",
  "No defect, membrane termination behind flashing returns is captured with mechanical restraint.",
  "No defect, movement joint bellows at the podium step are correctly anchored and uncompressed.",
  "No defect, rainscreen carrier brackets include the specified thermal isolator washers.",
  "No defect, cavity tray stop ends are closed and mortared without ponding behind the outer leaf.",
  "No defect, sealant depth:width ratio at the vision panel perimeter meets the glazing spec limits.",
  "No defect, kick-out diverters above openings shed water clear of the head rebated zone.",
  "No defect, air barrier line at the slab edge is taped continuous onto the structural substrate.",
  "No defect, penetrations through the vapour control layer are sleeved and sealed per detail W-14.",
  "No defect, balcony thermal break and drainage outlet align with the certified cold-bridge detail.",
  "No defect, stone cladding kerf drips and open perp joints match the façade engineer’s drip geometry.",
  "No defect, cavity insulation density and thickness match the U-value calculation assumptions.",
  "No defect, soft joint at structure interface is free of rigid bridging that would transmit water.",
  "No defect, louvre throat drains discharge to the slab drainage gully without overshooting the kerb.",
  "No defect, interface between curtain wall and precast is gasketed per the sequence on drawing FA-208.",
];

const WATER_LINE2: readonly string[] = [
  "Assessment report FAR 2201 allows the drained cavity configuration as built at this elevation.",
  "Waterproofing completion WC-3301 allows membrane laps and termination bars per schedule sheet W-4.",
  "Façade engineer letter FEL-1180 allows weep and vent free area after the snagging corrections noted.",
  "CW system assessment CWA-902 allows gasket replacement at mullion splices without re-testing the box.",
  "Site test record STR-W-07 allows water penetration resistance after hose test to CWCT sequence.",
  "Design review DR-W-55 allows the shelf angle DPC turn-up height relative to finished floor levels.",
  "O&M register OMR-W-12 allows maintenance access to cavity inspection panels without seal damage.",
  "Independent inspection IIR-W-03 allows sign-off of membrane continuity behind stone soffit panels.",
  "BIM clash report BCR-W-21 allows the bracket layout shown after coordination with M&E penetrations.",
  "Manufacturer data MDS-W-441 allows the membrane primer type used on the concrete backup wall.",
  "Thermal modelling note TMN-W-08 allows the as-built insulation thickness at the spandrel zone.",
  "Leak investigation LI-W-16 allows closure once root cause was traced to a temporary scaffold tie hole.",
  "Rainscreen specification RS-W-2.3 allows vertical drained joints at the module width used on site.",
  "Quality plan QP-W-90 allows photographic evidence pack W-PH-18 for membrane terminations.",
  "Engineers comment EC-W-14 allows proceed after verification of pressure plate torque at level 6.",
  "Commissioning log CXL-W-05 allows façade vents to remain open until internal RH stabilisation.",
  "Method statement MS-W-33 allows sequencing of membrane works around follow-on trades safely.",
  "As-built drawing AB-W-712 allows the cavity tray set-out relative to structural movement joints.",
  "Witnessed hose test WHT-W-02 allows the zone classification without further intrusive investigation.",
  "Technical submittal TS-W-601 allows the sealant colour batch variance within manufacturer tolerance.",
  "Condensation risk review CRR-W-11 allows the internal surface temperatures at the junction modelled.",
  "Insurance-backed guarantee IBG-W-01 allows the waterproofing scope to be listed as complete.",
];

const ACOUSTIC_LINE1: readonly string[] = [
  "No defect, resilient bar and acoustic lining board fixings remain on the specified centres.",
  "No defect, acoustic mat at the party floor is uncut and fully bedded without bridging strips.",
  "No defect, flanking strip at the perimeter is uncompressed and continuous behind skirting.",
  "No defect, ceiling isolation hangers include the neoprene washers called up on drawing A-521.",
  "No defect, service penetrations through the acoustic deck use sleeved and sealed detail A-P-09.",
  "No defect, floating screed edge isolation strip is visible before screed encasement at door thresholds.",
  "No defect, back-boxes for electrics in the party wall are the acoustic-rated type only.",
  "No defect, duct soffit lining in the riser maintains the lined cross-section without local pinch.",
  "No defect, mastic seal at the skirting junction is continuous without rigid bridging to structure.",
  "No defect, structural screed thickness over the mat matches the tested mass-spring-mass build-up.",
  "No defect, door set acoustic seals and drop-down threshold align with the acoustic door schedule.",
  "No defect, pipe boxing around soil stacks uses decoupled framing from the party lining.",
  "No defect, access panel in the acoustic ceiling uses the rated acoustic hatch type listed.",
  "No defect, resilient channel deflection under hand check remains within elastic behaviour.",
  "No defect, mineral wool in the stud cavity is fitted tight without voids behind switch zones.",
  "No defect, staggered stud layout at the party junction matches detail A-J-04 without substitution.",
  "No defect, ceiling raft isolation from walls uses soft angle as per the acoustic spec clause.",
  "No defect, raised floor pedestals at the party line include the specified resilient pad washers.",
  "No defect, M&E first fix does not hard-fix services to both leaves of the twin stud assembly.",
  "No defect, test plugs and temporary openings have been closed with the same acoustic build-up.",
  "No defect, window mullion acoustic baffle is installed where the spec requires flanking attenuation.",
  "No defect, plant vibration pads under AHUs on acoustic decks match the submittal pad type.",
];

const ACOUSTIC_LINE2: readonly string[] = [
  "Acoustic test report ATR-118 allows the party floor assembly as detailed on drawing A-521.",
  "Pre-completion test PCT-A-44 allows airborne results within the contract criteria at this unit type.",
  "Site inspection SIR-A-07 allows lining continuity after correction of a local resilient bar clip miss.",
  "Design check DC-A-21 allows the service penetration detail used at riser floor transitions.",
  "Manufacturer letter ML-A-55 allows resilient bar loading with the board weight actually installed.",
  "Engineers review ER-A-30 allows flanking strip compression limits after seasonal shrinkage allowance.",
  "BREEAM evidence pack BEP-A-12 allows credited acoustic performance based on tested assemblies.",
  "Commissioning note CN-A-08 allows HVAC background noise within NC curves at handover.",
  "QA record QR-A-90 allows photographic pack A-PH-07 for mat laps under screed edges.",
  "Work instruction WI-A-14 allows screed pour sequencing to protect acoustic isolation upstands.",
  "As-built sketch ABS-A-33 allows boxing around stacks decoupled from the party lining as built.",
  "Independent test IT-A-02 allows impact results at stairs after resilient underlay installation.",
  "Method statement MS-A-61 allows temporary protection boards that do not bridge isolation layers.",
  "O&M manual OMM-A-4 allows maintenance of acoustic door seals without degrading ratings.",
  "Technical assessment TA-A-701 allows minor local repairs to lining board without retest of whole flat.",
  "Witness statement WS-A-11 allows sign-off of resilient hanger type after spot-check torque audit.",
  "Shop drawing SD-A-440 allows ceiling raft layout relative to primary structure deflection limits.",
  "Risk register RR-A-05 allows residual flanking risk controlled by detail A-J-04 inspections only.",
  "Completion certificate CC-A-210 allows acoustic scope sign-off for this apartment cluster.",
  "Design clarification DC-A-09 allows access panel quantity without breaching minimum lining area.",
  "Site memo SM-A-77 allows late M&E penetrations reinstated with approved acoustic sleeves only.",
  "Client technical query CTQ-A-03 allows skirting fixings into resilient zone with isolated plugs.",
];

const STEEL_LINE1: readonly string[] = [
  "No defect, tension-control bolt installation matches the specified grade and slip factor class.",
  "No defect, bolt hole edge distances and pitch comply with the connection detail S-C-88.",
  "No defect, splice pack shims are fully bedded and the joint gap is within tolerance band.",
  "No defect, weld profile at the stiffener weld is free of undercut per visual weld class.",
  "No defect, holding-down bolt projection and template alignment match the column base drawing.",
  "No defect, pack plates at the beam seat are of the correct thickness stack and material grade.",
  "No defect, HSFG bolts show the required part-turn from snug-tight on all positions checked.",
  "No defect, connection paint system touch-up does not mask bolt marking or torque indication.",
  "No defect, shear tab bolt groups are complete with washers where the standard demands them.",
  "No defect, slotted holes are oriented correctly relative to the designed load path direction.",
  "No defect, erection tolerance at the splice elevation is within the structural engineer’s limits.",
  "No defect, temporary bracing removal sequence was followed without overstressing partial connections.",
  "No defect, anchor resin injection for post-installed anchors shows the correct embedment depth.",
  "No defect, fin plate welds tie back to the column web with the specified weld throat size.",
  "No defect, bearing stiffeners are fitted tight to flange inner faces without visible gaps.",
  "No defect, corrosion protection at site-cut edges has been restored to system specification.",
  "No defect, bolt lengths protrude safely beyond the nut with two full threads visible minimum.",
  "No defect, connection tags on delivered members match the steelwork GA revision on site.",
  "No defect, grout under base plates has achieved cube strength before load transfer noted.",
  "No defect, thermal break pads at façade bracket connections remain uncompressed and aligned.",
  "No defect, splice bolt access constraints were resolved without substitution of bolt grade.",
  "No defect, puddle welds on decking match the composite slab design assumptions for shear studs.",
];

const STEEL_LINE2: readonly string[] = [
  "Structural engineers letter SEL-2040 allows installation torque and hole tolerances assumed in calcs.",
  "Steelwork inspection report SIR-ST-55 allows connection type C-12 with the bolt pattern as built.",
  "Calculation summary CS-ST-901 allows HSFG joint slip resistance for the factored load case.",
  "Independent check IC-ST-14 allows fabrication marking traceability to mill certificates on file.",
  "Method statement MS-ST-28 allows temporary works that do not overload partial beam connections.",
  "QA hold-point QHP-ST-09 allows bolting completion before decking concrete pour sequence.",
  "Welding procedure WPS-ST-77 allows the consumable batch used on stiffener-to-web welds.",
  "NDT report NDT-ST-03 allows UT results for full penetration butt welds at splice positions.",
  "As-built survey ABS-ST-612 allows steel tolerances relative to grid lines at level transfers.",
  "Design clarification DC-ST-11 allows pack plate substitution within the approved thickness range.",
  "Site instruction SI-ST-04 allows re-torque after paint touch-up without changing bolt condition.",
  "Witness inspection WI-ST-21 allows final sign-off of column splice at grid intersection B-7.",
  "Technical assessment TA-ST-440 allows minor field drilling offset within edge distance limits.",
  "Fabricator letter FL-ST-18 allows bolt batch certificates matching the installed lot numbers.",
  "Foundation report FR-ST-02 allows holding-down bolt loads compatible with base grout strength.",
  "Risk review RR-ST-06 allows residual snagging limited to cosmetic paint without structural impact.",
  "Completion certificate CC-ST-120 allows steelwork package handover to follow-on trades.",
  "Engineers comment EC-ST-33 allows grout cube results filed before removing temporary props.",
  "Shop drawing SD-ST-905 allows fin plate orientation relative to incoming beam reactions.",
  "Client approval CA-ST-07 allows exposed connection aesthetic variance within tolerance notes.",
  "Insurance engineer letter IEL-ST-01 allows connection details as insured under the works policy.",
  "Commissioning tie-in CTI-ST-12 allows bracket loads from M&E supports on primary steel.",
];

const CURTAIN_LINE1: readonly string[] = [
  "No defect, pressure plate screws are on centres and gasket compression reads even module-wide.",
  "No defect, transom drainage pathways are clear and tie holes do not bridge drainage chambers.",
  "No defect, structural silicone bite width meets the glazing engineer’s minimum for wind load.",
  "No defect, setting blocks and location blocks are neoprene type per the CW specification.",
  "No defect, cap continuity at corners uses the approved mitre and splice plate arrangement.",
  "No defect, thermal break in the mullion is continuous without metal bridge at splices.",
  "No defect, fire-rated spandrel zone uses the listed opaque infill and backing board only.",
  "No defect, bracket fixings to structure achieve the edge distance and embedment scheduled.",
  "No defect, movement joint capacity at stack joints matches inter-storey drift assumptions.",
  "No defect, glass edge clearance to metal retains the design gap for thermal movement.",
  "No defect, louvre blades and bird guards are fixed without restricting free area calculation.",
  "No defect, internal beaded gasket at the head is seated without twist or rolled corners.",
  "No defect, anchor channels cast-in align with tolerance after survey at critical grids.",
  "No defect, corner cleat welds are continuous with specified throat and cleaned slag-free.",
  "No defect, stack joint drainage shoe discharges to the slab kerb without overspray staining.",
  "No defect, acoustic laminated inner pane orientation matches the workshop order marking.",
  "No defect, solar shading bracket loads are transferred only through listed adapter brackets.",
  "No defect, silicone tooling profile matches manufacturer guidance for weather tightness.",
  "No defect, openable vent limit stays and safety restrictors operate per hardware schedule.",
  "No defect, spandrel insulation thickness behind opaque panels matches the U-value line item.",
  "No defect, metal finish samples on site match the approved anodise batch reference.",
  "No defect, CW protection film removal did not score glass or gasket surfaces at handover.",
];

const CURTAIN_LINE2: readonly string[] = [
  "CW system assessment CWA-771 allows gasket replacement without re-certifying the entire stick module.",
  "Glazing engineer letter GEL-3304 allows silicone bite dimensions after site survey verification.",
  "Water test report WTR-CW-12 allows zone hose test pass to CWCT methodology at sample bay.",
  "Manufacturer bulletin MB-CW-2201 allows cap screw torque range used during pressure plate install.",
  "Design review DR-CW-44 allows movement joint stack detail relative to structural drift envelope.",
  "Independent inspection IIR-CW-05 allows drainage continuity after snagging of blocked weep tubes.",
  "BIM coordination BC-CW-18 allows bracket clash resolution without changing structural reaction points.",
  "Thermal analysis TAN-CW-09 allows thermal break performance with actual spacer geometry built.",
  "QA photographic pack QP-CW-33 allows gasket seating quality at head and sill typicals.",
  "Engineers comment EC-CW-27 allows substitution of setting block hardness within approved range.",
  "Site memo SM-CW-14 allows temporary protection removal sequence without seal damage.",
  "As-built drawing AB-CW-505 allows mullion splice positions relative to floor slab edges.",
  "Witness test WT-CW-03 allows dynamic water spray after correction of a local gasket pinch.",
  "Technical submittal TS-CW-610 allows glass make-up and interlayer type for acoustic zones.",
  "O&M data OMD-CW-02 allows maintenance of vent hardware without breaching warranty terms.",
  "Completion certificate CC-CW-180 allows CW package closure for the inspected elevation.",
  "Method statement MS-CW-41 allows rope access repairs that do not overload temporary anchors.",
  "Risk register RR-CW-08 allows residual gasket shrinkage monitored under manufacturer guidance.",
  "Client directive CD-CW-01 allows aesthetic variance on cap alignment within ±2 mm note.",
  "Insurance-backed IBG-CW-11 allows CW installer warranty activation after final clean-down.",
  "Shop drawing SD-CW-880 allows bracket layout at podium transfer without overstressing mullions.",
  "Commissioning note CN-CW-06 allows vent free area verification against smoke control assumptions.",
];

const FINISHES_LINE1: readonly string[] = [
  "No defect, crack width at this location is within the cosmetic threshold after movement allowance.",
  "No defect, plasterboard joint tape and compound build-up match the specified fire-rated lining.",
  "No defect, skirting junction to resilient zone is detailed without rigid fix-through isolation.",
  "No defect, ceramic tile movement joints align with the structural movement grid spacing.",
  "No defect, paint finish uniformity is acceptable under normal viewing distance at handover light.",
  "No defect, timber flooring expansion gaps at perimeters respect manufacturer maximum span rules.",
  "No defect, ceiling access panels are flush and latch without binding on adjacent tiles.",
  "No defect, wet area tanking upturn behind tiles meets height and corner reinforcement detail.",
  "No defect, stair nosing profiles and slip resistance match the accessibility schedule values.",
  "No defect, shadow gaps at bulkheads are consistent without unintended taper from setting-out.",
  "No defect, resin floor cove radius matches hygiene detail RF-12 at plant room walls.",
  "No defect, wallpaper seams are staggered and pattern match is maintained across panels.",
  "No defect, metal corner beads are straight and free of shadow-casting kinks in critical views.",
  "No defect, screed surface regularity is within SR2 limits for the floor covering to follow.",
  "No defect, door architrave mitres are tight without open joints after seasonal shrinkage.",
  "No defect, silicone colour at sanitaryware matches the approved sample board reference.",
  "No defect, ceiling grid module is square to walls within tolerance for large-format tiles.",
  "No defect, dado rail level follows datum laser check without cumulative drift along corridor.",
  "No defect, timber veneer book-matching reads continuously across paired door leaves.",
  "No defect, skirting scribe to uneven concrete follows best practice without bridging DPM.",
  "No defect, feature wall panel alignment tolerances meet architect’s ±1 mm joint note.",
  "No defect, protective film removal on stainless trim did not leave adhesive residue.",
];

const FINISHES_LINE2: readonly string[] = [
  "Internal finishes review IFR-0908 allows monitoring limits for crack propagation in dry lining.",
  "Architect instruction AI-FN-12 allows joint positions where secondary structure movement is low.",
  "Manufacturer data MDS-FN-301 allows tile adhesive open time for the site temperature range.",
  "Site inspection SIR-FN-04 allows paint touch-up batch matching under agreed viewing conditions.",
  "Engineers comment EC-FN-09 allows movement joint spacing compatible with substrate modulus.",
  "QA record QR-FN-66 allows photographic pack FN-PH-12 for wet area tanking corners.",
  "Design clarification DC-FN-03 allows skirting height adjustment after finished floor build-up change.",
  "O&M schedule OMS-FN-01 allows maintenance of resilient flooring without adhesive breakdown.",
  "Witness inspection WI-FN-18 allows resin floor cure time before M&E roller load traffic.",
  "Technical assessment TA-FN-501 allows minor local plaster repairs without full room re-skim.",
  "As-built note ABN-FN-22 allows ceiling access quantity after coordination with services routes.",
  "Completion certificate CC-FN-140 allows finishes package sign-off for the inspected apartment.",
  "Method statement MS-FN-27 allows protection boards that do not stain decorative surfaces.",
  "Independent review IRR-FN-02 allows aesthetic tolerances aligned to contract viewing protocol.",
  "Client memo CM-FN-05 allows colour batch variance within manufacturer published limits.",
  "Shop drawing SD-FN-410 allows shadow gap detail relative to bulkhead lighting trough.",
  "Risk register RR-FN-07 allows residual shrinkage cracks logged for seasonal re-inspection only.",
  "Commissioning tie CTI-FN-11 allows ceiling access for devices without damaging finishes.",
  "Insurance snagging IS-FN-03 allows cosmetic items excluded from latent defects cover wording.",
  "Work instruction WI-FN-16 allows cleaning agents compatible with sealed stone surfaces.",
  "BIM issue BIF-FN-08 allows set-out correction without changing primary wall lining fire rating.",
  "Handover checklist HCL-FN-99 allows snag list closure criteria for decorative packages.",
];

const MECHANICAL_LINE1: readonly string[] = [
  "No defect, duct attenuator lengths and straight runs either side match the acoustic schedule.",
  "No defect, balancing damper positions are locked and tagged after TAB verification readings.",
  "No defect, AHU filter media class and gasket seating match the indoor air quality basis.",
  "No defect, flexible connections to equipment are within the allowable lateral offset limits.",
  "No defect, fire/smoke damper actuators are accessible and wired to the BMS point schedule.",
  "No defect, condensate drain fall and trap depth meet manufacturer minimums for negative pressure.",
  "No defect, ventilation grilles free area matches the grille schedule without masking tape residue.",
  "No defect, thermal insulation on chilled duct is continuous at supports with load-bearing saddles.",
  "No defect, VAV box inlet conditions have adequate straight duct for flow measurement accuracy.",
  "No defect, kitchen extract grease filters are seated and interlocked per the O&M sequence.",
  "No defect, louvre bird mesh is intact and does not reduce free area below design calculation.",
  "No defect, ductwork leakage class specification is evidenced by pre-commissioning test sheets.",
  "No defect, plant room bund and drain connection sizing matches spill scenario assumptions.",
  "No defect, vibration isolators under fans match the submittal spring rate and deflection.",
  "No defect, access doors to ductwork maintain required size for maintenance per CIBSE guidance.",
  "No defect, fresh air intake location and height comply with pollution separation distances.",
  "No defect, heat recovery wheel bypass dampers operate through full stroke without binding.",
  "No defect, local exhaust capture hood face velocity meets the LEV design for the process.",
  "No defect, chilled beam condensation tray drains are connected and tested for prime condition.",
  "No defect, riser duct fire stopping at floor penetrations matches the approved penetration detail.",
  "No defect, commissioning labels on terminals match room names on the air balance schematic.",
  "No defect, MCC panel clearances and arc flash boundaries respect the electrical design assumptions.",
];

const MECHANICAL_LINE2: readonly string[] = [
  "TAB summary TS-4450 allows the served zones within specified tolerance of design air volumes.",
  "Commissioning certificate CC-M-210 allows functional performance tests for smoke spill fans.",
  "Design review DR-M-33 allows revised damper settings after tenant fit-out partition changes.",
  "Manufacturer letter ML-M-44 allows VAV controller mapping to the BMS graphics as installed.",
  "Site test record STR-M-09 allows duct pressure test pass at declared leakage class for risers.",
  "Engineers comment EC-M-18 allows AHU duty point after filter loading correction at year one.",
  "QA pack QP-M-12 allows photographic evidence of insulation continuity at plant room penetrations.",
  "O&M manual OMM-M-5 allows maintenance access without breaching acoustic enclosures.",
  "Independent check IC-M-06 allows LEV retest intervals aligned to HSE guidance for the process.",
  "Method statement MS-M-52 allows temporary ventilation during construction without contaminating ducts.",
  "Witness sheet WS-M-14 allows fire damper drop test records filed on the digital O&M.",
  "Technical assessment TA-M-701 allows minor duct resizing in ceiling void after coordination.",
  "As-built drawing AB-M-604 allows terminal locations relative to lighting and detector zones.",
  "Completion certificate CC-M-305 allows M&E ventilation handover for the inspected floor plate.",
  "Risk review RR-M-08 allows residual noise at grilles within NR curves after fine balancing.",
  "Client approval CA-M-02 allows grille style substitution with identical free area performance.",
  "Shop drawing SD-M-910 allows duct support spacing under seismic bracing supplementary note.",
  "Insurance engineer IEL-M-01 allows plant room bund volume compatible with insurer loss scenario.",
  "BIM coordination BC-M-17 allows clash resolution without changing primary air path volumes.",
  "Work instruction WI-M-23 allows cleaning and disinfection of ductwork prior to occupancy.",
  "Site memo SM-M-11 allows seasonal retest window for heat recovery efficiency verification.",
  "Handover note HN-M-04 allows training sign-off for BMS trend logging and alarm thresholds.",
];

const CONCRETE_LINE1: readonly string[] = [
  "No defect, cover meter readings at the zone exceed minimum durability cover for exposure class.",
  "No defect, honeycomb repair is cut square, keyed, and reinstated with approved repair mortar.",
  "No defect, crack injection resin follows the manufacturer’s pressure and temperature limits.",
  "No defect, curing compound application on slab edges matches the supplier’s coverage rate.",
  "No defect, construction joint preparation includes correct aggregate exposure and cleanliness.",
  "No defect, surface regularity for following trades is within the specified deviation limits.",
  "No defect, cast-in rebate dimensions for M&E openings match the combined services drawing.",
  "No defect, post-installed anchors show embedment marks within the allowable tolerance band.",
  "No defect, chloride testing results for the batch fall below the threshold for intervention.",
  "No defect, carbonation front depth after phenolphthalein survey is behind the reinforcement.",
  "No defect, slab deflection under dead load is within predicted limits at measured points.",
  "No defect, water/cement ratio records for the pour batch align with the approved mix design.",
  "No defect, temperature differential during mass pour was logged within the thermal control plan.",
  "No defect, dowel alignment at movement joints matches the dowel sleeve detail without binding.",
  "No defect, surface tensile strength pull-off tests meet minimum for applied coating systems.",
  "No defect, edge chamfers and drip features match durability detailing on drawing C-441.",
  "No defect, pile cap projection and trim level allow correct bearing for column base template.",
  "No defect, blinding thickness and compaction under footings meet the geotechnical assumption set.",
  "No defect, kicker height and line for wall pour alignment are within structural tolerances.",
  "No defect, repair colour matching to parent concrete is acceptable for non-feature surfaces.",
  "No defect, core hole reinstatement uses approved fire and acoustic infill where required.",
  "No defect, waterproofing preparation at kicker interface is sound without laitance contamination.",
];

const CONCRETE_LINE2: readonly string[] = [
  "Durability inspection DIR-602 allows proceed with protective coating as per detail DR-C-12.",
  "Structural assessment SA-C-880 allows crack widths monitored under engineer’s inspection regime.",
  "Concrete test summary CTS-C-45 allows cube strengths for the pour date on the register row.",
  "Independent review IRR-C-03 allows repair methodology compatible with design fire resistance.",
  "Carbonation survey CS-C-17 allows residual service life estimate above the contract minimum.",
  "Engineers letter EL-C-29 allows anchor pull-out tests for the post-installed fixing pattern used.",
  "QA record QR-C-55 allows photographic pack C-PH-20 for honeycomb repair reinstatement.",
  "Method statement MS-C-36 allows wet trades sequencing that protects curing of structural slabs.",
  "Witness inspection WI-C-12 allows cover survey grid sign-off at representative locations only.",
  "Technical note TN-C-401 allows minor surface defects excluded from structural intervention scope.",
  "As-built survey ABS-C-702 allows slab level tolerances relative to FF/FL finish schedule.",
  "Completion certificate CC-C-230 allows concrete package closure subject to coating follow-on.",
  "Design clarification DC-C-08 allows movement joint width after long-term shrinkage allowance.",
  "O&M data OMD-C-03 allows maintenance of coating systems without breaching warranty terms.",
  "Risk register RR-C-06 allows residual crack monitoring frequency agreed with the engineer.",
  "Site instruction SI-C-05 allows retest interval for chloride sampling after one winter season.",
  "Client memo CM-C-04 allows aesthetic concrete finish variance on non-visible soffit zones.",
  "Shop drawing SD-C-330 allows kicker reinforcement continuity at construction joint positions.",
  "Insurance engineer IEL-C-02 allows durability assumptions compatible with policy cover period.",
  "Commissioning tie CTI-C-09 allows core reinstatement fire tests filed before ceiling close-in.",
  "BIM issue BIF-C-11 allows pour sequence updates without changing structural load sharing.",
  "Handover checklist HCL-C-88 allows snag closure for concrete items before finishes coverage.",
];

/** Pairs and fragments for categories not matched to a specialist pool. */
const GENERIC_LINE1: readonly string[] = [
  ...FIRE_LINE1.slice(0, 8),
  ...WATER_LINE1.slice(0, 8),
  ...ACOUSTIC_LINE1.slice(0, 6),
  ...STEEL_LINE1.slice(0, 6),
  ...CURTAIN_LINE1.slice(0, 6),
  ...FINISHES_LINE1.slice(0, 6),
  ...MECHANICAL_LINE1.slice(0, 6),
  ...CONCRETE_LINE1.slice(0, 6),
];

const GENERIC_LINE2: readonly string[] = [
  ...FIRE_LINE2.slice(0, 8),
  ...WATER_LINE2.slice(0, 8),
  ...ACOUSTIC_LINE2.slice(0, 6),
  ...STEEL_LINE2.slice(0, 6),
  ...CURTAIN_LINE2.slice(0, 6),
  ...FINISHES_LINE2.slice(0, 6),
  ...MECHANICAL_LINE2.slice(0, 6),
  ...CONCRETE_LINE2.slice(0, 6),
];

const POOLS: Record<string, { line1: readonly string[]; line2: readonly string[] }> = {
  fire: { line1: FIRE_LINE1, line2: FIRE_LINE2 },
  water: { line1: WATER_LINE1, line2: WATER_LINE2 },
  acoustic: { line1: ACOUSTIC_LINE1, line2: ACOUSTIC_LINE2 },
  steel: { line1: STEEL_LINE1, line2: STEEL_LINE2 },
  curtain: { line1: CURTAIN_LINE1, line2: CURTAIN_LINE2 },
  finishes: { line1: FINISHES_LINE1, line2: FINISHES_LINE2 },
  mechanical: { line1: MECHANICAL_LINE1, line2: MECHANICAL_LINE2 },
  concrete: { line1: CONCRETE_LINE1, line2: CONCRETE_LINE2 },
  generic: { line1: GENERIC_LINE1, line2: GENERIC_LINE2 },
};

export function buildMockDefectResponseText(input: MockDefectResponseInput): string {
  const { defectCategory, defectDescription, strategyLabel, variant } = input;
  const trimmed = defectDescription.trim();
  const seed =
    (stableHash(defectCategory) ^
      stableHash(trimmed) ^
      stableHash(strategyLabel)) +
    variant * 911;

  const poolKey = defectMockResponsePoolKey(defectCategory);
  const pool = POOLS[poolKey] ?? POOLS.generic;

  let i1 = 0;
  let i2 = 1;
  const s = strategyLabel.toLowerCase();
  if (s.includes("engineer")) {
    i1 = 2;
    i2 = 3;
  } else if (s.includes("citation") || s.includes("test report") || s.includes("standard")) {
    i1 = 4;
    i2 = 5;
  } else if (s.includes("evidence")) {
    i1 = 6;
    i2 = 7;
  } else if (s.includes("compliant")) {
    i1 = 8;
    i2 = 9;
  }

  const line1 = pick(seed, i1, pool.line1);
  let line2 = pick(seed, i2, pool.line2);
  if (line2 === line1) line2 = pick(seed + 17, i2 + 11, pool.line2);

  return `${line1}\n${line2}`;
}
