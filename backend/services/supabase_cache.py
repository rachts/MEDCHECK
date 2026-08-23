import os
import json
import sqlite3
import logging
import uuid
import anyio
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List, Tuple
from supabase import create_client, Client
from models import InteractionItem, Severity, RuleConfidence
from config import settings

logger = logging.getLogger("supabase_cache")

# Lazy Supabase Client Singleton
_supabase_client: Optional[Client] = None

def get_supabase_client() -> Optional[Client]:
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if settings.SUPABASE_URL and settings.SUPABASE_KEY and settings.SUPABASE_URL.strip() and settings.SUPABASE_KEY.strip():
        try:
            _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
            return _supabase_client
        except Exception as e:
            logger.warning(f"Failed to initialize Supabase client: {e}")
            return None
    return None

def _get_sqlite_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.SQLITE_DB_PATH, timeout=20.0)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    return conn

def _sync_init_sqlite():
    """Initializes local SQLite tables synchronously with WAL mode and TTL."""
    try:
        os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
        conn = _get_sqlite_conn()
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
                evidence_source TEXT,
                confidence TEXT,
                last_reviewed TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP
            )
        """)

        # Static migration checks
        cursor.execute("PRAGMA table_info(interaction_pairs)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        
        static_migrations = [
            ("mechanism", "ALTER TABLE interaction_pairs ADD COLUMN mechanism TEXT"),
            ("clinical_impact", "ALTER TABLE interaction_pairs ADD COLUMN clinical_impact TEXT"),
            ("stomach_impact", "ALTER TABLE interaction_pairs ADD COLUMN stomach_impact TEXT"),
            ("food_consideration", "ALTER TABLE interaction_pairs ADD COLUMN food_consideration TEXT"),
            ("action_guidance", "ALTER TABLE interaction_pairs ADD COLUMN action_guidance TEXT"),
            ("evidence_source", "ALTER TABLE interaction_pairs ADD COLUMN evidence_source TEXT"),
            ("confidence", "ALTER TABLE interaction_pairs ADD COLUMN confidence TEXT"),
            ("last_reviewed", "ALTER TABLE interaction_pairs ADD COLUMN last_reviewed TEXT"),
            ("expires_at", "ALTER TABLE interaction_pairs ADD COLUMN expires_at TIMESTAMP")
        ]
        
        for col_name, ddl_stmt in static_migrations:
            if col_name not in existing_cols:
                try:
                    cursor.execute(ddl_stmt)
                except Exception:
                    pass

        cursor.execute("PRAGMA table_info(drug_details)")
        existing_drug_cols = {row[1] for row in cursor.fetchall()}
        if "expires_at" not in existing_drug_cols:
            try:
                cursor.execute("ALTER TABLE drug_details ADD COLUMN expires_at TIMESTAMP")
            except Exception:
                pass

        # Clean expired rows on startup
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("DELETE FROM interaction_pairs WHERE expires_at IS NOT NULL AND expires_at < ?", (now_iso,))
        cursor.execute("DELETE FROM drug_details WHERE expires_at IS NOT NULL AND expires_at < ?", (now_iso,))

        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing local SQLite cache: {e}")

_sync_init_sqlite()

def get_canonical_pair(drug_a: str, drug_b: str) -> str:
    a, b = drug_a.lower().strip(), drug_b.lower().strip()
    return f"{a}::{b}" if a < b else f"{b}::{a}"

def _sync_get_interaction(canonical: str) -> Optional[tuple]:
    try:
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            SELECT severity, explanation, mechanism, clinical_impact, stomach_impact, 
                   food_consideration, action_guidance, evidence_source, confidence, last_reviewed, expires_at
            FROM interaction_pairs 
            WHERE canonical_pair = ? AND (expires_at IS NULL OR expires_at > ?)
        """, (canonical, now_iso))
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
    action_guidance: Optional[str] = None,
    evidence_source: Optional[str] = None,
    confidence: Optional[str] = "established",
    last_reviewed: Optional[str] = "2026-08-23",
    ttl_days: int = 90
) -> None:
    try:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            INSERT INTO interaction_pairs (
                id, drug_a, drug_b, canonical_pair, severity, explanation,
                mechanism, clinical_impact, stomach_impact, food_consideration, action_guidance,
                evidence_source, confidence, last_reviewed, expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(canonical_pair) DO UPDATE SET
                severity=excluded.severity,
                explanation=excluded.explanation,
                mechanism=excluded.mechanism,
                clinical_impact=excluded.clinical_impact,
                stomach_impact=excluded.stomach_impact,
                food_consideration=excluded.food_consideration,
                action_guidance=excluded.action_guidance,
                evidence_source=excluded.evidence_source,
                confidence=excluded.confidence,
                last_reviewed=excluded.last_reviewed,
                expires_at=excluded.expires_at
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
            action_guidance,
            evidence_source,
            confidence,
            last_reviewed,
            expires_at
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache interaction in SQLite: {e}")

def _sync_get_drug_detail(name: str) -> Optional[tuple]:
    try:
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        now_iso = datetime.now(timezone.utc).isoformat()
        cursor.execute("""
            SELECT brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text 
            FROM drug_details 
            WHERE generic_name = ? AND (expires_at IS NULL OR expires_at > ?)
        """, (name, now_iso))
        row = cursor.fetchone()
        conn.close()
        return row
    except Exception as e:
        logger.warning(f"SQLite drug details lookup error: {e}")
        return None

def _sync_save_drug_detail(
    name: str, 
    brand_names_json: str, 
    side_effects_json: str, 
    food_warnings_json: str, 
    drug_interactions_json: str, 
    severity: str, 
    raw_text: Optional[str],
    ttl_days: int = 30
) -> None:
    try:
        expires_at = (datetime.now(timezone.utc) + timedelta(days=ttl_days)).isoformat()
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            INSERT INTO drug_details (generic_name, brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(generic_name) DO UPDATE SET
                brand_names=excluded.brand_names,
                side_effects=excluded.side_effects,
                food_warnings=excluded.food_warnings,
                drug_interactions=excluded.drug_interactions,
                severity=excluded.severity,
                raw_text=excluded.raw_text,
                expires_at=excluded.expires_at
        """, (
            name,
            brand_names_json,
            side_effects_json,
            food_warnings_json,
            drug_interactions_json,
            severity,
            raw_text,
            expires_at
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache drug details in SQLite: {e}")

# Async public methods

async def get_cached_interaction(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
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
                    severity=Severity(item.get("severity", "moderate")),
                    explanation=item.get("explanation", ""),
                    mechanism=item.get("mechanism"),
                    clinical_impact=item.get("clinical_impact"),
                    stomach_impact=item.get("stomach_impact"),
                    food_consideration=item.get("food_consideration"),
                    action_guidance=item.get("action_guidance"),
                    evidence_source=item.get("evidence_source"),
                    confidence=RuleConfidence(item.get("confidence", "established")),
                    last_reviewed=item.get("last_reviewed", "2026-08-23")
                )
        except Exception as e:
            logger.warning(f"Supabase interaction cache lookup error: {e}")

    # Fallback to local SQLite in worker thread
    row = await anyio.to_thread.run_sync(_sync_get_interaction, canonical)
    if row:
        return InteractionItem(
            drug_a=drug_a,
            drug_b=drug_b,
            severity=Severity(row[0]) if row[0] in [s.value for s in Severity] else Severity.MODERATE,
            explanation=row[1],
            mechanism=row[2] if len(row) > 2 else None,
            clinical_impact=row[3] if len(row) > 3 else None,
            stomach_impact=row[4] if len(row) > 4 else None,
            food_consideration=row[5] if len(row) > 5 else None,
            action_guidance=row[6] if len(row) > 6 else None,
            evidence_source=row[7] if len(row) > 7 else None,
            confidence=RuleConfidence(row[8]) if len(row) > 8 and row[8] in [c.value for c in RuleConfidence] else RuleConfidence.ESTABLISHED,
            last_reviewed=row[9] if len(row) > 9 and row[9] else "2026-08-23"
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
    action_guidance: Optional[str] = None,
    evidence_source: Optional[str] = None,
    confidence: Optional[str] = "established",
    last_reviewed: Optional[str] = "2026-08-23"
) -> None:
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
            if evidence_source: payload["evidence_source"] = evidence_source
            if confidence: payload["confidence"] = confidence
            if last_reviewed: payload["last_reviewed"] = last_reviewed

            supabase.table("interaction_pairs").upsert(payload, on_conflict="canonical_pair").execute()
        except Exception as e:
            logger.warning(f"Failed to cache interaction in Supabase: {e}")

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
        action_guidance,
        evidence_source,
        confidence,
        last_reviewed
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

get_cached_drug_detail = get_cached_drug_details
save_drug_detail_to_cache = save_drug_details_to_cache
