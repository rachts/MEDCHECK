import os
import sqlite3
import logging
from typing import Optional, Dict, Any, List
from models import InteractionItem, ParsedDrugInfo

logger = logging.getLogger("supabase_cache")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()

_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if SUPABASE_URL and SUPABASE_KEY:
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("Connected to Supabase PostgreSQL.")
            return _supabase_client
        except Exception as e:
            logger.warning(f"Failed to initialize Supabase client: {e}. Falling back to SQLite cache.")
    return None

# Local SQLite fallback cache setup
SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "local_cache.db")

def init_sqlite_cache():
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interaction_pairs (
                id TEXT PRIMARY KEY,
                drug_a TEXT NOT NULL,
                drug_b TEXT NOT NULL,
                canonical_pair TEXT UNIQUE NOT NULL,
                severity TEXT NOT NULL,
                explanation TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS drug_details (
                generic_name TEXT PRIMARY KEY,
                brand_names TEXT,
                side_effects TEXT,
                food_warnings TEXT,
                drug_interactions TEXT,
                severity TEXT,
                raw_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing local SQLite cache: {e}")

init_sqlite_cache()

def get_canonical_pair(drug_a: str, drug_b: str) -> str:
    a, b = drug_a.lower().strip(), drug_b.lower().strip()
    return f"{a}::{b}" if a < b else f"{b}::{a}"

async def get_cached_interaction(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
    """
    Check cache for existing interaction between drug_a and drug_b.
    Checks Supabase first; if unavailable, checks local SQLite cache.
    """
    canonical = get_canonical_pair(drug_a, drug_b)
    supabase = get_supabase_client()

    if supabase:
        try:
            res = supabase.table("interaction_pairs").select("*").eq("canonical_pair", canonical).execute()
            if res.data and len(res.data) > 0:
                item = res.data[0]
                return InteractionItem(
                    drug_a=drug_a,
                    drug_b=drug_b,
                    severity=item["severity"],
                    explanation=item["explanation"]
                )
        except Exception as e:
            logger.warning(f"Supabase interaction cache lookup error: {e}")

    # Fallback to local SQLite cache
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT severity, explanation FROM interaction_pairs WHERE canonical_pair = ?", (canonical,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return InteractionItem(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=row[0],
                explanation=row[1]
            )
    except Exception as e:
        logger.warning(f"SQLite interaction lookup error: {e}")

    return None

async def save_interaction_to_cache(drug_a: str, drug_b: str, severity: str, explanation: str) -> None:
    """
    Saves an interaction pair to Supabase and local cache.
    """
    canonical = get_canonical_pair(drug_a, drug_b)
    supabase = get_supabase_client()

    if supabase:
        try:
            supabase.table("interaction_pairs").upsert({
                "drug_a": drug_a.lower().strip(),
                "drug_b": drug_b.lower().strip(),
                "canonical_pair": canonical,
                "severity": severity,
                "explanation": explanation
            }, on_conflict="canonical_pair").execute()
        except Exception as e:
            logger.warning(f"Failed to cache interaction in Supabase: {e}")

    # Always write to local SQLite cache
    try:
        import uuid
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO interaction_pairs (id, drug_a, drug_b, canonical_pair, severity, explanation)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(canonical_pair) DO UPDATE SET
                severity=excluded.severity,
                explanation=excluded.explanation
        """, (str(uuid.uuid4()), drug_a.lower().strip(), drug_b.lower().strip(), canonical, severity, explanation))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache interaction in SQLite: {e}")

async def get_cached_drug_detail(generic_name: str) -> Optional[ParsedDrugInfo]:
    """
    Retrieve cached drug details if available.
    """
    name = generic_name.lower().strip()
    supabase = get_supabase_client()

    if supabase:
        try:
            res = supabase.table("medicines").select("*, drug_details(*)").eq("name", name).execute()
            if res.data and len(res.data) > 0:
                med = res.data[0]
                details = med.get("drug_details", [{}])[0] if med.get("drug_details") else {}
                return ParsedDrugInfo(
                    generic_name=med.get("generic_name", name),
                    brand_names=med.get("brand_names", []),
                    side_effects=details.get("side_effects", []),
                    food_warnings=details.get("food_warnings", []),
                    drug_interactions=details.get("drug_interactions", []),
                    severity="low"
                )
        except Exception as e:
            logger.warning(f"Supabase drug details lookup error: {e}")

    try:
        import json
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text FROM drug_details WHERE generic_name = ?", (name,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return ParsedDrugInfo(
                generic_name=name,
                brand_names=json.loads(row[0] or "[]"),
                side_effects=json.loads(row[1] or "[]"),
                food_warnings=json.loads(row[2] or "[]"),
                drug_interactions=json.loads(row[3] or "[]"),
                severity=row[4] or "low",
                raw_text=row[5]
            )
    except Exception as e:
        logger.warning(f"SQLite drug details lookup error: {e}")

    return None

async def save_drug_detail_to_cache(info: ParsedDrugInfo) -> None:
    """
    Cache parsed drug details.
    """
    import json
    name = info.generic_name.lower().strip()
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO drug_details (generic_name, brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(generic_name) DO UPDATE SET
                brand_names=excluded.brand_names,
                side_effects=excluded.side_effects,
                food_warnings=excluded.food_warnings,
                drug_interactions=excluded.drug_interactions,
                severity=excluded.severity,
                raw_text=excluded.raw_text
        """, (
            name,
            json.dumps(info.brand_names),
            json.dumps(info.side_effects),
            json.dumps(info.food_warnings),
            json.dumps(info.drug_interactions),
            info.severity,
            info.raw_text
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache drug details in SQLite: {e}")
