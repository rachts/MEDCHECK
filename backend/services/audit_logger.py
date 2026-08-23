import os
import json
import sqlite3
import hashlib
import logging
import anyio
from datetime import datetime, timezone
from typing import List, Optional

from config import settings

logger = logging.getLogger("audit_logger")

def _init_audit_table():
    try:
        os.makedirs(os.path.dirname(settings.SQLITE_DB_PATH), exist_ok=True)
        conn = sqlite3.connect(settings.SQLITE_DB_PATH)
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
        conn.close()
    except Exception as e:
        logger.error(f"Error initializing audit_logs table: {e}")

_init_audit_table()

def hash_ip(ip_address: Optional[str]) -> str:
    if not ip_address:
        return "unknown"
    return hashlib.sha256(ip_address.strip().encode("utf-8")).hexdigest()[:16]

def _sync_record_audit_log(
    user_id: Optional[str],
    medicines: List[str],
    interaction_count: int,
    gi_score: int,
    ip_hash: str,
    response_time_ms: float
):
    try:
        conn = sqlite3.connect(settings.SQLITE_DB_PATH)
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
        conn.close()
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
