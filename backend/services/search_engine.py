from typing import List
from models import MedicineSearchResult
from services.knowledge_base import CURATED_MEDICINE_PROFILES, COMMON_BRAND_MAPPINGS

def search_medicine_database(query: str) -> List[MedicineSearchResult]:
    """
    Search indexed medication catalog and brand aliases, returning rich preview results.
    """
    q = query.lower().strip()
    results: List[MedicineSearchResult] = []
    seen = set()

    for generic_key, profile in CURATED_MEDICINE_PROFILES.items():
        name = profile.get("name", generic_key.capitalize())
        brand_names = profile.get("brand_names", [])
        category = profile.get("category", "General")
        gi_score = profile.get("gi_profile", {}).get("stomach_health_score", 20)
        gi_tier = profile.get("gi_profile", {}).get("risk_tier", "gentle")
        drug_type = profile.get("drug_type", "otc")
        side_effects = [s.get("effect") for s in profile.get("side_effects", [])[:3]]
        food_count = len(profile.get("food_interactions", []))

        # Check generic name match
        matched_brand = None
        is_match = False
        if not q or q in generic_key or q in name.lower() or q in category.lower():
            is_match = True
        else:
            for b in brand_names:
                if q in b.lower():
                    is_match = True
                    matched_brand = b
                    break

        if is_match and generic_key not in seen:
            seen.add(generic_key)
            badge = "Critical" if gi_score > 60 else "Moderate" if gi_score > 30 else "Gentle"
            
            brand_ctx = f"Matched Brand: {matched_brand} (Generic: {name})" if matched_brand else None

            results.append(MedicineSearchResult(
                name=name,
                generic_name=generic_key,
                category=category,
                drug_type=drug_type,
                stomach_risk_badge=badge,
                stomach_score=gi_score,
                top_side_effects=side_effects,
                food_warning_count=food_count,
                brand_context=brand_ctx
            ))

    # Also search brand mapping index for standalone brands
    for brand, generic in COMMON_BRAND_MAPPINGS.items():
        if generic in seen:
            continue
        if q and (q in brand or q in generic):
            seen.add(generic)
            results.append(MedicineSearchResult(
                name=brand.capitalize(),
                generic_name=generic,
                category="Pharmacological Agent",
                drug_type="prescription" if generic in ["warfarin", "lisinopril", "atorvastatin", "metformin", "amoxicillin"] else "otc",
                stomach_risk_badge="Moderate",
                stomach_score=35,
                top_side_effects=["Consult pharmacist for adverse profile"],
                food_warning_count=1,
                brand_context=f"Brand: {brand.capitalize()} (Generic: {generic.capitalize()})"
            ))

    return results
