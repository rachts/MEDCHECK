import json
import logging
import os
import re
import sqlite3
from contextlib import closing
from typing import Any, Dict, List, Optional

from models import CatalogueProduct

logger = logging.getLogger("india_catalogue")

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATA_PATH = os.path.join(_BACKEND_DIR, "data", "india_medicines.sqlite")

CHAT_FORM_WORDS = frozenset({
    "tablet",
    "tablets",
    "capsule",
    "capsules",
    "syrup",
    "injection",
    "cream",
    "gel",
    "drops",
    "suspension",
    "ointment",
    "lotion",
    "powder",
    "spray",
    "solution",
    "sachet",
    "granules",
    "mouthwash",
    "soap",
    "shampoo",
    "oil",
    "balm",
    "paste",
    "strip",
    "strips",
    "kit",
    "pen",
    "rotacaps",
    "respules",
    "inhaler",
    "suppository",
    "pessary",
    "enema",
    "vial",
    "ampoule",
})

_PRODUCT_SELECT_SQL = (
    "SELECT id, name, search_key, substitutes, side_effects, "
    "no_common_side_effects, uses, chemical_class, habit_forming, "
    "therapeutic_class, action_class FROM products"
)


def catalogue_search_key(name: str) -> str:
    """Normalizes a medicine name or search query to match the SQLite `search_key` column."""
    return re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()


def _resolve_db_path(db_path: Optional[str] = None) -> str:
    return db_path if db_path is not None else _DATA_PATH


def _clean_optional_text(value: Any) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip()
    if not cleaned or cleaned.upper() == "NA":
        return None
    return cleaned


def _parse_json_list(raw: Any) -> List[str]:
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            items = parsed if isinstance(parsed, list) else []
        except (ValueError, TypeError):
            items = []
    else:
        items = []

    cleaned: List[str] = []
    for item in items:
        text = str(item).strip()
        if text and text.upper() != "NA":
            cleaned.append(text)
    return cleaned


def _row_to_product(row: sqlite3.Row) -> CatalogueProduct:
    return CatalogueProduct(
        name=row["name"],
        substitutes=_parse_json_list(row["substitutes"]),
        side_effects=_parse_json_list(row["side_effects"]),
        no_common_side_effects=bool(row["no_common_side_effects"]),
        uses=_parse_json_list(row["uses"]),
        chemical_class=_clean_optional_text(row["chemical_class"]),
        habit_forming=bool(row["habit_forming"]),
        therapeutic_class=_clean_optional_text(row["therapeutic_class"]),
        action_class=_clean_optional_text(row["action_class"]),
    )


def _open_connection(path: str) -> Optional[sqlite3.Connection]:
    if not path or not os.path.isfile(path):
        logger.warning("Indian medicines catalogue database missing at '%s'.", path)
        return None
    conn = sqlite3.connect(path, timeout=2.0)
    conn.row_factory = sqlite3.Row
    return conn


def search_catalogue(
    query: str,
    limit: int = 10,
    db_path: Optional[str] = None,
) -> List[CatalogueProduct]:
    """
    Searches the Indian medicines SQLite catalogue in ranked order:
      (a) exact search_key match,
      (b) prefix matches (search_key == key or starts with key + ' '), shortest name first,
      (c) substring matches (key occurs anywhere in search_key), shortest name first.
    Never raises; returns [] if the query is empty or the database is unavailable.
    """
    key = catalogue_search_key(query)
    if not key or limit <= 0:
        return []

    path = _resolve_db_path(db_path)
    try:
        conn = _open_connection(path)
        if conn is None:
            return []

        results: List[CatalogueProduct] = []
        seen_ids = set()

        with closing(conn):
            # (a) Exact search_key match
            exact_rows = conn.execute(
                f"{_PRODUCT_SELECT_SQL} WHERE search_key = ? LIMIT ?",
                (key, limit),
            ).fetchall()
            for row in exact_rows:
                if row["id"] not in seen_ids:
                    seen_ids.add(row["id"])
                    results.append(_row_to_product(row))

            if len(results) >= limit:
                return results[:limit]

            # (b) Prefix matches starting with `key + ' '` (range scan on idx_products_search_key)
            remaining = limit - len(results)
            prefix_rows = conn.execute(
                f"{_PRODUCT_SELECT_SQL} "
                "WHERE search_key >= ? AND search_key < ? "
                "ORDER BY length(name) ASC, search_key ASC LIMIT ?",
                (f"{key} ", f"{key}!", remaining + len(seen_ids)),
            ).fetchall()
            for row in prefix_rows:
                if row["id"] not in seen_ids:
                    seen_ids.add(row["id"])
                    results.append(_row_to_product(row))
                    if len(results) >= limit:
                        return results

            # (c) Substring matches anywhere in search_key, shortest name first
            remaining = limit - len(results)
            substr_rows = conn.execute(
                f"{_PRODUCT_SELECT_SQL} "
                "WHERE instr(search_key, ?) > 0 "
                "ORDER BY length(name) ASC, search_key ASC LIMIT ?",
                (key, remaining + len(seen_ids)),
            ).fetchall()
            for row in substr_rows:
                if row["id"] not in seen_ids:
                    seen_ids.add(row["id"])
                    results.append(_row_to_product(row))
                    if len(results) >= limit:
                        return results

        return results
    except sqlite3.Error as exc:
        logger.warning("Failed to query Indian medicines catalogue at '%s': %s", path, exc)
        return []


def match_product_for_chat(
    typed: str,
    db_path: Optional[str] = None,
) -> Optional[CatalogueProduct]:
    """
    Matches a typed medicine query conservatively for chat fallback:
    returns a product on exact `search_key` match, or when exactly one
    candidate starts with `key + ' '` followed by a single known form word.
    Never raises; returns None if ambiguous, missing, or DB is unavailable.
    """
    key = catalogue_search_key(typed)
    if not key:
        return None

    path = _resolve_db_path(db_path)
    try:
        conn = _open_connection(path)
        if conn is None:
            return None

        with closing(conn):
            exact_row = conn.execute(
                f"{_PRODUCT_SELECT_SQL} WHERE search_key = ? LIMIT 1",
                (key,),
            ).fetchone()
            if exact_row is not None:
                return _row_to_product(exact_row)

            prefix_rows = conn.execute(
                f"{_PRODUCT_SELECT_SQL} WHERE search_key >= ? AND search_key < ?",
                (f"{key} ", f"{key}!"),
            ).fetchall()

            prefix_len = len(key) + 1
            form_matches = [
                row
                for row in prefix_rows
                if row["search_key"][prefix_len:] in CHAT_FORM_WORDS
            ]
            if len(form_matches) == 1:
                return _row_to_product(form_matches[0])

        return None
    except sqlite3.Error as exc:
        logger.warning("Failed to match chat product in Indian medicines catalogue at '%s': %s", path, exc)
        return None


def catalogue_stats(db_path: Optional[str] = None) -> Dict[str, Any]:
    """Returns product count and metadata dictionary from the SQLite catalogue."""
    path = _resolve_db_path(db_path)
    try:
        conn = _open_connection(path)
        if conn is None:
            return {"product_count": 0, "meta": {}}

        with closing(conn):
            count_row = conn.execute("SELECT COUNT(*) FROM products").fetchone()
            product_count = int(count_row[0]) if count_row else 0
            meta_rows = conn.execute("SELECT key, value FROM meta").fetchall()
            meta = {row["key"]: row["value"] for row in meta_rows}
            return {"product_count": product_count, "meta": meta}
    except sqlite3.Error as exc:
        logger.warning("Failed to read stats from Indian medicines catalogue at '%s': %s", path, exc)
        return {"product_count": 0, "meta": {}}
