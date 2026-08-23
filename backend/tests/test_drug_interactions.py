import pytest
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from models import CheckRequest, InteractionItem
from services.supabase_cache import get_canonical_pair
from services.openfda import sanitize_for_openfda_query, extract_label_info
from services.mistral_parser import (
    resolve_drug_aliases,
    get_primary_generic_name,
    get_or_build_medicine_profile,
    calculate_composite_gi_score,
    detect_side_effect_amplifications,
    generate_food_conflicts_and_timeline,
    search_medicine_database,
    analyze_drug_pair,
    KNOWN_CLINICAL_RULES
)
from services.auth import create_access_token
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Helper for authenticated client headers
def get_auth_headers():
    token = create_access_token({"sub": "test_doctor", "uid": "doc-123", "is_guest": False})
    return {"Authorization": f"Bearer {token}"}

# =============================================================================
# 1. Brand-Name & Synonym Resolution Tests
# =============================================================================

def test_brand_name_resolution():
    """Verify that common brand names resolve to their active generic ingredients."""
    assert get_primary_generic_name("Advil") == "ibuprofen"
    assert get_primary_generic_name("Tylenol") == "paracetamol"
    assert get_primary_generic_name("Coumadin") == "warfarin"
    assert get_primary_generic_name("Glucophage") == "metformin"
    assert get_primary_generic_name("Lipitor") == "atorvastatin"
    assert get_primary_generic_name("Prilosec") == "omeprazole"
    assert get_primary_generic_name("Plavix") == "clopidogrel"
    assert get_primary_generic_name("Synthroid") == "levothyroxine"

def test_alias_expansion():
    """Verify that resolve_drug_aliases includes generic, brand, and synonym terms."""
    advil_aliases = resolve_drug_aliases("Advil")
    assert "advil" in advil_aliases
    assert "ibuprofen" in advil_aliases

    tylenol_aliases = resolve_drug_aliases("Tylenol")
    assert "tylenol" in tylenol_aliases
    assert "paracetamol" in tylenol_aliases
    assert "acetaminophen" in tylenol_aliases

# =============================================================================
# 2. Clinical Rule Engine Tests with Brand Names
# =============================================================================

@pytest.mark.asyncio
async def test_warfarin_and_advil_high_risk():
    """Critical clinical safety test: Warfarin + Advil MUST trigger high-risk alert."""
    result = await analyze_drug_pair("Warfarin", "Advil")
    assert result is not None
    assert result.severity.value == "high"
    assert "bleeding" in result.explanation.lower() or "hemorrhage" in result.explanation.lower()
    assert result.mechanism is not None
    assert result.stomach_impact is not None

@pytest.mark.asyncio
async def test_coumadin_and_bayer_aspirin_high_risk():
    """Brand-to-brand pair: Coumadin (Warfarin) + Bayer (Aspirin) -> High Risk."""
    result = await analyze_drug_pair("Coumadin", "Bayer")
    assert result is not None
    assert result.severity.value == "high"

@pytest.mark.asyncio
async def test_tylenol_and_alcohol_moderate_risk():
    """Tylenol (Paracetamol) + Alcohol -> Moderate hepatic toxicity risk."""
    result = await analyze_drug_pair("Tylenol", "Alcohol")
    assert result is not None
    assert result.severity.value == "moderate"

@pytest.mark.asyncio
async def test_rule_order_invariance():
    """Drug pair evaluation must produce identical severity regardless of input order."""
    forward = await analyze_drug_pair("Ibuprofen", "Aspirin")
    reverse = await analyze_drug_pair("Aspirin", "Ibuprofen")
    assert forward is not None
    assert reverse is not None
    assert forward.severity == reverse.severity == "moderate"

# =============================================================================
# 3. Individual Medicine Profile Intelligence Tests
# =============================================================================

def test_ibuprofen_profile_intelligence():
    """Verify Ibuprofen profile returns categorized side effects, food interactions, and high GI score."""
    profile = get_or_build_medicine_profile("Ibuprofen")
    assert profile.generic_name == "ibuprofen"
    assert profile.category.startswith("NSAID")
    assert len(profile.side_effects) >= 4
    frequencies = [se.frequency.value for se in profile.side_effects]
    assert "very_common" in frequencies or "common" in frequencies
    assert profile.gi_profile.stomach_health_score >= 50
    assert profile.gi_profile.risk_tier.value == "high"
    food_types = [fi.type for fi in profile.food_interactions]
    assert "take_with_food" in food_types

def test_levothyroxine_food_rules():
    """Levothyroxine must strictly require empty stomach and dairy separation."""
    profile = get_or_build_medicine_profile("Levothyroxine")
    food_types = [fi.type for fi in profile.food_interactions]
    assert "empty_stomach" in food_types
    assert "avoid_dairy_2h" in food_types

# =============================================================================
# 4. Stomach Guardian Composite Score Tests
# =============================================================================

def test_stomach_guardian_sarah_scenario():
    """
    Sarah Demo: Warfarin + Aspirin + Ibuprofen
    Combining multiple NSAIDs + Anticoagulant MUST trigger High GI score (>= 75).
    """
    drugs = ["warfarin", "aspirin", "ibuprofen"]
    profiles = {d: get_or_build_medicine_profile(d) for d in drugs}
    composite, tier, contributors, recs = calculate_composite_gi_score(drugs, profiles)
    assert composite >= 75
    assert tier == "high"
    assert len(contributors) >= 3

def test_stomach_guardian_ppi_mitigation():
    """Adding a PPI (Omeprazole) should reduce the GI stress penalty."""
    high_risk_drugs = ["aspirin", "ibuprofen"]
    high_profiles = {d: get_or_build_medicine_profile(d) for d in high_risk_drugs}
    score_without_ppi, _, _, _ = calculate_composite_gi_score(high_risk_drugs, high_profiles)

    with_ppi_drugs = ["aspirin", "ibuprofen", "omeprazole"]
    with_ppi_profiles = {d: get_or_build_medicine_profile(d) for d in with_ppi_drugs}
    score_with_ppi, _, _, recs = calculate_composite_gi_score(with_ppi_drugs, with_ppi_profiles)

    assert score_with_ppi < score_without_ppi

# =============================================================================
# 5. Side Effect Amplification Tests
# =============================================================================

def test_side_effect_amplification_bleeding():
    """Warfarin + Ibuprofen must flag amplified GI Bleeding hazard."""
    drugs = ["warfarin", "ibuprofen"]
    profiles = {d: get_or_build_medicine_profile(d) for d in drugs}
    amplifications = detect_side_effect_amplifications(drugs, profiles)
    effects = [a.effect for a in amplifications]
    assert any("Bleeding" in e for e in effects)

def test_side_effect_amplification_drowsiness():
    """Multiple sedatives/alcohol must flag amplified CNS Depression/Drowsiness."""
    drugs = ["alprazolam", "alcohol"]
    profiles = {d: get_or_build_medicine_profile(d) for d in drugs}
    amplifications = detect_side_effect_amplifications(drugs, profiles)
    effects = [a.effect for a in amplifications]
    assert any("Drowsiness" in e or "CNS Depression" in e for e in effects)

# =============================================================================
# 6. Food Conflicts & Daily Timeline Tests
# =============================================================================

def test_food_conflict_and_timeline():
    """Levothyroxine (empty stomach) + Ibuprofen (with food) generates conflict and slots."""
    drugs = ["levothyroxine", "ibuprofen"]
    profiles = {d: get_or_build_medicine_profile(d) for d in drugs}
    conflicts, timeline = generate_food_conflicts_and_timeline(drugs, profiles)
    assert len(conflicts) >= 1
    assert "empty stomach" in conflicts[0].conflict.lower()
    assert len(timeline) >= 3

# =============================================================================
# 7. Search Autocomplete Tests
# =============================================================================

def test_search_medicine_database():
    """Search for 'adv' should match Advil with stomach score and top side effects."""
    results = search_medicine_database("adv")
    assert len(results) >= 1
    assert any("Advil" in r.name or "Ibuprofen" in r.name for r in results)
    assert results[0].stomach_score is not None

# =============================================================================
# 8. End-to-End API Endpoint Tests (with Authentication)
# =============================================================================

def test_api_health_endpoint():
    """Test public health check endpoint."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ok", "degraded")
    assert "clinical_kb_version" in data

def test_api_medicine_profile_endpoint():
    """Test GET /api/medicine/{name}/profile with Bearer auth."""
    response = client.get("/api/medicine/Ibuprofen/profile", headers=get_auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert data["generic_name"] == "ibuprofen"
    assert len(data["side_effects"]) > 0
    assert data["gi_profile"]["stomach_health_score"] >= 50

def test_api_medicines_search_endpoint():
    """Test GET /api/medicines/search?q=aspirin with Bearer auth."""
    response = client.get("/api/medicines/search?q=aspirin", headers=get_auth_headers())
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["generic_name"] == "aspirin"

def test_api_check_sarah_scenario():
    """Test POST /api/check with Sarah Scenario (Warfarin, Aspirin, Ibuprofen) with auth."""
    response = client.post(
        "/api/check", 
        json={"medicines": ["Warfarin", "Aspirin", "Ibuprofen"]},
        headers=get_auth_headers()
    )
    assert response.status_code == 200
    data = response.json()
    assert data["safe"] is False
    assert len(data["interactions"]) >= 2
    assert data["composite_gi_score"] >= 70
    assert data["composite_gi_tier"] == "high"
    assert len(data["aggregated_side_effects"]) >= 1
    assert len(data["profiles"]) == 3
