import logging
from typing import Dict, Any, Tuple, Optional, Set
from models import Severity, RuleConfidence, InteractionItem
from services.knowledge_base import COMMON_BRAND_MAPPINGS, SYNONYM_SETS

logger = logging.getLogger("clinical_rules")

def resolve_canonical_name(name: str) -> str:
    cleaned = name.lower().strip()
    return COMMON_BRAND_MAPPINGS.get(cleaned, cleaned)

def expand_aliases(drug_name: str) -> Set[str]:
    canonical = resolve_canonical_name(drug_name)
    aliases = {canonical, drug_name.lower().strip()}
    for syn_set in SYNONYM_SETS:
        if canonical in syn_set or drug_name.lower().strip() in syn_set:
            aliases.update(syn_set)
    return aliases

# ==============================================================================
# EVIDENCE-ANNOTATED DETERMINISTIC CLINICAL RULES
# ==============================================================================
KNOWN_CLINICAL_RULES: Dict[Tuple[str, str], Dict[str, Any]] = {
    ("warfarin", "aspirin"): {
        "severity": Severity.HIGH,
        "explanation": "Concurrent use of Warfarin and Aspirin creates a dangerous synergistic hemorrhagic risk by combining anticoagulant factor depletion with irreversible platelet inhibition.",
        "mechanism": "Warfarin inhibits Vitamin K clotting factors while Aspirin irreversibly inhibits platelet COX-1 thromboxane A2, leading to dual-pathway breakdown of normal hemostasis.",
        "clinical_impact": "Substantially increases major gastrointestinal bleeding, intracranial hemorrhage, and occult microvascular blood loss.",
        "stomach_impact": "Aspirin induces direct gastric mucosal erosion; any ulceration will bleed severely under warfarin anticoagulation.",
        "food_consideration": "Strictly avoid alcohol. Maintain consistent dietary Vitamin K intake.",
        "action_guidance": "Requires strict physician oversight, precise INR monitoring, and potential PPI gastro-protection.",
        "evidence_source": "FDA Black Box Warning & CHEST Antithrombotic Guidelines",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("warfarin", "ibuprofen"): {
        "severity": Severity.HIGH,
        "explanation": "Concurrent use of Warfarin and Ibuprofen creates a severe risk of major gastrointestinal hemorrhage and acute INR destabilization.",
        "mechanism": "Ibuprofen competitively displaces Warfarin from plasma protein binding sites, inhibits CYP2C9 metabolism, and causes reversible platelet dysfunction combined with gastric mucosal erosion.",
        "clinical_impact": "Multiplies gastrointestinal bleeding events 3- to 5-fold and causes acute spikes in prothrombin time (INR).",
        "stomach_impact": "High ulcer and mucosal bleeding hazard.",
        "food_consideration": "Take with meals if unavoidable; avoid alcohol completely.",
        "action_guidance": "Substitute Ibuprofen with Paracetamol (under 2g/day) or consult physician for alternative analgesics.",
        "evidence_source": "FDA Black Box Warning & Lexicomp Drug Interactions",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("aspirin", "ibuprofen"): {
        "severity": Severity.MODERATE,
        "explanation": "Ibuprofen competitively interferes with the irreversible antiplatelet cardioprotective effect of low-dose Aspirin, and compounds gastric irritation.",
        "mechanism": "Ibuprofen reversibly binds to the COX-1 catalytic channel, sterically hindering Aspirin from acetylating Serine 529 on platelet COX-1.",
        "clinical_impact": "Diminishes Aspirin's cardioprotective efficacy and increases cumulative gastric ulceration risk.",
        "stomach_impact": "Additive mucosal stress from dual NSAID COX-1 inhibition.",
        "food_consideration": "Take with meals.",
        "action_guidance": "Dose Timing Rule: Take immediate-release Ibuprofen at least 8 hours before or at least 30 minutes after low-dose Aspirin.",
        "evidence_source": "FDA Drug Safety Communication & Circulation Journal",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("paracetamol", "alcohol"): {
        "severity": Severity.MODERATE,
        "explanation": "Chronic alcohol consumption or acute high-dose co-ingestion drastically increases Paracetamol hepatotoxicity risk.",
        "mechanism": "Ethanol induces cytochrome P450 2E1 (CYP2E1), accelerating conversion of Paracetamol to toxic N-acetyl-p-benzoquinone imine (NAPQI), while depleting hepatic glutathione.",
        "clinical_impact": "Elevated liver transaminases, hepatocyte necrosis, and acute liver failure.",
        "stomach_impact": "Direct gastric mucosal irritation from ethanol.",
        "food_consideration": "Do not consume alcoholic beverages while taking acetaminophen-containing products.",
        "action_guidance": "Limit total daily Paracetamol to 2,000mg or less in patients who consume alcohol.",
        "evidence_source": "FDA Acetaminophen Warning & Hepatology Guidelines",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("ibuprofen", "alcohol"): {
        "severity": Severity.MODERATE,
        "explanation": "Alcohol significantly amplifies the gastric mucosal erosive effects of Ibuprofen and increases occult bleeding risk.",
        "mechanism": "Ethanol damages the gastric mucosal barrier and increases localized acid secretion, compounding NSAID-induced prostaglandin inhibition.",
        "clinical_impact": "Severe dyspepsia, gastritis, peptic ulceration, and upper gastrointestinal bleeding.",
        "stomach_impact": "Severe cumulative mucosal irritation.",
        "food_consideration": "Avoid alcohol entirely while taking NSAIDs.",
        "action_guidance": "Take Ibuprofen with food and avoid concurrent alcohol consumption.",
        "evidence_source": "Lexicomp & British National Formulary",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("aspirin", "alcohol"): {
        "severity": Severity.MODERATE,
        "explanation": "Concurrent use of Aspirin and Alcohol heightens gastric mucosal injury and prolongs bleeding time.",
        "mechanism": "Dual mucosal toxicity combined with additive antiplatelet effects.",
        "clinical_impact": "Upper GI hemorrhage, acute gastritis, and mucosal erosion.",
        "stomach_impact": "High risk of localized gastric bleeding.",
        "food_consideration": "Strictly limit alcohol.",
        "action_guidance": "Take Aspirin with food and water.",
        "evidence_source": "FDA OTC Labeling Requirements",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("atorvastatin", "alcohol"): {
        "severity": Severity.MODERATE,
        "explanation": "Combining Atorvastatin with excessive alcohol intake increases the risk of hepatic dysfunction and transaminase elevations.",
        "mechanism": "Additive hepatic metabolic strain and potential reduction in statin clearance.",
        "clinical_impact": "Hepatotoxicity and potential worsening of myopathy.",
        "stomach_impact": "Low direct GI interaction.",
        "food_consideration": "Avoid heavy alcohol consumption.",
        "action_guidance": "Monitor routine liver function tests (ALT/AST).",
        "evidence_source": "AHA/ACC Cholesterol Clinical Guidelines",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("metformin", "alcohol"): {
        "severity": Severity.HIGH,
        "explanation": "Alcohol dramatically increases the risk of Metformin-associated lactic acidosis, a rare but life-threatening metabolic emergency.",
        "mechanism": "Alcohol inhibits hepatic gluconeogenesis and lactate clearance, potentiating metformin-induced systemic lactate accumulation.",
        "clinical_impact": "Severe metabolic acidosis, hypothermia, hypotension, and renal impairment.",
        "stomach_impact": "Nausea, vomiting, severe abdominal pain.",
        "food_consideration": "Avoid excessive or binge alcohol consumption.",
        "action_guidance": "Warn patients regarding fatal lactic acidosis symptoms.",
        "evidence_source": "FDA Black Box Warning (Metformin Hydrochloride)",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("lisinopril", "ibuprofen"): {
        "severity": Severity.MODERATE,
        "explanation": "NSAIDs blunt the antihypertensive effect of ACE inhibitors (Lisinopril) and significantly increase the risk of acute renal failure.",
        "mechanism": "Lisinopril dilates the renal efferent arteriole while Ibuprofen inhibits prostaglandins that maintain afferent arteriolar dilation, resulting in acute reduction of glomerular filtration rate (GFR).",
        "clinical_impact": "Loss of blood pressure control and acute kidney injury (Triple Whammy risk if diuretics are co-prescribed).",
        "stomach_impact": "Standard NSAID GI load.",
        "food_consideration": "Ensure adequate hydration.",
        "action_guidance": "Monitor blood pressure and serum creatinine/potassium regularly.",
        "evidence_source": "Kidney Disease Improving Global Outcomes (KDIGO) Guidelines",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    },
    ("paracetamol", "amoxicillin"): {
        "severity": Severity.NONE,
        "explanation": "No known pharmacokinetic or pharmacodynamic interactions exist between Paracetamol and Amoxicillin. This combination is considered clinically safe when dosed appropriately.",
        "mechanism": "Distinct metabolic and clearance pathways (hepatic glucuronidation/sulfation for paracetamol; renal tubular secretion for amoxicillin).",
        "clinical_impact": "None. Excellent safety profile.",
        "stomach_impact": "Gentle on gastric mucosa.",
        "food_consideration": "May take with or without meals.",
        "action_guidance": "Safe to co-administer as directed.",
        "evidence_source": "Clinical Pharmacology Standard Reference",
        "confidence": RuleConfidence.ESTABLISHED,
        "last_reviewed": "2026-08-23"
    }
}

def match_known_clinical_rule(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
    aliases_a = expand_aliases(drug_a)
    aliases_b = expand_aliases(drug_b)

    for (k1, k2), rule in KNOWN_CLINICAL_RULES.items():
        if (k1 in aliases_a and k2 in aliases_b) or (k1 in aliases_b and k2 in aliases_a):
            return InteractionItem(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=rule["severity"],
                explanation=rule["explanation"],
                mechanism=rule.get("mechanism"),
                clinical_impact=rule.get("clinical_impact"),
                stomach_impact=rule.get("stomach_impact"),
                food_consideration=rule.get("food_consideration"),
                action_guidance=rule.get("action_guidance"),
                evidence_source=rule.get("evidence_source"),
                confidence=rule.get("confidence", RuleConfidence.ESTABLISHED),
                last_reviewed=rule.get("last_reviewed", "2026-08-23")
            )
    return None
