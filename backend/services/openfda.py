import re
import asyncio
import logging
import httpx
from typing import Optional, Dict, Any, List

logger = logging.getLogger("openfda")

OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json"

# openFDA search terms are Lucene-style. The term is always wrapped in double
# quotes by the callers below, so the characters that could break out of the
# quoted phrase are the quote itself and the backslash. Everything outside this
# allow-list is dropped rather than escaped, because no legitimate drug name
# needs it and dropping leaves no escape sequence to reason about.
_OPENFDA_TERM_ALLOWED = re.compile(r"[^a-z0-9\s\-\./()',+]")
_OPENFDA_WHITESPACE = re.compile(r"\s+")

# openFDA rejects very long search phrases; drug names never approach this.
MAX_OPENFDA_TERM_LENGTH = 100


def sanitize_for_openfda_query(term: str) -> str:
    """
    Reduces a caller-supplied drug name to a safe quoted-phrase search term.

    Strips quotes, backslashes, control characters and any other character
    outside the allow-list, collapses whitespace, and caps the length.
    """
    if not term:
        return ""
    cleaned = term.strip().lower()
    # Drop everything outside the allow-list. This removes the quote and
    # backslash characters that would otherwise need escaping, as well as
    # newlines and other control codes.
    cleaned = _OPENFDA_TERM_ALLOWED.sub(" ", cleaned)
    cleaned = _OPENFDA_WHITESPACE.sub(" ", cleaned).strip()
    return cleaned[:MAX_OPENFDA_TERM_LENGTH].strip()


# Cap on the concatenated label text kept in raw_text_summary.
#
# Raised from 8000 when adverse_reactions and precautions joined the join above.
# A full FDA adverse-reactions section routinely runs several thousand
# characters on its own, so keeping the old cap would have let the two new
# sections be truncated away again and made that fix cosmetic. The value is
# still bounded: this string is persisted in the drug_details cache and read
# back on every cache hit.
RAW_TEXT_SUMMARY_MAX_CHARS = 16000

# Upper bound on distinct dosage forms reported for one drug. A label listing
# many strengths and presentations would otherwise yield an unbounded list.
MAX_DOSAGE_FORMS = 6

# OpenFDA route codes -> the presentation wording used elsewhere in the app.
# Only routes that actually appear on human-prescription labels are mapped; an
# unmapped route falls through to title-case, which is still far better than the
# blanket "Oral Formulation" every drug used to receive.
_ROUTE_TO_DOSAGE_FORM = {
    "ORAL": "Oral Formulation",
    "INTRAVENOUS": "Intravenous Injection",
    "INTRAMUSCULAR": "Intramuscular Injection",
    "SUBCUTANEOUS": "Subcutaneous Injection",
    "TOPICAL": "Topical Application",
    "TRANSDERMAL": "Transdermal Patch",
    "OPHTHALMIC": "Eye Drops / Ointment",
    "OTIC": "Ear Drops",
    "NASAL": "Nasal Spray",
    "RESPIRATORY (INHALATION)": "Inhalation",
    "INHALATION": "Inhalation",
    "RECTAL": "Rectal Suppository",
    "VAGINAL": "Vaginal Formulation",
    "SUBLINGUAL": "Sublingual Tablet",
    "BUCCAL": "Buccal Formulation",
    "INTRATHECAL": "Intrathecal Injection",
    "EPIDURAL": "Epidural Injection",
}

# Dosage-form words worth recognising inside the free-text
# dosage_forms_and_strengths section, in the wording the app displays.
_DOSAGE_FORM_KEYWORDS = (
    ("extended-release", "Extended-Release Tablet"),
    ("delayed-release", "Delayed-Release Tablet"),
    ("orally disintegrating", "Orally Disintegrating Tablet"),
    ("chewable", "Chewable Tablet"),
    ("capsule", "Capsule"),
    ("tablet", "Tablet"),
    ("suspension", "Oral Suspension"),
    ("solution", "Solution"),
    ("syrup", "Syrup"),
    ("injection", "Injection"),
    ("ointment", "Ointment"),
    ("cream", "Cream"),
    ("gel", "Gel"),
    ("patch", "Transdermal Patch"),
    ("suppository", "Suppository"),
    ("inhaler", "Inhaler"),
    ("powder", "Powder"),
    ("drops", "Drops"),
)


def _extract_dosage_forms(raw_label: Dict[str, Any], openfda: Dict[str, Any]) -> List[str]:
    """
    Derives presentable dosage forms for a drug label.

    Three sources, most structured first:

    1. `openfda.dosage_form`, when the label carries it.
    2. `openfda.route`, which is present on essentially every human-prescription
       label and maps cleanly onto a route-of-administration wording.
    3. The free-text `dosage_forms_and_strengths` section, keyword-scanned.

    All three contribute: a route says how the drug is taken ("Oral Formulation")
    and the free text says what it physically is ("Tablet"), which are different
    facts and both worth showing. Capped so a label listing many strengths cannot
    produce an unbounded list.

    Returns an empty list when none of the three yields anything, so that the
    caller's `.get("dosage_forms", [<default>])` genuinely falls back rather than
    receiving an empty list that reads as "known to have no dosage forms".
    """
    forms: List[str] = []

    def add(value: str) -> None:
        if value and value not in forms and len(forms) < MAX_DOSAGE_FORMS:
            forms.append(value)

    for raw_form in openfda.get("dosage_form", []) or []:
        add(str(raw_form).strip().title())

    for raw_route in openfda.get("route", []) or []:
        key = str(raw_route).strip().upper()
        add(_ROUTE_TO_DOSAGE_FORM.get(key, key.title()))

    free_text = " ".join(raw_label.get("dosage_forms_and_strengths", []) or []).lower()
    if free_text:
        for keyword, label_text in _DOSAGE_FORM_KEYWORDS:
            if keyword in free_text:
                add(label_text)

    return forms


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
                    elif response.status_code in (401, 403):
                        # Credential, quota or WAF rejection. It applies to the whole
                        # API key, not this one query, so abandon every remaining
                        # fallback instead of burning four more rejected requests.
                        logger.error(
                            f"openFDA rejected the request with HTTP {response.status_code} "
                            f"(credentials, quota exhaustion or upstream block). "
                            f"Abandoning all label lookups for '{drug_name}'; "
                            f"the curated knowledge base will be used instead."
                        )
                        return None
                    elif response.status_code >= 500:
                        backoff = 2 ** attempt
                        logger.warning(
                            f"openFDA upstream error HTTP {response.status_code} on '{query}'. "
                            f"Retrying in {backoff}s (attempt {attempt+1}/3)..."
                        )
                        await asyncio.sleep(backoff)
                    else:
                        logger.warning(
                            f"openFDA returned unexpected status {response.status_code} for query '{query}'"
                        )
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

    # Determine Prescription vs OTC from OpenFDA product_type metadata.
    #
    # Tri-state, deliberately. `None` means "the label carried nothing to
    # classify on", which is different from `False` ("the label says this is
    # OTC"). Collapsing the two is what made every unclassifiable drug render as
    # over-the-counter -- see get_or_build_medicine_profile, which now only
    # asserts OTC when this is explicitly False.
    is_rx: Optional[bool] = None
    if product_types:
        is_rx = any("PRESCRIPTION" in str(pt).upper() for pt in product_types)
    else:
        # No structured product_type. Fall back to Rx-only statements in the text.
        dosage_admin = str(raw_label.get("dosage_and_administration", "")).lower()
        if "rx only" in dosage_admin or "prescription" in dosage_admin:
            is_rx = True

    warnings = raw_label.get("warnings", [])
    boxed_warnings = raw_label.get("boxed_warning", [])
    drug_interactions = raw_label.get("drug_interactions", [])
    adverse_reactions = raw_label.get("adverse_reactions", [])
    food_interactions = raw_label.get("food_and_drug_interactions", [])
    contraindications = raw_label.get("contraindications", [])
    precautions = raw_label.get("precautions", [])

    # Sections are concatenated in descending clinical severity, because
    # raw_text_summary is truncated and whatever falls past the cap is invisible
    # to every downstream consumer. Boxed warnings and contraindications must
    # therefore never be the sections that get cut.
    #
    # adverse_reactions and precautions were previously omitted from this join
    # entirely. That was not merely an incomplete summary: the side-effect
    # detectors in knowledge_base.get_or_build_medicine_profile and
    # interaction_analyzer.parse_drug_label_from_dict scan this exact string for
    # "nausea", "vomiting", "drowsiness", "dizziness", "rash" and "hepat" --
    # terms that live almost exclusively in the adverse-reactions section. Side
    # effects were being derived from text that structurally excluded the side
    # effects, so most drugs fell through to the generic two-item placeholder.
    full_text = "\n".join(
        boxed_warnings
        + contraindications
        + warnings
        + drug_interactions
        + food_interactions
        + precautions
        + adverse_reactions
    )

    return {
        "generic_name": generic_name,
        "brand_names": brand_names,
        "substance_names": substance_names,
        "product_types": product_types,
        # None rather than a "Prescription / OTC Drug" placeholder. The
        # placeholder was a non-None value, so a downstream
        # `label.get("pharm_class_cs", <sensible default>)` could never fall back
        # to its default and rendered the placeholder as the drug's category.
        "pharm_class_cs": pharm_class_cs[0] if pharm_class_cs else None,
        "is_rx": is_rx,
        "dosage_forms": _extract_dosage_forms(raw_label, openfda),
        "warnings": warnings,
        "boxed_warnings": boxed_warnings,
        "drug_interactions": drug_interactions,
        "adverse_reactions": adverse_reactions,
        "food_interactions": food_interactions,
        "contraindications": contraindications,
        "precautions": precautions,
        "raw_text_summary": truncate_to_sentences(full_text, max_chars=RAW_TEXT_SUMMARY_MAX_CHARS),
        "found": True
    }
