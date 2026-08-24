from typing import List, Dict, Any, Tuple, Optional
from models import MedicineProfileResponse, AmplifiedSideEffect, RiskTier
from services.clinical_rules import expand_aliases

# Neutral values used when a profile carries no usable GI data.
DEFAULT_GI_SCORE = 20
DEFAULT_GI_TIER = "gentle"


def _read_gi_profile(profile: Optional[MedicineProfileResponse]) -> Tuple[int, str]:
    """
    Reads (stomach_health_score, risk_tier) defensively from a medicine profile.

    MedicineProfileResponse declares gi_profile as required, so a model built
    through Pydantic always has one. This helper additionally tolerates a profile
    supplied as a plain dict or built by a future code path that leaves gi_profile
    unset, because a missing GI profile must degrade to the neutral baseline
    rather than raise AttributeError mid-analysis.
    """
    if profile is None:
        return DEFAULT_GI_SCORE, DEFAULT_GI_TIER

    gi = getattr(profile, "gi_profile", None)
    if gi is None and isinstance(profile, dict):
        gi = profile.get("gi_profile")
    if gi is None:
        return DEFAULT_GI_SCORE, DEFAULT_GI_TIER

    if isinstance(gi, dict):
        score = gi.get("stomach_health_score", DEFAULT_GI_SCORE)
        tier = gi.get("risk_tier", DEFAULT_GI_TIER)
    else:
        score = getattr(gi, "stomach_health_score", DEFAULT_GI_SCORE)
        tier = getattr(gi, "risk_tier", DEFAULT_GI_TIER)

    try:
        score = int(score)
    except (TypeError, ValueError):
        score = DEFAULT_GI_SCORE

    # risk_tier may arrive as a RiskTier enum or a bare string.
    tier_str = tier.value if isinstance(tier, RiskTier) else str(tier or DEFAULT_GI_TIER)
    return score, tier_str


def calculate_composite_gi_score(
    medicines: List[str],
    profiles: Dict[str, MedicineProfileResponse]
) -> Tuple[int, str, List[Dict[str, Any]], List[str]]:
    """
    Calculates the Stomach Guardian Composite GI Score (0-100) based on cumulative mucosal load,
    multi-NSAID compounding penalties, Anticoagulant + NSAID synergy, and PPI protection credits.
    """
    if not medicines:
        return 20, "gentle", [], []

    total_base_score = 0
    contributors = []
    nsaid_count = 0
    ppi_present = False
    anticoagulant_count = 0

    for med in medicines:
        profile = profiles.get(med)
        aliases = expand_aliases(med)
        med_score, med_tier = _read_gi_profile(profile)

        # Check for PPIs (protective)
        if any(ppi in aliases for ppi in ["omeprazole", "pantoprazole", "esomeprazole", "lansoprazole", "rabeprazole"]):
            ppi_present = True

        # Check for NSAIDs / High GI irritants
        if any(nsaid in aliases for nsaid in ["ibuprofen", "aspirin", "naproxen", "diclofenac", "celecoxib", "ketoprofen", "meloxicam", "indomethacin"]):
            nsaid_count += 1

        # Check for Anticoagulants / Antiplatelets
        if any(ac in aliases for ac in ["warfarin", "clopidogrel", "apixaban", "rivaroxaban", "dabigatran", "edoxaban", "prasugrel", "ticagrelor"]):
            anticoagulant_count += 1

        contributors.append({
            "drug": med.capitalize(),
            "score_impact": med_score,
            "tier": med_tier,
            "mechanism_short": "Direct mucosal erosion & COX inhibition" if med_score > 60 else "Metabolic / Mild GI burden" if med_score > 30 else "Gentle mucosal profile"
        })
        total_base_score += med_score

    # Average base score
    base_average = total_base_score // len(medicines)
    composite = base_average

    # Multi-NSAID Compounding Penalty (+25 pts)
    if nsaid_count >= 2:
        composite += 25
        contributors.append({
            "drug": "Dual NSAID Compounding Penalty",
            "score_impact": 25,
            "tier": "high",
            "mechanism_short": "Simultaneous inhibition of gastroprotective COX-1 prostaglandins multiplies ulcer risk"
        })

    # Anticoagulant + NSAID Synergistic Hemorrhagic Hazard (+30 pts)
    if anticoagulant_count > 0 and nsaid_count > 0:
        composite += 30
        contributors.append({
            "drug": "Anticoagulant + NSAID Synergistic Bleeding Hazard",
            "score_impact": 30,
            "tier": "high",
            "mechanism_short": "Synergistic breakdown of coagulation and gastric mucosal barrier multiplies major upper GI bleeding events 3-5x"
        })

    # PPI Protective Mitigation Credit (-20 pts)
    if ppi_present:
        composite = max(10, composite - 20)
        contributors.append({
            "drug": "PPI Gastro-Protection Credit",
            "score_impact": -20,
            "tier": "gentle",
            "mechanism_short": "Proton pump inhibition reduces gastric acid, mitigating mucosal erosion"
        })

    composite_score = min(100, max(5, composite))

    if composite_score > 60:
        tier = "high"
    elif composite_score > 30:
        tier = "moderate"
    else:
        tier = "gentle"

    recommendations = []
    if anticoagulant_count > 0 and nsaid_count > 0:
        recommendations.append("Critical Anticoagulant + NSAID combination: consult prescriber immediately regarding PPI gastro-protection or alternative analgesics.")
    if nsaid_count > 0:
        recommendations.append("Administer NSAID medications with meals or a glass of milk to buffer gastric acid.")
    if nsaid_count >= 2:
        recommendations.append("Dual NSAID regimen detected: discuss co-prescribing a gastroprotective agent (PPI) with your physician.")
    if ppi_present:
        recommendations.append("Proton Pump Inhibitor (PPI) detected: provides mucosal gastro-protection.")
    if any("alcohol" in expand_aliases(m) for m in medicines):
        recommendations.append("Avoid alcoholic beverages, which exponentially increase gastric mucosal bleeding risk.")
    if not recommendations:
        recommendations.append("Maintain standard hydration and adhere to prescribed timing directions.")

    return composite_score, tier, contributors, recommendations

def detect_side_effect_amplifications(
    medicines: List[str], 
    profiles: Dict[str, MedicineProfileResponse]
) -> List[AmplifiedSideEffect]:
    """
    Scans across all active medicine profiles to detect compounded physiological side effects:
    - Bleeding & Hemorrhage
    - Sedation & CNS Depression
    - Hypotension & Dizziness
    - Gastrointestinal Mucosal Stress
    - Hyperkalemia (Potassium Elevation)
    - Hepatic Strain & Transaminase Elevation
    """
    amplified_list: List[AmplifiedSideEffect] = []
    if len(medicines) < 2:
        return amplified_list

    bleeding_sources = []
    drowsiness_sources = []
    hypotension_sources = []
    gi_sources = []
    hyperkalemia_sources = []
    hepatic_sources = []

    for med in medicines:
        aliases = expand_aliases(med)
        
        # Bleeding risks
        if any(d in aliases for d in ["warfarin", "aspirin", "ibuprofen", "clopidogrel", "naproxen", "apixaban", "rivaroxaban", "dabigatran", "prasugrel"]):
            bleeding_sources.append(med.capitalize())
            
        # Sedation / Drowsiness risks
        if any(d in aliases for d in ["alprazolam", "diazepam", "diphenhydramine", "cetirizine", "gabapentin", "pregabalin", "alcohol", "lorazepam", "zolpidem"]):
            drowsiness_sources.append(med.capitalize())
            
        # Hypotension risks
        if any(d in aliases for d in ["lisinopril", "amlodipine", "metoprolol", "furosemide", "sildenafil", "tadalafil", "atenolol", "losartan", "carvedilol"]):
            hypotension_sources.append(med.capitalize())

        # Gastrointestinal irritation
        if any(d in aliases for d in ["ibuprofen", "aspirin", "naproxen", "metformin", "augmentin", "amoxicillin/clavulanate", "diclofenac", "prednisone"]):
            gi_sources.append(med.capitalize())

        # Hyperkalemia risks
        if any(d in aliases for d in ["lisinopril", "losartan", "spironolactone", "potassium", "eplerenone", "triamterene", "valsartan"]):
            hyperkalemia_sources.append(med.capitalize())

        # Hepatic stress risks
        if any(d in aliases for d in ["paracetamol", "acetaminophen", "alcohol", "atorvastatin", "simvastatin", "methotrexate", "augmentin", "amoxicillin/clavulanate"]):
            hepatic_sources.append(med.capitalize())

    if len(bleeding_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Compounded Bleeding & Hemorrhage Risk",
            sources=bleeding_sources,
            severity="severe",
            amplified=True,
            clinical_note=f"Multiple antiplatelet/anticoagulant agents ({', '.join(bleeding_sources)}) compound microvascular and major bleeding hazards."
        ))

    if len(drowsiness_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Amplified CNS Depression & Sedation",
            sources=drowsiness_sources,
            severity="moderate",
            amplified=True,
            clinical_note=f"Co-administration of sedative agents ({', '.join(drowsiness_sources)}) significantly impairs psychomotor function and alertness."
        ))

    if len(hypotension_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Compounded Hypotension & Orthostatic Dizziness",
            sources=hypotension_sources,
            severity="moderate",
            amplified=True,
            clinical_note=f"Concurrent antihypertensive agents ({', '.join(hypotension_sources)}) may precipitate acute postural hypotension."
        ))

    if len(gi_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Compounded Gastrointestinal Mucosal Stress",
            sources=gi_sources,
            severity="moderate",
            amplified=True,
            clinical_note=f"Multiple gastrointestinal irritants ({', '.join(gi_sources)}) increase dyspepsia, nausea, and ulcer risk."
        ))

    if len(hyperkalemia_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Amplified Hyperkalemia Risk",
            sources=hyperkalemia_sources,
            severity="severe",
            amplified=True,
            clinical_note=f"Concurrent potassium-sparing or ACEi/ARB agents ({', '.join(hyperkalemia_sources)}) significantly increase life-threatening serum potassium retention."
        ))

    if len(hepatic_sources) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Compounded Hepatic Metabolic Stress",
            sources=hepatic_sources,
            severity="moderate",
            amplified=True,
            clinical_note=f"Concurrent hepatically metabolized agents or alcohol ({', '.join(hepatic_sources)}) increase transaminase strain and liver injury risk."
        ))

    return amplified_list
