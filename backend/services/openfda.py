import re
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger("openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

def sanitize_for_openfda_query(term: str) -> str:
    """
    Sanitize and escape drug name for openFDA Lucene query syntax.
    Escapes special characters: + - && || ! ( ) { } [ ] ^ " ~ * ? : \ /
    """
    cleaned = term.strip().lower()
    # Remove leading/trailing quotes if user supplied them
    cleaned = cleaned.strip('"\'')
    # Escape internal quotes or backslashes
    cleaned = cleaned.replace('\\', '\\\\').replace('"', '\\"')
    return cleaned

async def fetch_drug_label(drug_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch drug label from openFDA with structured query fallbacks.
    Uses httpx params for safe URL encoding and valid FDA label fields.
    Returns normalized label dictionary or None if not found.
    """
    cleaned_name = sanitize_for_openfda_query(drug_name)
    if not cleaned_name:
        return None

    # Valid openFDA drug label fields in priority search order
    search_queries = [
        f'openfda.generic_name:"{cleaned_name}"',
        f'openfda.brand_name:"{cleaned_name}"',
        f'openfda.substance_name:"{cleaned_name}"',
        f'active_ingredient:"{cleaned_name}"',
        f'indications_and_usage:"{cleaned_name}"'
    ]

    async with httpx.AsyncClient(timeout=8.0) as client:
        for query in search_queries:
            try:
                # Let httpx handle param encoding cleanly
                response = await client.get(
                    OPENFDA_LABEL_URL,
                    params={"search": query, "limit": 1}
                )
                if response.status_code == 200:
                    data = response.json()
                    results = data.get("results", [])
                    if results:
                        label = results[0]
                        extracted = extract_label_info(label, fallback_name=cleaned_name)
                        if extracted:
                            logger.info(f"Successfully fetched openFDA label for '{drug_name}' using query '{query}'")
                            return extracted
                elif response.status_code == 404:
                    # Expected if term doesn't match this particular field; continue to next fallback
                    continue
                else:
                    logger.debug(f"openFDA returned status {response.status_code} for query '{query}'")
            except httpx.TimeoutException:
                logger.warning(f"openFDA request timed out for query '{query}'")
            except Exception as e:
                logger.warning(f"openFDA search error for query '{query}': {e}")

    logger.info(f"No openFDA label found for '{drug_name}' across all fallbacks.")
    return None

def extract_label_info(raw_label: Dict[str, Any], fallback_name: str) -> Dict[str, Any]:
    """
    Extract relevant pharmacology & warning fields from raw openFDA JSON.
    """
    openfda = raw_label.get("openfda", {})
    
    generic_names = [g.lower() for g in openfda.get("generic_name", []) if g]
    brand_names = [b.lower() for b in openfda.get("brand_name", []) if b]
    substance_names = [s.lower() for s in openfda.get("substance_name", []) if s]
    
    # Priority for generic name: openfda.generic_name -> openfda.substance_name -> fallback_name
    if generic_names:
        generic_name = generic_names[0]
    elif substance_names:
        generic_name = substance_names[0]
    else:
        generic_name = fallback_name.lower().strip()
    
    warnings = raw_label.get("warnings", [])
    boxed_warnings = raw_label.get("boxed_warning", [])
    drug_interactions = raw_label.get("drug_interactions", [])
    adverse_reactions = raw_label.get("adverse_reactions", [])
    food_interactions = raw_label.get("food_and_drug_interactions", [])
    contraindications = raw_label.get("contraindications", [])
    precautions = raw_label.get("precautions", [])

    return {
        "generic_name": generic_name,
        "brand_names": brand_names,
        "substance_names": substance_names,
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
