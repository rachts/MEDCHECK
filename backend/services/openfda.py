import re
import asyncio
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger("openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

def sanitize_for_openfda_query(term: str) -> str:
    cleaned = term.strip().lower()
    cleaned = cleaned.strip('"\'')
    cleaned = cleaned.replace('\\', '\\\\').replace('"', '\\"')
    return cleaned

def truncate_to_sentences(text: str, max_chars: int = 8000) -> str:
    """
    Truncates text at the last complete sentence boundary before max_chars.
    Ensures text never cuts off mid-sentence or mid-word.
    """
    if len(text) <= max_chars:
        return text
    sentences = re.split(r'(?<=[.!?])\s+', text)
    result = []
    current_len = 0
    for s in sentences:
        if current_len + len(s) + 1 <= max_chars:
            result.append(s)
            current_len += len(s) + 1
        else:
            break
    if not result:
        truncated = text[:max_chars]
        last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
        if last_period > 0:
            return truncated[:last_period+1]
        return truncated.rstrip() + "."
    return " ".join(result)

async def fetch_drug_label(drug_name: str) -> Optional[Dict[str, Any]]:
    """
    Fetch drug label from openFDA with structured query fallbacks and exponential backoff retry.
    """
    cleaned_name = sanitize_for_openfda_query(drug_name)
    if not cleaned_name:
        return None

    search_queries = [
        f'openfda.generic_name:"{cleaned_name}"',
        f'openfda.brand_name:"{cleaned_name}"',
        f'openfda.substance_name:"{cleaned_name}"',
        f'active_ingredient:"{cleaned_name}"',
        f'indications_and_usage:"{cleaned_name}"'
    ]

    async with httpx.AsyncClient(timeout=8.0) as client:
        for query in search_queries:
            # Exponential backoff on 429 rate limit (1s, 2s, 4s)
            for attempt in range(3):
                try:
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
                        break
                    elif response.status_code == 404:
                        break
                    elif response.status_code == 429:
                        backoff = 2 ** attempt
                        logger.warning(f"openFDA 429 Rate Limited on '{query}'. Exponential backoff {backoff}s (attempt {attempt+1}/3)...")
                        await asyncio.sleep(backoff)
                    else:
                        logger.debug(f"openFDA returned status {response.status_code} for query '{query}'")
                        break
                except httpx.TimeoutException:
                    logger.warning(f"openFDA request timed out for query '{query}'")
                    break
                except Exception as e:
                    logger.warning(f"openFDA search error for query '{query}': {e}")
                    break

    logger.info(f"No openFDA label found for '{drug_name}' across all fallbacks.")
    return None

def extract_label_info(raw_label: Dict[str, Any], fallback_name: str) -> Dict[str, Any]:
    openfda = raw_label.get("openfda", {})
    
    generic_names = [g.lower() for g in openfda.get("generic_name", []) if g]
    brand_names = [b.lower() for b in openfda.get("brand_name", []) if b]
    substance_names = [s.lower() for s in openfda.get("substance_name", []) if s]
    product_types = openfda.get("product_type", [])
    pharm_class_cs = openfda.get("pharm_class_cs", [])
    
    if generic_names:
        generic_name = generic_names[0]
    elif substance_names:
        generic_name = substance_names[0]
    else:
        generic_name = fallback_name.lower().strip()

    # Determine Prescription vs OTC from OpenFDA product_type metadata
    is_rx = any("PRESCRIPTION" in str(pt).upper() for pt in product_types)
    if not is_rx and not product_types:
        # Fallback check on warnings / Rx-only statements in label text
        dosage_admin = str(raw_label.get("dosage_and_administration", ""))
        if "rx only" in dosage_admin.lower() or "prescription" in dosage_admin.lower():
            is_rx = True
    
    warnings = raw_label.get("warnings", [])
    boxed_warnings = raw_label.get("boxed_warning", [])
    drug_interactions = raw_label.get("drug_interactions", [])
    adverse_reactions = raw_label.get("adverse_reactions", [])
    food_interactions = raw_label.get("food_and_drug_interactions", [])
    contraindications = raw_label.get("contraindications", [])
    precautions = raw_label.get("precautions", [])

    full_text = "\n".join(
        boxed_warnings + warnings + drug_interactions + contraindications + food_interactions
    )

    return {
        "generic_name": generic_name,
        "brand_names": brand_names,
        "substance_names": substance_names,
        "product_types": product_types,
        "pharm_class_cs": pharm_class_cs[0] if pharm_class_cs else "Prescription / OTC Drug",
        "is_rx": is_rx,
        "warnings": warnings,
        "boxed_warnings": boxed_warnings,
        "drug_interactions": drug_interactions,
        "adverse_reactions": adverse_reactions,
        "food_interactions": food_interactions,
        "contraindications": contraindications,
        "precautions": precautions,
        "raw_text_summary": truncate_to_sentences(full_text, max_chars=8000),
        "found": True
    }
