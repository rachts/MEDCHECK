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

# Cache lifetimes, kept as module constants so the Supabase and SQLite layers
# cannot drift apart. Interaction verdicts are stable clinical facts; label
# extracts change more often, so they carry the shorter TTL.
INTERACTION_TTL_DAYS = 90
DRUG_DETAIL_TTL_DAYS = 30


def _now_epoch() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def _expiry_fields(ttl_days: int) -> Tuple[str, int]:
    """
    Returns (iso_string, epoch_seconds) for a TTL measured from now.

    Both representations are stored: the epoch integer is what expiry queries
    compare against, and the ISO string is retained so the rows stay legible to
    an operator inspecting the cache by hand.
    """
    moment = datetime.now(timezone.utc) + timedelta(days=ttl_days)
    return moment.isoformat(), int(moment.timestamp())


def _parse_timestamp(value: Any) -> Optional[datetime]:
    """
    Parses a timestamp that may arrive as a datetime or as an ISO-8601 string,
    with or without a timezone offset and with either '+00:00' or 'Z'.

    Returns a timezone-aware UTC datetime, or None when unparseable. Naive
    values are assumed to be UTC, which is what every writer here produces.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith(("Z", "z")):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _is_supabase_row_expired(item: Dict[str, Any], ttl_days: int) -> bool:
    """
    Decides whether a Supabase cache row is still usable.

    The remote schema is not owned by this process, so expiry is evaluated in
    Python rather than as a server-side filter: a `.lt("expires_at", ...)` on a
    deployment whose table predates that column would raise and disable the
    remote cache entirely. An explicit expires_at is preferred; otherwise the
    age is derived from created_at + ttl_days, which enforces the TTL even on
    an older schema. When neither timestamp is present the row is served, since
    refusing every row would silently turn the remote cache off.
    """
    now = datetime.now(timezone.utc)

    expires_at = _parse_timestamp(item.get("expires_at"))
    if expires_at is not None:
        return expires_at <= now

    created_at = _parse_timestamp(item.get("created_at"))
    if created_at is not None:
        return created_at + timedelta(days=ttl_days) <= now

    logger.debug(
        "Supabase cache row carries neither expires_at nor created_at; "
        "TTL cannot be enforced for this row."
    )
    return False


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
                expires_at TIMESTAMP,
                expires_at_epoch INTEGER
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
                expires_at TIMESTAMP,
                expires_at_epoch INTEGER
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
            ("expires_at", "ALTER TABLE interaction_pairs ADD COLUMN expires_at TIMESTAMP"),
            ("expires_at_epoch", "ALTER TABLE interaction_pairs ADD COLUMN expires_at_epoch INTEGER")
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
        if "expires_at_epoch" not in existing_drug_cols:
            try:
                cursor.execute("ALTER TABLE drug_details ADD COLUMN expires_at_epoch INTEGER")
            except Exception:
                pass

        # Backfill the epoch column for rows written before it existed. strftime
        # returns NULL for anything it cannot parse, and a NULL epoch reads as
        # expired (see _sync_get_* below), so an unparseable legacy row is
        # discarded and re-fetched rather than served forever.
        for table in ("interaction_pairs", "drug_details"):
            try:
                cursor.execute(
                    f"UPDATE {table} SET expires_at_epoch = CAST(strftime('%s', expires_at) AS INTEGER) "
                    f"WHERE expires_at_epoch IS NULL AND expires_at IS NOT NULL"
                )
            except Exception as e:
                logger.warning(f"Could not backfill expires_at_epoch on {table}: {e}")

        # Clean unusable rows on startup. Comparing integers avoids relying on the
        # lexicographic ordering of ISO strings, which only happens to be correct
        # while every writer emits an identically formatted UTC timestamp.
        # A NULL epoch is purged too: it means either a pre-TTL legacy row or an
        # expires_at that strftime could not parse, and both read as expired
        # below, so leaving them would only accumulate dead rows.
        now_epoch = _now_epoch()
        cursor.execute("DELETE FROM interaction_pairs WHERE expires_at_epoch IS NULL OR expires_at_epoch <= ?", (now_epoch,))
        cursor.execute("DELETE FROM drug_details WHERE expires_at_epoch IS NULL OR expires_at_epoch <= ?", (now_epoch,))

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
        # Integer comparison. The previous predicate compared ISO-8601 strings,
        # which is only correct while every row was written with the identical
        # UTC offset and fractional-second format; a row written with a local
        # offset (or by an external tool) would sort wrongly and be served long
        # after expiry. A NULL epoch fails `> ?` and is therefore treated as
        # expired, which is the safe direction for a clinical cache.
        cursor.execute("""
            SELECT severity, explanation, mechanism, clinical_impact, stomach_impact,
                   food_consideration, action_guidance, evidence_source, confidence, last_reviewed, expires_at
            FROM interaction_pairs
            WHERE canonical_pair = ? AND expires_at_epoch > ?
        """, (canonical, _now_epoch()))
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
    ttl_days: int = INTERACTION_TTL_DAYS
) -> None:
    try:
        expires_at, expires_at_epoch = _expiry_fields(ttl_days)
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            INSERT INTO interaction_pairs (
                id, drug_a, drug_b, canonical_pair, severity, explanation,
                mechanism, clinical_impact, stomach_impact, food_consideration, action_guidance,
                evidence_source, confidence, last_reviewed, expires_at, expires_at_epoch
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                expires_at=excluded.expires_at,
                expires_at_epoch=excluded.expires_at_epoch
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
            expires_at,
            expires_at_epoch
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache interaction in SQLite: {e}")

def _sync_get_drug_detail(name: str) -> Optional[tuple]:
    try:
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text
            FROM drug_details
            WHERE generic_name = ? AND expires_at_epoch > ?
        """, (name, _now_epoch()))
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
    ttl_days: int = DRUG_DETAIL_TTL_DAYS
) -> None:
    try:
        expires_at, expires_at_epoch = _expiry_fields(ttl_days)
        conn = _get_sqlite_conn()
        cursor = conn.cursor()
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            INSERT INTO drug_details (generic_name, brand_names, side_effects, food_warnings, drug_interactions, severity, raw_text, expires_at, expires_at_epoch)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(generic_name) DO UPDATE SET
                brand_names=excluded.brand_names,
                side_effects=excluded.side_effects,
                food_warnings=excluded.food_warnings,
                drug_interactions=excluded.drug_interactions,
                severity=excluded.severity,
                raw_text=excluded.raw_text,
                expires_at=excluded.expires_at,
                expires_at_epoch=excluded.expires_at_epoch
        """, (
            name,
            brand_names_json,
            side_effects_json,
            food_warnings_json,
            drug_interactions_json,
            severity,
            raw_text,
            expires_at,
            expires_at_epoch
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"Failed to cache drug details in SQLite: {e}")

# Async public methods

# Remembers a table whose remote schema has no expires_at column, so the
# unsupported field is dropped up front rather than costing a failed round-trip
# on every subsequent write.
_SUPABASE_TTL_UNSUPPORTED: set = set()


def _supabase_upsert_with_ttl(
    supabase: Client,
    table: str,
    payload: Dict[str, Any],
    on_conflict: str,
    ttl_days: int
) -> None:
    """
    Upserts a cache row, stamping expires_at so the remote copy can expire.

    Without this stamp the Supabase rows had no expiry field at all, which is why
    the remote cache never expired: entries written once were served indefinitely.

    The remote schema is not managed from this process, so a table that predates
    the column would reject the write and silently disable remote caching
    altogether. The write is therefore retried once without the field, and the
    table is remembered only when the error actually names the column -- a
    network or auth failure must not be misread as a schema gap.
    """
    include_ttl = table not in _SUPABASE_TTL_UNSUPPORTED
    body = payload
    if include_ttl:
        expires_at, _ = _expiry_fields(ttl_days)
        body = {**payload, "expires_at": expires_at}

    try:
        supabase.table(table).upsert(body, on_conflict=on_conflict).execute()
        return
    except Exception as e:
        if not include_ttl:
            raise
        message = str(e)
        if "expires_at" in message:
            _SUPABASE_TTL_UNSUPPORTED.add(table)
            logger.warning(
                f"Supabase table '{table}' has no 'expires_at' column, so remote cache "
                f"entries cannot carry an expiry. Add 'expires_at timestamptz' to the "
                f"table; until then, TTL is enforced from 'created_at' on read."
            )
        else:
            logger.warning(f"Supabase upsert into '{table}' failed ({message}); retrying without expires_at.")
        supabase.table(table).upsert(payload, on_conflict=on_conflict).execute()


async def get_cached_interaction(drug_a: str, drug_b: str) -> Optional[InteractionItem]:
    canonical = get_canonical_pair(drug_a, drug_b)
    supabase = get_supabase_client()

    if supabase:
        try:
            res = supabase.table("interaction_pairs").select("*").eq("canonical_pair", canonical).execute()
            if res.data and len(res.data) > 0:
                item = res.data[0]
                if _is_supabase_row_expired(item, INTERACTION_TTL_DAYS):
                    # Stale remote row: fall through to SQLite, and ultimately to a
                    # live lookup, so the caller never receives expired clinical
                    # data. The next successful save upserts over this row.
                    logger.info(
                        f"Supabase interaction cache entry for '{canonical}' has expired; ignoring it."
                    )
                else:
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
                "explanation": explanation,
                "mechanism": mechanism or None,
                "clinical_impact": clinical_impact or None,
                "stomach_impact": stomach_impact or None,
                "food_consideration": food_consideration or None,
                "action_guidance": action_guidance or None,
                "evidence_source": evidence_source or None,
                "confidence": confidence or "established",
                "last_reviewed": last_reviewed or "2026-08-23"
            }
            _supabase_upsert_with_ttl(
                supabase,
                "interaction_pairs",
                payload,
                on_conflict="canonical_pair",
                ttl_days=INTERACTION_TTL_DAYS
            )
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
                if _is_supabase_row_expired(item, DRUG_DETAIL_TTL_DAYS):
                    logger.info(
                        f"Supabase drug-details cache entry for '{name}' has expired; ignoring it."
                    )
                else:
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
            _supabase_upsert_with_ttl(
                supabase,
                "drug_details",
                {
                    "generic_name": name,
                    "brand_names": brand_names,
                    "side_effects": side_effects,
                    "food_warnings": food_warnings,
                    "drug_interactions": drug_interactions,
                    "severity": severity,
                    "raw_text": raw_text
                },
                on_conflict="generic_name",
                ttl_days=DRUG_DETAIL_TTL_DAYS
            )
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
