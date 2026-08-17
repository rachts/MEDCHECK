import httpx
import logging
from typing import Optional, Dict, Any, List

logger = logging.getLogger("openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

async def fetch_drug_label(drug_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch drug label from openFDA with multiple query fallbacks.
    Returns normalized label dictionary or None if not found.
    """
    cleaned_name = drug_name.strip().lower()
    if not cleaned_name:
        return None

    search_queries = [
        f'openfda.generic_name:"{cleaned_name}"',
        f'openfda.brand_name:"{cleaned_name}"',
        f'openfda.substance_name:"{cleaned_name}"',
        f'search=description:"{cleaned_name}"+OR+indications_and_usage:"{cleaned_name}"'
    ]

    async with httpx.AsyncClient(timeout=8.0) as client:
        for query in search_queries:
            try:
                if query.startswith("search="):
                    url = f"{OPENFDA_LABEL_URL}?{query}&limit=1"
                else:
                    url = f"{OPENFDA_LABEL_URL}?search={query}&limit=1"

                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    if results:
                        label = results[0]
                        return extract_label_info(label, fallback_name=cleaned_name)
            except httpx.TimeoutException:
                logger.warning(f"openFDA request timed out for query '{query}'")
            except Exception as e:
                logger.warning(f"openFDA search error for query '{query}': {e}")

    logger.info(f"No openFDA label found for '{drug_name}'")
    return None

def extract_label_info(raw_label: Dict[str, Any], fallback_name: str) -> Dict[str, Any]:
    """
    Extract relevant pharmacology & warning fields from raw openFDA JSON.
    """
    openfda = raw_label.get("openfda", {})
    
    generic_names = openfda.get("generic_name", [])
    brand_names = openfda.get("brand_name", [])
    substance_names = openfda.get("substance_name", [])
    
    generic_name = generic_names[0].lower() if generic_names else fallback_name
    
    warnings = raw_label.get("warnings", [])
    boxed_warnings = raw_label.get("boxed_warning", [])
    drug_interactions = raw_label.get("drug_interactions", [])
    adverse_reactions = raw_label.get("adverse_reactions", [])
    food_interactions = raw_label.get("food_and_drug_interactions", [])
    contraindications = raw_label.get("contraindications", [])
    precautions = raw_label.get("precautions", [])

    return {
        "generic_name": generic_name,
        "brand_names": [b.lower() for b in brand_names],
        "substance_names": [s.lower() for s in substance_names],
        "warnings": warnings,
        "boxed_warnings": boxed_warnings,
        "drug_interactions": drug_interactions,
        "adverse_reactions": adverse_reactions,
        "food_interactions": food_interactions,
        "contraindications": contraindications,
        "precautions": precautions,
        "raw_text_summary": "\n".join(
            boxed_warnings + warnings + drug_interactions + contraindications + food_interactions
        )[:8000]
    }
