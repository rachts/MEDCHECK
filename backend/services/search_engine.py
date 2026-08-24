from typing import List, Tuple
from models import MedicineSearchResult
from services.knowledge_base import CURATED_MEDICINE_PROFILES, COMMON_BRAND_MAPPINGS

# Machine-readable therapeutic-class slugs derived from the free-text `category`
# prose. The client needs stable identifiers to filter on: matching the prose
# directly means a filter labelled "Pain Relief" has to substring-search strings
# like "Salicylate NSAID & Antiplatelet Agent", which silently stops matching the
# moment the wording is edited. A drug can belong to several classes, so this is
# a list rather than a single slug -- aspirin is genuinely both an NSAID and an
# antiplatelet agent.
CATEGORY_TAG_KEYWORDS: List[Tuple[str, Tuple[str, ...]]] = [
    ("nsaid", ("nsaid", "salicylate", "anti-inflammatory")),
    ("analgesic", ("analgesic", "antipyretic", "nsaid", "salicylate")),
    ("anticoagulant", ("anticoagulant", "antiplatelet", "vitamin k antagonist")),
    ("cardio", ("ace inhibitor", "angiotensin", "statin", "hmg-coa", "beta blocker",
                "antihypertensive", "cardiovascular", "calcium channel")),
    ("diabetes", ("antidiabetic", "biguanide", "insulin", "glycemic", "sulfonylurea")),
    ("gi", ("proton pump", "ppi", "antacid", "gastric", "gastrointestinal",
            "h2 receptor", "antiemetic")),
    ("antibiotic", ("antibiotic", "penicillin", "beta-lactam", "cephalosporin",
                    "macrolide", "quinolone", "tetracycline")),
    ("endocrine", ("thyroid", "hormone", "endocrine", "corticosteroid")),
    ("cns", ("cns", "depressant", "sedative", "benzodiazepine", "opioid",
             "antidepressant", "anticonvulsant")),
]

DEFAULT_CATEGORY_TAG = "general"


def derive_category_tags(category: str, generic_name: str = "") -> List[str]:
    """
    Maps a descriptive category string to stable therapeutic-class slugs.

    The generic name is folded into the haystack so a curated profile whose
    category wording omits the class (or a brand-only row) can still be tagged.
    Always returns at least one tag, so a client filtering on tags never has to
    special-case an empty list.
    """
    haystack = f"{category} {generic_name}".lower()
    tags = [slug for slug, keywords in CATEGORY_TAG_KEYWORDS if any(k in haystack for k in keywords)]
    return tags or [DEFAULT_CATEGORY_TAG]

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
                category_tags=derive_category_tags(category, generic_key),
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
            # A brand-only row has no curated category prose of its own, so the
            # curated profile for its generic is consulted when one exists.
            curated = CURATED_MEDICINE_PROFILES.get(generic, {})
            brand_category = curated.get("category", "Pharmacological Agent")
            results.append(MedicineSearchResult(
                name=brand.capitalize(),
                generic_name=generic,
                category="Pharmacological Agent",
                category_tags=derive_category_tags(brand_category, generic),
                drug_type="prescription" if generic in ["warfarin", "lisinopril", "atorvastatin", "metformin", "amoxicillin"] else "otc",
                stomach_risk_badge="Moderate",
                stomach_score=35,
                top_side_effects=["Consult pharmacist for adverse profile"],
                food_warning_count=1,
                brand_context=f"Brand: {brand.capitalize()} (Generic: {generic.capitalize()})"
            ))

    return results
