import json
import logging
import re
from typing import Optional, Dict, Any, List, Pattern
from models import InteractionItem, Severity, RuleConfidence, ParsedDrugInfo
from services.clinical_rules import match_known_clinical_rule, expand_aliases, resolve_canonical_name

logger = logging.getLogger("interaction_analyzer")

# Shortest alias worth matching. Single characters are too ambiguous even with
# word boundaries; two characters ("t4") are legitimate drug abbreviations.
MIN_ALIAS_LENGTH = 2

_ALIAS_PATTERN_CACHE: Dict[str, Pattern[str]] = {}


def _alias_pattern(alias: str) -> Optional[Pattern[str]]:
    """
    Builds a word-boundary matcher for a drug alias.

    Plain substring matching produces false positives on short aliases ("asa"
    inside "nasal"), which the previous implementation avoided with a
    `len(alias) > 3` guard. That guard silently discarded every legitimate short
    alias in the synonym table -- "asa" for aspirin, "t4" for levothyroxine,
    "apap" was long enough but "asa"/"t4" were not -- so a boxed warning naming
    only the abbreviation was never detected. Anchoring on alphanumeric
    boundaries removes the false positives without discarding short aliases.

    `\b` is not used because aliases legitimately contain '/' and '.'
    (e.g. "amoxicillin/clavulanate"), around which `\b` behaves unintuitively.
    """
    cleaned = (alias or "").strip().lower()
    if len(cleaned) < MIN_ALIAS_LENGTH:
        return None
    cached = _ALIAS_PATTERN_CACHE.get(cleaned)
    if cached is None:
        cached = re.compile(
            r"(?<![0-9a-z])" + re.escape(cleaned) + r"(?![0-9a-z])"
        )
        _ALIAS_PATTERN_CACHE[cleaned] = cached
    return cached

def parse_drug_label_from_dict(label_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses OpenFDA drug label dictionary into structured pharmacology fields deterministically.
    """
    generic_name = label_dict.get("generic_name", "").lower().strip()
    brand_names = [b.lower().strip() for b in label_dict.get("brand_names", [])]
    raw_text = label_dict.get("raw_text_summary", "")

    side_effects = []
    food_warnings = []
    drug_interactions = []

    text_lower = raw_text.lower()
    if "bleeding" in text_lower or "hemorrhage" in text_lower:
        side_effects.append("Increased bleeding risk")
    if "stomach" in text_lower or "ulcer" in text_lower or "gastrointestinal" in text_lower:
        side_effects.append("Gastrointestinal irritation / ulceration")
    if "drowsiness" in text_lower or "dizziness" in text_lower or "sedation" in text_lower:
        side_effects.append("Drowsiness / Sedation")
    if "nausea" in text_lower or "vomiting" in text_lower:
        side_effects.append("Nausea / Vomiting")

    if "food" in text_lower or "meal" in text_lower:
        food_warnings.append("Take with food to minimize stomach upset")
    if "alcohol" in text_lower:
        food_warnings.append("Avoid alcohol co-administration")
    if "grapefruit" in text_lower:
        food_warnings.append("Avoid grapefruit juice (CYP3A4 inhibition)")

    return {
        "generic_name": generic_name,
        "brand_names": brand_names,
        "side_effects": side_effects,
        "food_warnings": food_warnings,
        "drug_interactions": drug_interactions,
        "severity": "moderate",
        "raw_text": raw_text
    }

async def analyze_drug_pair(
    drug_a: str,
    drug_b: str,
    label_a: Optional[Dict[str, Any]] = None,
    label_b: Optional[Dict[str, Any]] = None
) -> Optional[InteractionItem]:
    """
    Multi-stage interaction analyzer:
    1. Gold-standard deterministic clinical rule engine (sub-millisecond priority).
    2. FDA Label cross-referencing for verified pharmacological interactions.
    """
    # 1. Deterministic Rule Match
    rule_match = match_known_clinical_rule(drug_a, drug_b)
    if rule_match:
        return rule_match

    # 2. FDA Label Cross-Mention Analysis (Deterministic heuristic)
    aliases_a = expand_aliases(drug_a)
    aliases_b = expand_aliases(drug_b)

    found_in_a = False
    found_in_b = False
    excerpt = ""
    is_boxed_warning = False

    if label_a and label_a.get("found"):
        raw_a = label_a.get("raw_text_summary", "")
        text_a = raw_a.lower()
        boxed_a = " ".join(label_a.get("boxed_warnings", [])).lower()
        for b_alias in aliases_b:
            pattern = _alias_pattern(b_alias)
            if pattern is None:
                continue
            match = pattern.search(text_a)
            if match:
                found_in_a = True
                if pattern.search(boxed_a):
                    is_boxed_warning = True
                idx = match.start()
                excerpt = raw_a[max(0, idx - 100):min(len(raw_a), idx + 200)]
                break

    if label_b and label_b.get("found"):
        raw_b = label_b.get("raw_text_summary", "")
        text_b = raw_b.lower()
        boxed_b = " ".join(label_b.get("boxed_warnings", [])).lower()
        for a_alias in aliases_a:
            pattern = _alias_pattern(a_alias)
            if pattern is None:
                continue
            match = pattern.search(text_b)
            if match:
                found_in_b = True
                if pattern.search(boxed_b):
                    is_boxed_warning = True
                if not excerpt:
                    idx = match.start()
                    excerpt = raw_b[max(0, idx - 100):min(len(raw_b), idx + 200)]
                break

    if found_in_a or found_in_b:
        severity = Severity.HIGH if is_boxed_warning else Severity.MODERATE
        return InteractionItem(
            drug_a=drug_a,
            drug_b=drug_b,
            severity=severity,
            explanation=f"Official FDA drug labeling for {drug_a} documents interaction considerations with {drug_b}.",
            mechanism=f"FDA Label Excerpt: {excerpt[:180]}..." if excerpt else "Documented in FDA drug interaction and warning sections.",
            action_guidance="Review dosage schedule and precautions with your healthcare provider or pharmacist.",
            evidence_source="OpenFDA Drug Labeling Section" if not is_boxed_warning else "FDA Boxed Warning Section",
            confidence=RuleConfidence.ESTABLISHED if is_boxed_warning else RuleConfidence.THEORETICAL,
            last_reviewed="2026-08-23"
        )

    return None
