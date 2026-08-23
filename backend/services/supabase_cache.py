import os
import json
import sqlite3
import logging
import uuid
import anyio
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
from models import InteractionItem

logger = logging.getLogger("supabase_cache")

# Configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SQLITE_DB_PATH = os.environ.get("SQLITE_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "local_cache.db"))

def get_supabase_client() -> Optional[Client]:
    if SUPABASE_URL and SUPABASE_KEY and SUPABASE_URL.strip() and SUPABASE_KEY.strip():
        try:
            return create_client(SUPABASE_URL, SUPABASE_KEY)
        except Exception as e:
            logger.warning(f"Failed to initialize Supabase client: {e}")
            return None
    return None

def _sync_init_sqlite():
    """Initializes local SQLite tables synchronously."""
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS interaction_pairs (
                id TEXT PRIMARY KEY,
                drug_a TEXT,
                drug_b TEXT,
                canonical_pair TEXT UNIQUE,
                severity TEXT,
                explanation TEXT,
                mechanism TEXT,
                clinical_impact TEXT,
                stomach_impact TEXT,
                food_consideration TEXT,
                action_guidance TEXT,
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

        # Migration: ensure rich clinical columns exist
        cursor.execute("PRAGMA table_info(interaction_pairs)")
        existing_cols = [row[1] for row in cursor.fetchall()]
        for col in ["mechanism", "clinical_impact", "stomach_impact", "food_consideration", "action_guidance"]:
            if col not in existing_cols:
                try:
                    cursor.execute(f"ALTER TABLE interaction_pairs ADD COLUMN {col} TEXT")
                except Exception:
                    pass

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing local SQLite cache: {e}")

_sync_init_sqlite()

def get_canonical_pair(drug_a: str, drug_b: str) -> str:
    a, b = drug_a.lower().strip(), drug_b.lower().strip()
    return f"{a}::{b}" if a < b else f"{b}::{a}"

# Synchronous worker functions to be offloaded to thread pool via anyio

def _sync_get_interaction(canonical: str) -> Optional[tuple]:
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT severity, explanation, mechanism, clinical_impact, stomach_impact, food_consideration, action_guidance 
            FROM interaction_pairs WHERE canonical_pair = ?
        """, (canonical,))
        row = cursor.fetchone()
        conn.close()
        return row
    except Exception as e:
        logger.warning(f"SQLite interaction lookup error: {e}")
        return None

def _sync_save_interaction(
    drug_a: str, 
    drug_b: str, 
    canonical: str, 
    severity: str, 
    explanation: str,
    mechanism: Optional[str] = None,
    clinical_impact: Optional[str] = None,
    stomach_impact: Optional[str] = None,
    food_consideration: Optional[str] = None,
    action_guidance: Optional[str] = None
) -> None:
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO interaction_pairs (
                id, drug_a, drug_b, canonical_pair, severity, explanation,
                mechanism, clinical_impact, stomach_impact, food_consideration, action_guidance
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(canonical_pair) DO UPDATE SET
                severity=excluded.severity,
                explanation=excluded.explanation,
                mechanism=excluded.mechanism,
                clinical_impact=excluded.clinical_impact,
                stomach_impact=excluded.stomach_impact,
                food_consideration=excluded.food_consideration,
                action_guidance=excluded.action_guidance
        """, (
            str(uuid.uuid4()), 
            drug_a.lower().strip(), 
            drug_b.lower().strip(), 
            canonical, 
            severity, 
            explanation,
            mechanism,
            clinical_impact,
            stomach_impact,
            food_consideration,
            action_guidance
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache interaction in SQLite: {e}")

def _sync_get_drug_detail(name: str) -> Optional[tuple]:
    try:
        conn = sqlite3.connect(SQLITE_DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text FROM drug_details WHERE generic_name = ?", (name,))
        row = cursor.fetchone()
        conn.close()
        return row
    except Exception as e:
        logger.warning(f"SQLite drug details lookup error: {e}")
        return None

def _sync_save_drug_detail(name: str, brand_names_json: str, side_effects_json: str, food_warnings_json: str, drug_interactions_json: str, severity: str, raw_text: Optional[str]) -> None:
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
            brand_names_json,
            side_effects_json,
            food_warnings_json,
            drug_interactions_json,
            severity,
            raw_text
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache drug details in SQLite: {e}")

# Async public methods

async def get_cached_interaction(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
    """
    Check cache for existing interaction between drug_a and drug_b.
    Checks Supabase first (non-blocking HTTP); falls back to thread-pool SQLite.
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
                    severity=item.get("severity", "moderate"),
                    explanation=item.get("explanation", ""),
                    mechanism=item.get("mechanism"),
                    clinical_impact=item.get("clinical_impact"),
                    stomach_impact=item.get("stomach_impact"),
                    food_consideration=item.get("food_consideration"),
                    action_guidance=item.get("action_guidance")
                )
        except Exception as e:
            logger.warning(f"Supabase interaction cache lookup error: {e}")

    # Fallback to local SQLite cache in worker thread
    row = await anyio.to_thread.run_sync(_sync_get_interaction, canonical)
    if row:
        return InteractionItem(
            drug_a=drug_a,
            drug_b=drug_b,
            severity=row[0],
            explanation=row[1],
            mechanism=row[2] if len(row) > 2 else None,
            clinical_impact=row[3] if len(row) > 3 else None,
            stomach_impact=row[4] if len(row) > 4 else None,
            food_consideration=row[5] if len(row) > 5 else None,
            action_guidance=row[6] if len(row) > 6 else None
        )

    return None

async def save_interaction_to_cache(
    drug_a: str, 
    drug_b: str, 
    severity: str, 
    explanation: str,
    mechanism: Optional[str] = None,
    clinical_impact: Optional[str] = None,
    stomach_impact: Optional[str] = None,
    food_consideration: Optional[str] = None,
    action_guidance: Optional[str] = None
) -> None:
    """
    Saves an interaction pair to Supabase and local SQLite cache asynchronously.
    """
    canonical = get_canonical_pair(drug_a, drug_b)
    supabase = get_supabase_client()

    if supabase:
        try:
            payload = {
                "drug_a": drug_a.lower().strip(),
                "drug_b": drug_b.lower().strip(),
                "canonical_pair": canonical,
                "severity": severity,
                "explanation": explanation
            }
            if mechanism: payload["mechanism"] = mechanism
            if clinical_impact: payload["clinical_impact"] = clinical_impact
            if stomach_impact: payload["stomach_impact"] = stomach_impact
            if food_consideration: payload["food_consideration"] = food_consideration
            if action_guidance: payload["action_guidance"] = action_guidance

            supabase.table("interaction_pairs").upsert(payload, on_conflict="canonical_pair").execute()
        except Exception as e:
            logger.warning(f"Failed to cache interaction in Supabase: {e}")

    # Offload SQLite write to thread pool
    await anyio.to_thread.run_sync(
        _sync_save_interaction,
        drug_a,
        drug_b,
        canonical,
        severity,
        explanation,
        mechanism,
        clinical_impact,
        stomach_impact,
        food_consideration,
        action_guidance
    )

async def get_cached_drug_details(generic_name: str) -> Optional[Dict[str, Any]]:
    name = generic_name.lower().strip()
    supabase = get_supabase_client()

    if supabase:
        try:
            res = supabase.table("drug_details").select("*").eq("generic_name", name).execute()
            if res.data and len(res.data) > 0:
                item = res.data[0]
                return {
                    "generic_name": item["generic_name"],
                    "brand_names": item["brand_names"] if isinstance(item["brand_names"], list) else json.loads(item.get("brand_names") or "[]"),
                    "side_effects": item["side_effects"] if isinstance(item["side_effects"], list) else json.loads(item.get("side_effects") or "[]"),
                    "food_warnings": item["food_warnings"] if isinstance(item["food_warnings"], list) else json.loads(item.get("food_warnings") or "[]"),
                    "drug_interactions": item["drug_interactions"] if isinstance(item["drug_interactions"], list) else json.loads(item.get("drug_interactions") or "[]"),
                    "severity": item.get("severity", "moderate"),
                    "raw_text_summary": item.get("raw_text")
                }
        except Exception as e:
            logger.warning(f"Supabase drug details lookup error: {e}")

    # Fallback to local SQLite in worker thread
    row = await anyio.to_thread.run_sync(_sync_get_drug_detail, name)
    if row:
        return {
            "generic_name": name,
            "brand_names": json.loads(row[0] or "[]"),
            "side_effects": json.loads(row[1] or "[]"),
            "food_warnings": json.loads(row[2] or "[]"),
            "drug_interactions": json.loads(row[3] or "[]"),
            "severity": row[4] or "moderate",
            "raw_text_summary": row[5]
        }

    return None

async def save_drug_details_to_cache(
    generic_name_or_dict: Any = None,
    brand_names: Optional[List[str]] = None,
    side_effects: Optional[List[str]] = None,
    food_warnings: Optional[List[str]] = None,
    drug_interactions: Optional[List[str]] = None,
    severity: str = "moderate",
    raw_text: Optional[str] = None,
    **kwargs
) -> None:
    if isinstance(generic_name_or_dict, dict):
        d = generic_name_or_dict
        name = (d.get("generic_name") or d.get("name") or "").lower().strip()
        brand_names = d.get("brand_names", [])
        side_effects = d.get("side_effects", [])
        food_warnings = d.get("food_warnings", [])
        drug_interactions = d.get("drug_interactions", [])
        severity = d.get("severity", "moderate")
        raw_text = d.get("raw_text") or d.get("raw_text_summary")
    else:
        name = (generic_name_or_dict or kwargs.get("generic_name") or "").lower().strip()
        brand_names = brand_names or kwargs.get("brand_names") or []
        side_effects = side_effects or kwargs.get("side_effects") or []
        food_warnings = food_warnings or kwargs.get("food_warnings") or []
        drug_interactions = drug_interactions or kwargs.get("drug_interactions") or []
        severity = severity or kwargs.get("severity") or "moderate"
        raw_text = raw_text or kwargs.get("raw_text")

    if not name:
        return

    supabase = get_supabase_client()

    if supabase:
        try:
            supabase.table("drug_details").upsert({
                "generic_name": name,
                "brand_names": brand_names,
                "side_effects": side_effects,
                "food_warnings": food_warnings,
                "drug_interactions": drug_interactions,
                "severity": severity,
                "raw_text": raw_text
            }, on_conflict="generic_name").execute()
        except Exception as e:
            logger.warning(f"Failed to cache drug details in Supabase: {e}")

    # Offload SQLite write to worker thread
    await anyio.to_thread.run_sync(
        _sync_save_drug_detail,
        name,
        json.dumps(brand_names),
        json.dumps(side_effects),
        json.dumps(food_warnings),
        json.dumps(drug_interactions),
        severity,
        raw_text
    )

# Aliases for compatibility
get_cached_drug_detail = get_cached_drug_details
save_drug_detail_to_cache = save_drug_details_to_cache
