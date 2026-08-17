import os
import itertools
import logging
from typing import List
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from models import CheckRequest, CheckResponse, InteractionItem
from services.openfda import fetch_drug_label
from services.mistral_parser import parse_drug_label_with_mistral, analyze_drug_pair
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
    title="MedCheck API",
    description="AI-powered medicine interaction and safety checker",
    version="1.0.0"
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
    return {"status": "ok", "service": "MedCheck API", "version": "1.0.0"}

@app.post("/api/check", response_model=CheckResponse)
async def check_medicines(req: CheckRequest):
    """
    Check for potential interactions across all unique pairs of submitted medicines.
    Follows Cache-First architecture -> openFDA -> Mistral AI / Rule Engine -> Cache -> Response.
    """
    medicines = req.medicines
    if len(medicines) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least two unique medicines to check for potential interactions."
        )

    logger.info(f"Checking interactions for: {medicines}")

    # Generate all unique pairwise combinations (e.g. A+B, A+C, B+C)
    pairs = list(itertools.combinations(medicines, 2))
    detected_interactions: List[InteractionItem] = []
    drug_labels_cache = {}

    for drug_a, drug_b in pairs:
        # Step 1: Check interaction cache
        cached_interaction = await get_cached_interaction(drug_a, drug_b)
        if cached_interaction:
            if cached_interaction.severity != "none":
                detected_interactions.append(cached_interaction)
            continue

        # Step 2: Fetch / Retrieve Drug A info
        label_a = drug_labels_cache.get(drug_a)
        if label_a is None:
            cached_detail_a = await get_cached_drug_detail(drug_a)
            if cached_detail_a:
                label_a = {"generic_name": cached_detail_a.generic_name, "raw_text_summary": cached_detail_a.raw_text or ""}
            else:
                raw_label_a = await fetch_drug_label(drug_a)
                if raw_label_a:
                    parsed_a = await parse_drug_label_with_mistral(raw_label_a)
                    await save_drug_detail_to_cache(parsed_a)
                    label_a = raw_label_a
            drug_labels_cache[drug_a] = label_a

        # Step 3: Fetch / Retrieve Drug B info
        label_b = drug_labels_cache.get(drug_b)
        if label_b is None:
            cached_detail_b = await get_cached_drug_detail(drug_b)
            if cached_detail_b:
                label_b = {"generic_name": cached_detail_b.generic_name, "raw_text_summary": cached_detail_b.raw_text or ""}
            else:
                raw_label_b = await fetch_drug_label(drug_b)
                if raw_label_b:
                    parsed_b = await parse_drug_label_with_mistral(raw_label_b)
                    await save_drug_detail_to_cache(parsed_b)
                    label_b = raw_label_b
            drug_labels_cache[drug_b] = label_b

        # Step 4: Analyze Interaction Pair
        interaction = await analyze_drug_pair(
            drug_a=drug_a,
            drug_b=drug_b,
            label_a=label_a,
            label_b=label_b
        )

        if interaction:
            await save_interaction_to_cache(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=interaction.severity,
                explanation=interaction.explanation
            )
            detected_interactions.append(interaction)
        else:
            # Cache 'none' to accelerate future duplicate queries
            await save_interaction_to_cache(
                drug_a=drug_a,
                drug_b=drug_b,
                severity="none",
                explanation="No clinically significant interaction detected."
            )

    is_safe = len(detected_interactions) == 0
    summary_text = (
        "No known interactions detected between the selected medicines in our database."
        if is_safe
        else f"Identified {len(detected_interactions)} potential interaction{'s' if len(detected_interactions) > 1 else ''}."
    )

    return CheckResponse(
        medicines=medicines,
        interactions=detected_interactions,
        safe=is_safe,
        summary=summary_text,
        analyzed_pairs_count=len(pairs)
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=True)
