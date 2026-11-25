import json
import os
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from services.knowledge_base import normalize_drug_query


_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BACKEND_DIR, "data", "india_banned_medicines.json")

with open(_DATA_PATH, "r", encoding="utf-8") as _fh:
    _RAW_DATASET: Dict[str, Any] = json.load(_fh)

_ENTRIES: List[Dict[str, Any]] = list(_RAW_DATASET.get("entries", []))

_SALT_WORDS = frozenset({
    "hydrochloride",
    "hydrobromide",
    "sodium",
    "succinate",
    "sulphate",
    "sulfate",
    "maleate",
    "fumarate",
    "phosphate",
    "tartrate",
    "hcl",
    "hbr",
})

_FORM_WORDS = frozenset({
    "tablet",
    "tablets",
    "capsule",
    "capsules",
    "syrup",
    "syrups",
    "suspension",
    "suspensions",
    "solution",
    "solutions",
    "liquid",
    "oral",
    "preparations",
    "preparation",
    "formulation",
    "formulations",
    "injection",
    "injectable",
    "ointment",
    "cream",
    "gel",
    "drops",
    "drop",
    "spray",
    "sr",
    "er",
    "cr",
    "mr",
    "pr",
    "dt",
    "dr",
    "xl",
    "ip",
    "i.p",
    "i.p.",
    "bp",
    "usp",
    "monohydrate",
    "trihydrate",
    "dihydrate",
    "anhydrous",
    "skin/eye",
})

_SYNONYM_MAP: Dict[str, str] = {
    "acetaminophen": "paracetamol",
    "apap": "paracetamol",
    "acetylsalicylic acid": "aspirin",
    "acetyl salicylic acid": "aspirin",
    "asa": "aspirin",
}

_STRENGTH_UNIT_RE = re.compile(
    r"\b\d+(?:\.\d+)?(?:/\d+(?:\.\d+)?)*\s*"
    r"(?:%?\s*w/w|%?\s*w/v|%?\s*v/v|%|mg|mcg|ug|g|kg|ml|l|iu|sp\s+units|units)\b"
)
_RATIO_SLASH_RE = re.compile(r"\b\d+(?:/\d+)+/?\b")
_NUMBER_SLASH_RE = re.compile(r"\b\d+/\b")
_WEIGHT_VOL_RE = re.compile(r"\b(?:w/w|w/v|v/v)\b")


@dataclass(frozen=True)
class BanMatch:
    """Normalized CDSCO / India regulatory match for a medicine or FDC."""

    entry_name: str
    kind: str
    status: str
    notification: Optional[str]
    date: Optional[str]
    source: str
    qualified: bool
    heading: str
    message: str


def normalize_ingredient(raw: str) -> str:
    """
    Normalizes an ingredient or single drug name for exact CDSCO comparison:
    lowercase, trim, collapse spaces, strip salt words, strength/form modifiers,
    and dataset wrapper phrases while reusing `normalize_drug_query`.
    """
    s = re.sub(r"\s+", " ", (raw or "").strip().lower())
    if not s:
        return ""

    # Strip dataset-specific wrapper text found in stored `ingredients` entries.
    s = re.sub(r"^fixed\s+dose\s+combinations?\s+of\s+", "", s)
    s = re.sub(r"\s+formulations?\s+for\s+systemic\s+use.*$", "", s)
    s = re.sub(r"\s+for\s+human\s+use$", "", s)
    s = re.sub(r"\s+and\s+all$", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*", " ", s)
    s = re.sub(r"\s*\([^)]*$", "", s)

    # Strip embedded strength/percentage/unit tokens and stray slashes.
    s = _STRENGTH_UNIT_RE.sub(" ", s)
    s = _WEIGHT_VOL_RE.sub(" ", s)
    s = _RATIO_SLASH_RE.sub(" ", s)
    s = _NUMBER_SLASH_RE.sub(" ", s)
    s = re.sub(r"(?:\s*/\s*)+$", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    if not s:
        return ""

    # Reuse MEDCHECK's brand/dosage/modifier normalizer when it yields a non-empty result.
    ndq = normalize_drug_query(s)
    if ndq:
        s = re.sub(r"(?:\s*/\s*)+$", "", ndq).strip()

    tokens = s.split()
    filtered = [t for t in tokens if t not in _SALT_WORDS and t not in _FORM_WORDS]
    if filtered:
        s = " ".join(filtered)

    # Strip trailing 'per' left over after removing volume specs (e.g. 'per 5ml').
    s = re.sub(r"\s+per$", "", s)
    s = re.sub(r"(?:\s*/\s*)+$", "", s)
    s = re.sub(r"\s+", " ", s).strip()

    return _SYNONYM_MAP.get(s, s)


def _is_qualified_single_entry(entry: Dict[str, Any], norm_ingredient: str) -> bool:
    official = re.sub(r"\s+", " ", (entry.get("name") or "").strip().lower())
    return bool(official and norm_ingredient and len(official) > len(norm_ingredient))


def _status_priority(status: str) -> int:
    s = (status or "").strip()
    low = s.lower()
    if s == "Prohibited":
        return 0
    if s.startswith("Prohibited"):
        return 1
    if s.startswith("Unapproved FDC"):
        return 2
    if s.startswith("Under examination"):
        return 3
    if "quashed" in low or "revoked" in low:
        return 4
    return 5


def plain_status(entry: Dict[str, Any], qualified: Optional[bool] = None) -> Tuple[str, str]:
    """
    Returns deterministic (heading, message) in very simple English for a CDSCO entry.
    """
    status = (entry.get("status") or "").strip()
    name = (entry.get("name") or "").strip()
    notification = (entry.get("notification") or "Not specified").strip()
    low = status.lower()

    if qualified is None:
        raw_ings = entry.get("ingredients") or []
        if len(raw_ings) == 1:
            norm_ing = normalize_ingredient(raw_ings[0])
            qualified = _is_qualified_single_entry(entry, norm_ing)
        else:
            qualified = False

    if status == "Prohibited":
        if qualified:
            return (
                "BANNED IN INDIA IN THIS CASE",
                (
                    "This medicine is banned in India in a specific case. "
                    f"The official entry says: {name}. "
                    f"Notification: {notification}. "
                    "Please read the case carefully and talk to your doctor or pharmacist."
                ),
            )
        return (
            "BANNED IN INDIA",
            (
                "This medicine is banned in India. "
                "The Government of India has stopped its manufacture and sale. "
                f"Notification: {notification}. "
                "Please do not buy or use this medicine. "
                "If you are already taking it, please talk to your doctor before you stop, and ask for a safe alternative."
            ),
        )

    if status.startswith("Unapproved FDC"):
        return (
            "STOPPED IN INDIA: NOT APPROVED",
            (
                "This combination medicine was sold without approval from CDSCO, India's drug regulator. "
                "In April 2025, CDSCO ordered every state to stop its manufacture and sale. "
                "Please do not buy or use this combination. "
                "Ask your doctor for an approved alternative."
            ),
        )

    if status.startswith("Under examination"):
        return (
            "UNDER GOVERNMENT EXAMINATION",
            (
                "The Government of India questioned this combination in 2016. "
                "It is still under examination, so it is not on the final banned list. "
                "Please ask your doctor or pharmacist before using it."
            ),
        )

    if "quashed" in low or "revoked" in low:
        return (
            "BAN CANCELLED BY COURT",
            (
                "This medicine was banned earlier, but the ban is not in force now. "
                f"Official status: {status}. "
                "Please ask your doctor or pharmacist before using it."
            ),
        )

    return (
        "INDIA REGULATORY STATUS",
        (
            f"Official status recorded by CDSCO: {status}. "
            f"Notification: {notification}. "
            "Please ask your doctor or pharmacist before using it."
        ),
    )


def _build_index() -> Tuple[Dict[str, List[Tuple[Dict[str, Any], bool]]], Dict[frozenset, List[Dict[str, Any]]]]:
    single_index: Dict[str, List[Tuple[Dict[str, Any], bool]]] = {}
    fdc_index: Dict[frozenset, List[Dict[str, Any]]] = {}

    for entry in _ENTRIES:
        raw_ings = entry.get("ingredients") or []
        if not raw_ings:
            # Entries with empty `ingredients` never match in lookup_ban (search only).
            continue

        norm_list = [normalize_ingredient(item) for item in raw_ings]
        norm_set = frozenset(n for n in norm_list if n)
        if not norm_set:
            continue

        if len(raw_ings) == 1 and len(norm_set) == 1:
            single_ing = next(iter(norm_set))
            qualified = _is_qualified_single_entry(entry, single_ing)
            single_index.setdefault(single_ing, []).append((entry, qualified))
        elif len(raw_ings) >= 2 and len(norm_set) >= 2:
            fdc_index.setdefault(norm_set, []).append(entry)

    # Sort buckets so active prohibitions take precedence if duplicate sets exist.
    for key, bucket in single_index.items():
        bucket.sort(key=lambda pair: (_status_priority(pair[0].get("status", "")), int(pair[1])))
    for key, bucket in fdc_index.items():
        bucket.sort(key=lambda item: _status_priority(item.get("status", "")))

    return single_index, fdc_index


_SINGLE_INDEX, _FDC_INDEX = _build_index()


def lookup_ban(ingredient_names: List[str]) -> Optional[BanMatch]:
    """
    Matches ONE medicine or ONE combination product against CDSCO banned/halted entries.
    Never matches partial FDC subsets or empty-ingredient descriptive entries.
    """
    if not ingredient_names:
        return None

    normalized = frozenset(n for n in (normalize_ingredient(x) for x in ingredient_names) if n)
    if not normalized:
        return None

    matched_entry: Optional[Dict[str, Any]] = None
    qualified = False

    if len(normalized) == 1:
        single_key = next(iter(normalized))
        candidates = _SINGLE_INDEX.get(single_key)
        if candidates:
            matched_entry, qualified = candidates[0]
    else:
        candidates = _FDC_INDEX.get(normalized)
        if candidates:
            matched_entry = candidates[0]
            qualified = False

    if matched_entry is None:
        return None

    heading, message = plain_status(matched_entry, qualified=qualified)
    return BanMatch(
        entry_name=matched_entry.get("name", ""),
        kind=matched_entry.get("kind", "single"),
        status=matched_entry.get("status", ""),
        notification=matched_entry.get("notification"),
        date=matched_entry.get("date"),
        source=matched_entry.get("source", "CDSCO Data Bank"),
        qualified=qualified,
        heading=heading,
        message=message,
    )


def _format_search_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "name": entry.get("name", ""),
        "kind": entry.get("kind", ""),
        "status": entry.get("status", ""),
        "notification": entry.get("notification"),
        "date": entry.get("date"),
        "ingredients": list(entry.get("ingredients") or []),
    }


def search_banned_with_total(query: str = "", limit: int = 20) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Searches all entries (including empty-ingredient descriptive entries) by
    case-insensitive substring over `name` and `ingredients`. Empty query returns
    the Prohibited entries. Returns `(total_matches, sliced_results)`.
    """
    q = (query or "").strip().lower()
    safe_limit = max(0, limit)

    if not q:
        matches = [e for e in _ENTRIES if e.get("status") == "Prohibited"]
    else:
        matches = [
            e
            for e in _ENTRIES
            if q in (e.get("name") or "").lower()
            or any(q in (ing or "").lower() for ing in (e.get("ingredients") or []))
        ]

    return len(matches), [_format_search_entry(e) for e in matches[:safe_limit]]


def search_banned(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Case-insensitive substring match over entry `name` and `ingredients`.
    Empty query returns the first `limit` Prohibited entries.
    """
    _, results = search_banned_with_total(query=query, limit=limit)
    return results


def ban_stats() -> Dict[str, int]:
    """Returns summary counts across all CDSCO entries in the dataset."""
    prohibited = 0
    unapproved = 0
    under_examination = 0
    quashed_or_revoked = 0

    for entry in _ENTRIES:
        status = (entry.get("status") or "").strip()
        low = status.lower()
        if status == "Prohibited":
            prohibited += 1
        elif status.startswith("Unapproved FDC"):
            unapproved += 1
        elif status.startswith("Under examination"):
            under_examination += 1
        elif "quashed" in low or "revoked" in low:
            quashed_or_revoked += 1

    return {
        "total": len(_ENTRIES),
        "prohibited": prohibited,
        "unapproved": unapproved,
        "under_examination": under_examination,
        "quashed_or_revoked": quashed_or_revoked,
    }


def first_prohibited_single_names(limit: int = 8) -> List[str]:
    """Returns the first `limit` official names of Prohibited single-drug entries."""
    names: List[str] = []
    for entry in _ENTRIES:
        if entry.get("kind") == "single" and entry.get("status") == "Prohibited":
            name = (entry.get("name") or "").strip()
            if name:
                names.append(name)
            if len(names) >= limit:
                break
    return names


def build_ban_overview_answer() -> str:
    """Deterministic plain-English overview built from `ban_stats()`."""
    stats = ban_stats()
    examples = first_prohibited_single_names(8)
    examples_text = ", ".join(examples)
    return (
        f"India's drug regulator (CDSCO) publishes an official list of banned and halted medicines. "
        f"This app checks {stats['total']} entries from India's official data "
        f"({stats['prohibited']} prohibited entries, {stats['unapproved']} unapproved combination medicines halted in April 2025, "
        f"{stats['under_examination']} under government examination, and {stats['quashed_or_revoked']} court-cancelled or revoked entries).\n\n"
        "In India, bans apply by generic ingredient (composition) names, never by brand names. "
        "Different brand names can contain the same banned ingredient or combination.\n\n"
        f"Examples of prohibited single medicines on the list: {examples_text}.\n\n"
        "Type any medicine name or combination (for example, Phenacetin or Amoxicillin + Serratiopeptidase) below to check its status in India."
    )
