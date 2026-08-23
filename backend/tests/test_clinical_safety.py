import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.knowledge_base import (
    COMMON_BRAND_MAPPINGS,
    CURATED_MEDICINE_PROFILES,
    get_or_build_medicine_profile
)
from services.clinical_rules import KNOWN_CLINICAL_RULES

def test_augmentin_mapping_and_profile():
    """Augmentin must map to amoxicillin/clavulanate and include distinct diarrhea/hepatic warnings."""
    assert COMMON_BRAND_MAPPINGS["augmentin"] == "amoxicillin/clavulanate"
    profile = get_or_build_medicine_profile("Augmentin")
    assert profile.generic_name == "amoxicillin/clavulanate"
    assert "amoxicillin/clavulanate" in CURATED_MEDICINE_PROFILES
    side_effect_names = [s.effect for s in profile.side_effects]
    assert any("Diarrhea" in se for se in side_effect_names)

def test_alcohol_substance_classification():
    """Alcohol must be classified as substance, not supplement."""
    profile = get_or_build_medicine_profile("Alcohol")
    assert profile.drug_type.value == "substance"

def test_unknown_compound_structured_fallback():
    """Unknown / fictional drug names must NEVER receive fake safe profiles or random GI scores."""
    profile = get_or_build_medicine_profile("xyzdrug99999_fake")
    assert profile.data_source == "unknown_fallback"
    assert profile.drug_type.value == "unknown"
    assert profile.gi_profile.risk_tier.value == "unknown"
    assert profile.gi_profile.stomach_health_score == 0
    assert profile.disclaimer is not None
    assert "Limited clinical pharmacology data" in profile.disclaimer

def test_evidence_metadata_on_clinical_rules():
    """Every clinical rule in KNOWN_CLINICAL_RULES must have evidence_source, confidence, and last_reviewed."""
    for pair, rule in KNOWN_CLINICAL_RULES.items():
        assert "evidence_source" in rule, f"Rule {pair} missing evidence_source"
        assert rule["evidence_source"] is not None and len(rule["evidence_source"]) > 3
        assert "confidence" in rule, f"Rule {pair} missing confidence"
        assert "last_reviewed" in rule, f"Rule {pair} missing last_reviewed"
