import hashlib
import logging
import os
import secrets
import sys
import uuid
from contextlib import closing
from datetime import datetime, timedelta, timezone

import pytest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from config import settings
from main import app, limiter
from services.auth import (
    _get_sqlite_auth_conn,
    create_password_reset,
    create_user,
)

client = TestClient(app)

EXPECTED_FORGOT_MESSAGE = (
    "If an account with that username exists, a password reset link has been "
    f"created. The link is valid for {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes."
)
EXPECTED_INVALID_DETAIL = "This reset link is invalid or has expired. Please request a new one."
EXPECTED_SUCCESS_BODY = {
    "status": "password_updated",
    "message": "Your password has been updated. Please sign in with your new password.",
}


@pytest.fixture(autouse=True)
def reset_auth_rate_limits():
    """Keep password reset tests isolated from rate-limit counters across test cases."""
    if hasattr(limiter, "reset"):
        limiter.reset()
    elif hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()
    yield


def _fetch_reset_rows_for_user(user_id: str):
    with closing(_get_sqlite_auth_conn()) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, token_hash, expires_at, used_at FROM password_resets WHERE user_id = ?",
            (user_id,),
        )
        return cursor.fetchall()


def _count_all_reset_rows() -> int:
    with closing(_get_sqlite_auth_conn()) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM password_resets")
        return int(cursor.fetchone()[0])


@pytest.mark.asyncio
async def test_forgot_password_existing_user_stores_only_hashed_token(caplog):
    """Existing non-guest user gets generic 200 response and a hashed reset row."""
    uname = f"dr_reset_{uuid.uuid4().hex[:8]}"
    user = await create_user(uname, "InitialPass123!")

    with caplog.at_level(logging.INFO, logger="medcheck_api"):
        resp = client.post("/api/auth/forgot-password", json={"username": uname})

    assert resp.status_code == 200
    assert resp.json() == {"message": EXPECTED_FORGOT_MESSAGE}

    rows = _fetch_reset_rows_for_user(user["id"])
    assert len(rows) == 1
    assert rows[0][4] is None  # used_at

    # Verify the delivery log contains the expected format once.
    delivery_logs = [
        rec.getMessage()
        for rec in caplog.records
        if f"Password reset link for user '{uname}'" in rec.getMessage()
    ]
    assert len(delivery_logs) == 1
    assert f"{settings.PASSWORD_RESET_LINK_BASE}?reset_token=" in delivery_logs[0]

    # Call service directly so we can verify the stored value is a SHA-256 hash,
    # never the raw token itself.
    raw_token = await create_password_reset(uname)
    assert raw_token is not None
    expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    updated_rows = _fetch_reset_rows_for_user(user["id"])
    assert len(updated_rows) == 1
    assert updated_rows[0][2] != raw_token
    assert updated_rows[0][2] == expected_hash


def test_forgot_password_unknown_username_returns_identical_response_without_row(caplog):
    """Unknown usernames return the exact same 200 payload and create no DB row."""
    before_count = _count_all_reset_rows()
    unknown_name = f"no_such_user_{uuid.uuid4().hex[:8]}"

    with caplog.at_level(logging.INFO, logger="medcheck_api"):
        resp = client.post("/api/auth/forgot-password", json={"username": unknown_name})

    assert resp.status_code == 200
    assert resp.json() == {"message": EXPECTED_FORGOT_MESSAGE}
    assert _count_all_reset_rows() == before_count
    assert not any(
        "Password reset link for user" in rec.getMessage() for rec in caplog.records
    )


def test_forgot_password_guest_user_returns_identical_response_without_row():
    """Guest accounts must never be resettable even when named explicitly."""
    guest_resp = client.post("/api/auth/guest")
    assert guest_resp.status_code == 200
    guest_data = guest_resp.json()

    before_count = _count_all_reset_rows()
    resp = client.post(
        "/api/auth/forgot-password",
        json={"username": guest_data["username"]},
    )

    assert resp.status_code == 200
    assert resp.json() == {"message": EXPECTED_FORGOT_MESSAGE}
    assert _fetch_reset_rows_for_user(guest_data["user_id"]) == []
    assert _count_all_reset_rows() == before_count


@pytest.mark.asyncio
async def test_full_password_reset_flow_over_http():
    """Register, request reset, consume service-issued token, and verify login flips."""
    uname = f"dr_flow_{uuid.uuid4().hex[:8]}"
    old_password = "OldPassword123!"
    new_password = "NewPassword456!"

    reg_resp = client.post(
        "/api/auth/register",
        json={"username": uname, "password": old_password},
    )
    assert reg_resp.status_code == 200

    forgot_resp = client.post("/api/auth/forgot-password", json={"username": uname})
    assert forgot_resp.status_code == 200
    assert forgot_resp.json() == {"message": EXPECTED_FORGOT_MESSAGE}

    raw_token = await create_password_reset(uname)
    assert raw_token is not None

    reset_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": new_password},
    )
    assert reset_resp.status_code == 200
    assert reset_resp.json() == EXPECTED_SUCCESS_BODY

    old_login = client.post(
        "/api/auth/login",
        json={"username": uname, "password": old_password},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/auth/login",
        json={"username": uname, "password": new_password},
    )
    assert new_login.status_code == 200
    assert new_login.json()["access_token"] is not None


@pytest.mark.asyncio
async def test_reset_password_rejects_expired_token():
    """An expired token must fail with 400 and the exact user-facing detail."""
    uname = f"dr_exp_{uuid.uuid4().hex[:8]}"
    user = await create_user(uname, "ValidStart123!")
    raw_token = await create_password_reset(uname)
    assert raw_token is not None

    past_iso = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    with closing(_get_sqlite_auth_conn()) as conn:
        conn.execute(
            "UPDATE password_resets SET expires_at = ? WHERE user_id = ?",
            (past_iso, user["id"]),
        )
        conn.commit()

    resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "ValidNext123!"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == EXPECTED_INVALID_DETAIL


@pytest.mark.asyncio
async def test_reset_password_rejects_token_reuse():
    """A reset token is single-use; replaying it must return 400."""
    uname = f"dr_reuse_{uuid.uuid4().hex[:8]}"
    await create_user(uname, "ValidStart123!")
    raw_token = await create_password_reset(uname)
    assert raw_token is not None

    first_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "UpdatedPass123!"},
    )
    assert first_resp.status_code == 200

    second_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "AnotherPass456!"},
    )
    assert second_resp.status_code == 400
    assert second_resp.json()["detail"] == EXPECTED_INVALID_DETAIL


@pytest.mark.asyncio
async def test_requesting_second_reset_link_invalidates_first_token():
    """Issuing a second reset request invalidates the earlier unused token."""
    uname = f"dr_inval_{uuid.uuid4().hex[:8]}"
    await create_user(uname, "ValidStart123!")

    first_token = await create_password_reset(uname)
    assert first_token is not None

    second_forgot = client.post("/api/auth/forgot-password", json={"username": uname})
    assert second_forgot.status_code == 200

    stale_resp = client.post(
        "/api/auth/reset-password",
        json={"token": first_token, "new_password": "UpdatedPass123!"},
    )
    assert stale_resp.status_code == 400
    assert stale_resp.json()["detail"] == EXPECTED_INVALID_DETAIL


@pytest.mark.asyncio
async def test_reset_password_rejects_weak_and_oversized_passwords():
    """Shared password complexity validator rejects weak and >72-byte inputs with 422."""
    uname = f"dr_weak_{uuid.uuid4().hex[:8]}"
    await create_user(uname, "ValidStart123!")
    raw_token = await create_password_reset(uname)
    assert raw_token is not None

    weak_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "alllowercase1"},
    )
    assert weak_resp.status_code == 422

    over_limit = "Aa1" + ("漢" * 30)
    assert len(over_limit.encode("utf-8")) > 72
    oversized_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": over_limit},
    )
    assert oversized_resp.status_code == 422

    # Rejected validation inputs must not consume the valid token.
    valid_resp = client.post(
        "/api/auth/reset-password",
        json={"token": raw_token, "new_password": "ValidStrong123!"},
    )
    assert valid_resp.status_code == 200


def test_reset_password_rejects_unknown_token():
    """A random well-formed token that was never issued returns 400."""
    resp = client.post(
        "/api/auth/reset-password",
        json={
            "token": secrets.token_urlsafe(32),
            "new_password": "ValidStrong123!",
        },
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == EXPECTED_INVALID_DETAIL
