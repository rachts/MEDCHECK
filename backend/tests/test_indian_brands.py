import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.knowledge_base import (
    COMMON_BRAND_MAPPINGS,
    CURATED_MEDICINE_PROFILES,
    normalize_drug_query,
    get_or_build_medicine_profile
)
from services.clinical_rules import match_known_clinical_rule, resolve_canonical_name
from services.search_engine import search_medicine_database
from models import Severity

def test_indian_brand_mappings_exist():
    """Verify core Indian formulary brand mappings exist in COMMON_BRAND_MAPPINGS."""
    expected_mappings = {
        "dolo": "paracetamol",
        "dolo 650": "paracetamol",
        "crocin": "paracetamol",
        "pan": "pantoprazole",
        "pan 40": "pantoprazole",
        "pantop": "pantoprazole",
        "pantocid": "pantoprazole",
        "omez": "omeprazole",
        "ecosprin": "aspirin",
        "combiflam": "ibuprofen",
        "volini": "diclofenac",
        "azithral": "azithromycin",
        "glycomet": "metformin",
        "gemer": "metformin",
        "stamlo": "amlodipine",
        "telma": "telmisartan",
        "cetzine": "cetirizine",
        "shelcal": "calcium/vitamin d3",
        "meftal spas": "mefenamic acid"
    }
    for brand, generic in expected_mappings.items():
        assert brand in COMMON_BRAND_MAPPINGS, f"Missing brand mapping for {brand}"
        assert COMMON_BRAND_MAPPINGS[brand] == generic

def test_dosage_and_suffix_normalization():
    """Verify that dosage suffixes and formulations are stripped to match canonical drugs."""
    assert normalize_drug_query("Dolo 650") == "paracetamol"
    assert normalize_drug_query("Dolo 650mg") == "paracetamol"
    assert normalize_drug_query("Dolo-650") == "paracetamol"
    assert normalize_drug_query("Crocin Advance") == "paracetamol"
    assert normalize_drug_query("Pan 40") == "pantoprazole"
    assert normalize_drug_query("Pan 40mg") == "pantoprazole"
    assert normalize_drug_query("Pantop 40") == "pantoprazole"
    assert normalize_drug_query("Ecosprin 75") == "aspirin"
    assert normalize_drug_query("Ecosprin 150mg") == "aspirin"
    assert normalize_drug_query("Azithral 500") == "azithromycin"
    assert normalize_drug_query("Augmentin 625") == "amoxicillin/clavulanate"
    assert normalize_drug_query("Omez 20") == "omeprazole"
    assert normalize_drug_query("Telma 40") == "telmisartan"
    assert normalize_drug_query("Shelcal 500") == "calcium/vitamin d3"
    assert normalize_drug_query("Meftal Spas") == "mefenamic acid"

def test_profile_resolution_for_indian_brands():
    """Verify that get_or_build_medicine_profile resolves Indian brands to curated profiles."""
    # Dolo 650 -> Paracetamol
    dolo_profile = get_or_build_medicine_profile("Dolo 650")
    assert dolo_profile.generic_name == "paracetamol"
    assert dolo_profile.data_source == "curated_kb"
    assert dolo_profile.gi_profile.stomach_health_score == 10

    # Pan 40 -> Pantoprazole
    pan_profile = get_or_build_medicine_profile("Pan 40")
    assert pan_profile.generic_name == "pantoprazole"
    assert pan_profile.data_source == "curated_kb"
    assert pan_profile.gi_profile.stomach_health_score == 10

    # Combiflam -> Ibuprofen
    combiflam_profile = get_or_build_medicine_profile("Combiflam")
    assert combiflam_profile.generic_name == "ibuprofen"
    assert combiflam_profile.data_source == "curated_kb"
    assert combiflam_profile.gi_profile.stomach_health_score == 85

def test_interaction_checking_with_indian_brands():
    """Verify that clinical rules correctly match pairwise interactions entered as Indian brands."""
    # Warfarin + Ecosprin 75 -> High bleeding risk
    rule = match_known_clinical_rule("warfarin", "Ecosprin 75")
    assert rule is not None
    assert rule.severity == Severity.HIGH
    assert "bleeding" in rule.clinical_impact.lower()

    # Warfarin + Combiflam -> High bleeding risk
    rule2 = match_known_clinical_rule("Warfarin", "Combiflam")
    assert rule2 is not None
    assert rule2.severity == Severity.HIGH

    # Omeprazole (Omez) + Clopidogrel -> High CYP2C19 interaction
    rule3 = match_known_clinical_rule("Omez 20", "clopidogrel")
    assert rule3 is not None
    assert rule3.severity == Severity.HIGH

def test_search_autocomplete_for_indian_brands():
    """Verify searching for 'Dolo' or 'Pan 40' yields rich preview results with generic context."""
    dolo_results = search_medicine_database("dolo")
    assert len(dolo_results) > 0
    assert any("paracetamol" in r.generic_name.lower() for r in dolo_results)

    pan_results = search_medicine_database("pan 40")
    assert len(pan_results) > 0
    assert any("pantoprazole" in r.generic_name.lower() for r in pan_results)
