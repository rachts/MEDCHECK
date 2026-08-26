import os
import json
import sqlite3
import hashlib
import hmac
import logging
import anyio
from contextlib import closing
from datetime import datetime, timezone
from typing import List, Optional

from config import settings

logger = logging.getLogger("audit_logger")

# Every connection below is wrapped in `contextlib.closing`.
#
# The previous shape was `conn = connect(); ...; conn.close()` with the close as
# the last statement *inside* a try whose except only logged. Any failure before
# it -- a locked database, a failed commit, a disk-full write -- skipped the
# close and leaked the handle. Because these functions run on every clinical
# check, a database that is briefly locked leaks one file descriptor per
# request until the process hits its ulimit and stops serving.
#
# Note that `with sqlite3.connect(...)` would NOT fix this: sqlite3's own
# context manager is a *transaction* manager (it commits or rolls back) and
# deliberately leaves the connection open. `closing()` is what actually closes.


def _init_audit_table():
    try:
        os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
        with closing(sqlite3.connect(settings.SQLITE_DB_PATH)) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT,
                    medicines_json TEXT,
                    interaction_count INTEGER,
                    gi_score INTEGER,
                    ip_hash TEXT,
                    response_time_ms REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
    except Exception as e:
        logger.error(f"Error initializing audit_logs table: {e}")

_init_audit_table()

def hash_ip(ip_address: Optional[str]) -> str:
    """
    Produces a stable pseudonymous identifier for a client IP.

    Two properties matter here and the previous implementation had neither:

    1. Full digest. The old code truncated SHA-256 to 16 hex characters (64 bits),
       which makes distinct addresses collide often enough to corrupt per-client
       rate/abuse analysis over a long-lived audit table.
    2. Keyed. An unkeyed hash of an IP address is not pseudonymisation: the entire
       IPv4 space is only 2**32 entries, so anybody who obtains the audit table can
       recover every address by exhaustive search in seconds. HMAC with a secret
       key makes the mapping irreversible without that key.
    """
    if not ip_address:
        return "unknown"
    return hmac.new(
        settings.AUDIT_IP_SALT.encode("utf-8"),
        ip_address.strip().encode("utf-8"),
        hashlib.sha256
    ).hexdigest()


def _sync_record_audit_log(
    user_id: Optional[str],
    medicines: List[str],
    interaction_count: int,
    gi_score: int,
    ip_hash: str,
    response_time_ms: float
):
    try:
        with closing(sqlite3.connect(settings.SQLITE_DB_PATH)) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO audit_logs (user_id, medicines_json, interaction_count, gi_score, ip_hash, response_time_ms)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                user_id or "anonymous",
                json.dumps(sorted([m.lower().strip() for m in medicines])),
                interaction_count,
                gi_score,
                ip_hash,
                response_time_ms
            ))
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to record audit log: {e}")

async def log_clinical_check(
    user_id: Optional[str],
    medicines: List[str],
    interaction_count: int,
    gi_score: int,
    ip_address: Optional[str],
    response_time_ms: float
):
    ip_h = hash_ip(ip_address)
    await anyio.to_thread.run_sync(
        _sync_record_audit_log,
        user_id,
        medicines,
        interaction_count,
        gi_score,
        ip_h,
        response_time_ms
    )
