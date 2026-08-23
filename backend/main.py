import os
import sys
import asyncio
import itertools
import logging
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Ensure backend directory is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from models import (
    CheckRequest,
    CheckResponse,
    InteractionItem,
    MedicineProfileResponse,
    MedicineSearchResult
)
from services.openfda import fetch_drug_label
from services.mistral_parser import (
    parse_drug_label_with_mistral,
    analyze_drug_pair,
    get_or_build_medicine_profile,
    calculate_composite_gi_score,
    detect_side_effect_amplifications,
    generate_food_conflicts_and_timeline,
    search_medicine_database
)
from services.supabase_cache import (
    get_cached_interaction,
    save_interaction_to_cache,
    get_cached_drug_detail,
    save_drug_detail_to_cache
)

# Logging configuration
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("medcheck_api")

app = FastAPI(
    title="MedCheck Clinical Intelligence Platform",
    description="Next-generation medicine safety dashboard with deep individual drug profiling, GI health scoring, and pairwise interaction checking.",
    version="2.0.0"
)

# CORS configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    """Health check endpoint required by spec."""
    return {"status": "ok", "service": "MedCheck Clinical Intelligence API", "version": "2.0.0"}

async def fetch_and_cache_single_drug(drug_name: str) -> Dict[str, Any]:
    """
    Fetch drug label from cache or openFDA.
    Always returns a dictionary with a 'found' boolean flag to prevent repeated fetching.
    """
    cleaned_name = drug_name.strip().lower()

    # 1. Check local/Supabase cache
    cached_detail = await get_cached_drug_detail(cleaned_name)
    if cached_detail:
        return {
            "generic_name": cached_detail.get("generic_name", cleaned_name),
            "brand_names": cached_detail.get("brand_names", []),
            "raw_text_summary": cached_detail.get("raw_text_summary", "") or cached_detail.get("raw_text", "") or "",
            "found": True
        }

    # 2. Fetch live openFDA label
    try:
        raw_label = await fetch_drug_label(cleaned_name)
        if raw_label:
            parsed = await parse_drug_label_with_mistral(raw_label)
            await save_drug_detail_to_cache(
                generic_name=parsed.get("generic_name", cleaned_name),
                brand_names=parsed.get("brand_names", []),
                side_effects=parsed.get("side_effects", []),
                food_warnings=parsed.get("food_warnings", []),
                drug_interactions=parsed.get("drug_interactions", []),
                severity=parsed.get("severity", "moderate"),
                raw_text=raw_label.get("raw_text_summary")
            )
            raw_label["found"] = True
            return raw_label
    except Exception as e:
        logger.warning(f"Error fetching openFDA label for '{drug_name}': {e}")

    return {
        "generic_name": cleaned_name,
        "brand_names": [],
        "substance_names": [],
        "raw_text_summary": "",
        "found": False
    }

@app.get("/api/medicine/{name}/profile", response_model=MedicineProfileResponse)
async def get_medicine_profile(name: str):
    """
    Returns rich individual medicine profile: side effects by frequency,
    food interactions, stomach health score, and clinical guidance.
    """
    label_info = await fetch_and_cache_single_drug(name)
    profile = get_or_build_medicine_profile(name, label=label_info if label_info.get("found") else None)
    return profile

@app.get("/api/medicines/search", response_model=List[MedicineSearchResult])
async def search_medicines(q: str = Query("", description="Search term for medicine name or brand")):
    """
    Autocomplete search returning rich preview cards with stomach risk and top side effects.
    """
    results = search_medicine_database(q)
    return results

@app.post("/api/check", response_model=CheckResponse)
@app.post("/api/basket/analyze", response_model=CheckResponse)
async def check_or_analyze_basket(req: CheckRequest):
    """
    Full clinical intelligence pipeline for a basket of medicines:
    - Pairwise drug-drug interactions
    - Composite Stomach Guardian GI Risk Score & Contributors
    - Side Effect Amplification Detection
    - Food Conflict & 24-Hour Daily Timing Schedule
    - Complete Individual Drug Intelligence Profiles
    """
    medicines = req.medicines
    logger.info(f"Analyzing basket ({len(medicines)} medicines): {medicines}")

    # 1. Concurrently fetch/cache labels for all unique medicines in parallel
    label_results = await asyncio.gather(*[fetch_and_cache_single_drug(m) for m in medicines])
    drug_labels_map: Dict[str, Dict[str, Any]] = {
        med: label for med, label in zip(medicines, label_results)
    }

    # 2. Build full profiles for all medicines in basket
    profiles: Dict[str, MedicineProfileResponse] = {}
    for med in medicines:
        lbl = drug_labels_map.get(med)
        profiles[med] = get_or_build_medicine_profile(med, label=lbl if lbl and lbl.get("found") else None)

    # 3. Generate all unique pairwise combinations
    pairs = list(itertools.combinations(medicines, 2))
    detected_interactions: List[InteractionItem] = []
    missing_data_count = 0

    for drug_a, drug_b in pairs:
        label_a = drug_labels_map.get(drug_a)
        label_b = drug_labels_map.get(drug_b)

        # Check interaction cache
        cached_interaction = await get_cached_interaction(drug_a, drug_b)
        if cached_interaction:
            if cached_interaction.severity != "none":
                detected_interactions.append(cached_interaction)
            continue

        # Analyze Interaction Pair
        interaction = await analyze_drug_pair(
            drug_a=drug_a,
            drug_b=drug_b,
            label_a=label_a,
            label_b=label_b
        )

        has_label_data = (label_a and label_a.get("found")) or (label_b and label_b.get("found"))

        if interaction:
            await save_interaction_to_cache(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=interaction.severity,
                explanation=interaction.explanation,
                mechanism=interaction.mechanism,
                clinical_impact=interaction.clinical_impact,
                stomach_impact=interaction.stomach_impact,
                food_consideration=interaction.food_consideration,
                action_guidance=interaction.action_guidance
            )
            detected_interactions.append(interaction)
        elif has_label_data:
            await save_interaction_to_cache(
                drug_a=drug_a,
                drug_b=drug_b,
                severity="none",
                explanation="No clinically significant interaction detected in verified database."
            )
        else:
            missing_data_count += 1

    # 4. Calculate Stomach Guardian Composite GI Score
    gi_score, gi_tier, gi_contributors, gi_recs = calculate_composite_gi_score(medicines, profiles)

    # 5. Detect Side Effect Amplifications
    amplified_side_effects = detect_side_effect_amplifications(medicines, profiles)

    # 6. Generate Food Conflicts & 24-Hour Timeline
    food_conflicts, timeline = generate_food_conflicts_and_timeline(medicines, profiles)

    is_safe = len(detected_interactions) == 0

    if is_safe:
        if len(medicines) == 1:
            summary_text = f"Profile analyzed for {medicines[0].capitalize()}. Add a second medicine to check pairwise interactions."
        elif missing_data_count > 0:
            summary_text = "No known drug-drug interactions detected. Note: Limited FDA label data for some items."
        else:
            summary_text = "No known interactions detected between the selected medicines in verified clinical databases."
    else:
        summary_text = f"Identified {len(detected_interactions)} potential interaction{'s' if len(detected_interactions) > 1 else ''} across {len(pairs)} analyzed pairs."

    return CheckResponse(
        medicines=medicines,
        interactions=detected_interactions,
        safe=is_safe,
        summary=summary_text,
        analyzed_pairs_count=len(pairs),
        composite_gi_score=gi_score,
        composite_gi_tier=gi_tier,
        composite_gi_contributors=gi_contributors,
        composite_gi_recommendations=gi_recs,
        food_conflicts=food_conflicts,
        daily_food_timeline=timeline,
        aggregated_side_effects=amplified_side_effects,
        profiles=profiles
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    is_dev = os.getenv("ENV", "production").lower() in ("development", "dev")
    uvicorn.run("main:app", host=host, port=port, reload=is_dev)
