import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import Severity
from services.knowledge_base import (
    COMMON_BRAND_MAPPINGS,
    CURATED_MEDICINE_PROFILES,
    get_or_build_medicine_profile
)
from services.clinical_rules import KNOWN_CLINICAL_RULES, match_known_clinical_rule

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

def test_evidence_metadata_on_all_clinical_rules():
    """Every clinical rule in KNOWN_CLINICAL_RULES must have evidence_source, confidence, and last_reviewed."""
    assert len(KNOWN_CLINICAL_RULES) >= 17
    for pair, rule in KNOWN_CLINICAL_RULES.items():
        assert "evidence_source" in rule, f"Rule {pair} missing evidence_source"
        assert rule["evidence_source"] is not None and len(rule["evidence_source"]) > 3
        assert "confidence" in rule, f"Rule {pair} missing confidence"
        assert "last_reviewed" in rule, f"Rule {pair} missing last_reviewed"

def test_added_clinical_interaction_rules():
    """Verify specific high-risk interactions are correctly evaluated."""
    # 1. Omeprazole + Clopidogrel
    clopidogrel_rule = match_known_clinical_rule("omeprazole", "clopidogrel")
    assert clopidogrel_rule is not None
    assert clopidogrel_rule.severity == Severity.HIGH
    assert "CYP2C19" in clopidogrel_rule.mechanism

    # 2. Atorvastatin + Clarithromycin
    statin_rule = match_known_clinical_rule("atorvastatin", "clarithromycin")
    assert statin_rule is not None
    assert statin_rule.severity == Severity.HIGH
    assert "rhabdomyolysis" in statin_rule.explanation.lower()

    # 3. Lisinopril + Potassium
    potassium_rule = match_known_clinical_rule("lisinopril", "potassium")
    assert potassium_rule is not None
    assert potassium_rule.severity == Severity.HIGH
    assert "hyperkalemia" in potassium_rule.explanation.lower()

    # 4. Ciprofloxacin + Theophylline
    theo_rule = match_known_clinical_rule("ciprofloxacin", "theophylline")
    assert theo_rule is not None
    assert theo_rule.severity == Severity.HIGH

def test_unknown_drug_gi_tier_and_average_exclusion():
    """Verify that unknown drugs are excluded from GI average and never falsely labeled gentle."""
    from services.gi_engine import calculate_composite_gi_score

    # 1. Basket of only unknown / unverified compounds
    unknown_drugs = ["xyzdrug99999_fake", "unverified_compound_99"]
    unknown_profiles = {d: get_or_build_medicine_profile(d) for d in unknown_drugs}
    score, tier, contributors, recs = calculate_composite_gi_score(unknown_drugs, unknown_profiles)

    assert tier == "unknown", f"Expected 'unknown' tier for unverified drugs, got '{tier}'"
    assert score == 0, f"Expected 0 score for unverified drugs, got {score}"
    assert any("insufficient" in r.lower() for r in recs)

    # 2. Mixed basket: High GI drug (Aspirin, score 75) + Unknown compound (score 0)
    # The unknown compound (0 score) must NOT pull down Aspirin's base score of 75 to 37
    mixed_drugs = ["aspirin", "xyzdrug99999_fake"]
    mixed_profiles = {d: get_or_build_medicine_profile(d) for d in mixed_drugs}
    mixed_score, mixed_tier, mixed_contributors, mixed_recs = calculate_composite_gi_score(mixed_drugs, mixed_profiles)

    assert mixed_score == 75, f"Unknown drug improperly dragged score down to {mixed_score}"
    assert mixed_tier == "high", f"Expected 'high' tier, got '{mixed_tier}'"
    assert any(c["tier"] == "unknown" for c in mixed_contributors)
