import pytest
import sqlite3
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.supabase_cache import (
    _sync_save_interaction,
    _sync_get_interaction,
    _sync_save_drug_detail,
    _sync_get_drug_detail,
    get_canonical_pair
)
from config import settings

def test_cache_ttl_and_expiration():
    """Verify that cached entries past their TTL are ignored on read."""
    drug_a = "test_drug_alpha"
    drug_b = "test_drug_beta"
    canonical = get_canonical_pair(drug_a, drug_b)

    # 1. Save entry with negative TTL (already expired)
    _sync_save_interaction(
        drug_a=drug_a,
        drug_b=drug_b,
        canonical=canonical,
        severity="moderate",
        explanation="Expired test interaction",
        ttl_days=-1  # Expired yesterday
    )

    # Read should return None due to expired TTL filter
    row = _sync_get_interaction(canonical)
    assert row is None

    # 2. Save entry with valid 90-day TTL
    _sync_save_interaction(
        drug_a=drug_a,
        drug_b=drug_b,
        canonical=canonical,
        severity="high",
        explanation="Active test interaction",
        ttl_days=90
    )

    row = _sync_get_interaction(canonical)
    assert row is not None
    assert row[0] == "high"
    assert row[1] == "Active test interaction"
