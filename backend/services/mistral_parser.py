"""
MEDCHECK Pharmacology Services Facade.
Re-exports modularized domain services for backward compatibility across existing endpoints and tests.
"""

from services.knowledge_base import (
    CLINICAL_KB_VERSION,
    COMMON_BRAND_MAPPINGS,
    SYNONYM_SETS,
    CURATED_MEDICINE_PROFILES,
    get_or_build_medicine_profile
)
from services.clinical_rules import (
    KNOWN_CLINICAL_RULES,
    resolve_canonical_name,
    expand_aliases,
    match_known_clinical_rule
)
from services.gi_engine import (
    calculate_composite_gi_score,
    detect_side_effect_amplifications
)
from services.timeline_engine import (
    generate_food_conflicts_and_timeline
)
from services.search_engine import (
    search_medicine_database
)
from services.interaction_analyzer import (
    analyze_drug_pair,
    parse_drug_label_from_dict
)
from services.mistral_client import (
    call_mistral_api,
    circuit_breaker
)

# Compatibility aliases
parse_drug_label_with_mistral = parse_drug_label_from_dict
get_primary_generic_name = resolve_canonical_name
resolve_drug_aliases = expand_aliases
extract_mention_context_window = lambda *args, **kwargs: ""
evaluate_window_severity = lambda *args, **kwargs: "moderate"

__all__ = [
    "CLINICAL_KB_VERSION",
    "COMMON_BRAND_MAPPINGS",
    "SYNONYM_SETS",
    "CURATED_MEDICINE_PROFILES",
    "KNOWN_CLINICAL_RULES",
    "get_or_build_medicine_profile",
    "resolve_canonical_name",
    "get_primary_generic_name",
    "expand_aliases",
    "resolve_drug_aliases",
    "match_known_clinical_rule",
    "calculate_composite_gi_score",
    "detect_side_effect_amplifications",
    "generate_food_conflicts_and_timeline",
    "search_medicine_database",
    "analyze_drug_pair",
    "parse_drug_label_from_dict",
    "parse_drug_label_with_mistral",
    "call_mistral_api",
    "circuit_breaker"
]
