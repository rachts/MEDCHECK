import pytest
import sys
import os
import uuid

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from services.auth import create_access_token

client = TestClient(app)

def test_unauthorized_access_to_protected_endpoints():
    """Verify that clinical endpoints strictly return 401 Unauthorized without Bearer token."""
    check_resp = client.post("/api/check", json={"medicines": ["aspirin"]})
    assert check_resp.status_code == 401
    assert "Could not validate clinical session credentials" in check_resp.json()["detail"]

    profile_resp = client.get("/api/medicine/aspirin/profile")
    assert profile_resp.status_code == 401

    search_resp = client.get("/api/medicines/search?q=aspirin")
    assert search_resp.status_code == 401

def test_user_registration_and_login_flow():
    """Verify registration, duplicate rejection, and login JWT generation."""
    uname = f"dr_smith_{uuid.uuid4().hex[:6]}"
    pwd = "SecurePassword123!"

    # 1. Register
    reg_resp = client.post("/api/auth/register", json={
        "username": uname,
        "password": pwd,
        "email": f"{uname}@hospital.org"
    })
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert reg_data["access_token"] is not None
    assert reg_data["username"] == uname
    assert reg_data["is_guest"] is False

    # 2. Reject duplicate username.
    # The password must satisfy the complexity policy so that a 400 here proves
    # the duplicate-username branch was reached, not a 422 validation rejection.
    dup_resp = client.post("/api/auth/register", json={
        "username": uname,
        "password": "AnotherPassword1"
    })
    assert dup_resp.status_code == 400

    # 3. Successful Login
    login_resp = client.post("/api/auth/login", json={
        "username": uname,
        "password": pwd
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # 4. Access protected endpoint with token
    check_resp = client.post(
        "/api/check",
        json={"medicines": ["paracetamol"]},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert check_resp.status_code == 200
    assert check_resp.json()["safe"] is True

def test_guest_session_generation():
    """Verify anonymous guest session generates a functional clinical JWT token."""
    guest_resp = client.post("/api/auth/guest")
    assert guest_resp.status_code == 200
    data = guest_resp.json()
    assert data["is_guest"] is True
    assert data["access_token"] is not None

    # Test protected call with guest token
    search_resp = client.get(
        "/api/medicines/search?q=tylenol",
        headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert search_resp.status_code == 200


# ==============================================================================
# httpOnly session cookie (audit item 5)
#
# The token is issued in the response body AND as an httpOnly cookie so a browser
# client never has to keep it in localStorage. These tests pin both halves of
# that contract: the cookie is set with the right flags, it authenticates a
# subsequent request on its own, and logout revokes it.
# ==============================================================================

def test_auth_endpoints_set_httponly_session_cookie():
    """Every credential-issuing endpoint must plant the httpOnly session cookie."""
    guest_resp = client.post("/api/auth/guest")
    assert guest_resp.status_code == 200

    set_cookie = guest_resp.headers.get("set-cookie", "")
    assert "medcheck_session=" in set_cookie
    # Attribute names and values are case-insensitive per RFC 6265; Starlette
    # emits "SameSite=lax", so compare in lowercase rather than pinning casing.
    lowered = set_cookie.lower()
    # httpOnly is the whole point: JavaScript -- including any injected script --
    # must not be able to read this value.
    assert "httponly" in lowered
    # SameSite=Lax withholds the cookie on cross-site POST, standing in for a CSRF
    # token on this JSON API.
    assert "samesite=lax" in lowered
    # The cookie must not outlive the token it carries, or the client believes it
    # still has a session it cannot use. Guest tokens expire after 2 hours.
    assert "max-age=7200" in lowered


def test_session_cookie_alone_authenticates_a_protected_request():
    """
    A request carrying only the cookie (no Authorization header) must be accepted.
    This is the browser reload path: the in-memory token is gone, the cookie is
    all that remains, and the app must stay logged in.
    """
    cookie_client = TestClient(app)
    guest_resp = cookie_client.post("/api/auth/guest")
    assert guest_resp.status_code == 200
    assert "medcheck_session" in cookie_client.cookies

    # TestClient persists cookies on the instance; send no bearer header.
    search_resp = cookie_client.get("/api/medicines/search?q=aspirin")
    assert search_resp.status_code == 200


def test_logout_clears_the_session_cookie():
    """Logout must delete the cookie so the credential cannot be replayed."""
    logout_resp = client.post("/api/auth/logout")
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "logged_out"

    set_cookie = logout_resp.headers.get("set-cookie", "")
    assert "medcheck_session=" in set_cookie
    # A deletion is a Set-Cookie that expires the value immediately.
    assert 'Max-Age=0' in set_cookie or "expires=" in set_cookie.lower()


def test_authorization_header_still_takes_precedence():
    """
    A valid Bearer header must authenticate even when no cookie is present -- the
    non-browser contract is unchanged by the cookie addition.
    """
    header_only_client = TestClient(app)
    guest_resp = header_only_client.post("/api/auth/guest")
    token = guest_resp.json()["access_token"]
    header_only_client.cookies.clear()

    resp = header_only_client.get(
        "/api/medicines/search?q=aspirin",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert resp.status_code == 200


# ==============================================================================
# Password length is measured in BYTES, not characters (audit item 3)
#
# bcrypt's 72-unit limit is a byte limit, and bcrypt >= 4.0 raises rather than
# truncating. The frontend used to check `password.length > 72` -- UTF-16 code
# units -- so a multi-byte password passed the form and was rejected by the API.
# These tests pin the byte semantics on the side that is authoritative.
# ==============================================================================

def test_password_byte_limit_constants_agree():
    """
    The policy bound in models.py and the algorithmic bound in services/auth.py
    are separate constants by design (one is changeable, one is not). If they ever
    drift, the validator would accept a password the hasher then truncates -- the
    exact silent-truncation failure the byte check exists to prevent.
    """
    from models import MAX_PASSWORD_BYTES, MAX_PASSWORD_CHARS
    from services.auth import BCRYPT_MAX_PASSWORD_BYTES

    assert MAX_PASSWORD_BYTES == BCRYPT_MAX_PASSWORD_BYTES
    # A UTF-8 string of N bytes is at most N characters, so the character ceiling
    # can never be looser than the byte ceiling.
    assert MAX_PASSWORD_CHARS <= MAX_PASSWORD_BYTES


def test_registration_rejects_multibyte_password_over_the_byte_limit():
    """
    33 characters, 93 bytes. Comfortably inside any character-based limit and well
    outside bcrypt's, so this is precisely the input the old character check let
    through. It must be rejected with a 422, not truncated and hashed.
    """
    over_limit = "Aa1" + ("漢" * 30)
    assert len(over_limit) <= 72          # would pass a character check
    assert len(over_limit.encode("utf-8")) > 72   # must fail the byte check

    resp = client.post("/api/auth/register", json={
        "username": f"dr_multi_{uuid.uuid4().hex[:6]}",
        "password": over_limit,
    })
    assert resp.status_code == 422


def test_registration_accepts_a_password_at_exactly_the_byte_limit():
    """72 bytes is inside the limit; the boundary must not be off by one."""
    uname = f"dr_edge_{uuid.uuid4().hex[:6]}"
    exact = "Aa1" + ("x" * 69)
    assert len(exact.encode("utf-8")) == 72

    reg_resp = client.post("/api/auth/register", json={
        "username": uname,
        "password": exact,
    })
    assert reg_resp.status_code == 200

    # And it must still verify on the way back in -- hashing and verification have
    # to encode and clamp the password identically.
    login_resp = client.post("/api/auth/login", json={
        "username": uname,
        "password": exact,
    })
    assert login_resp.status_code == 200


def test_hash_and_verify_round_trip_on_multibyte_passwords():
    """
    Below the limit, a multi-byte password must round-trip unchanged. This is the
    regression guard for the clamp helper: if hashing and verification ever slice
    at different points, this login stops working.
    """
    from services.auth import get_password_hash, verify_password

    password = "Contraseña1éèü\U0001f600"
    assert len(password.encode("utf-8")) <= 72

    hashed = get_password_hash(password)
    assert verify_password(password, hashed) is True
    assert verify_password(password + "x", hashed) is False


def test_oversized_password_at_the_hasher_truncates_instead_of_raising():
    """
    The clamp inside the hasher is a last-ditch guard for a caller that bypassed
    UserCreate. bcrypt >= 4.0 raises on input over 72 bytes, so without the clamp
    this would be a 500 rather than a degraded-but-working hash.
    """
    from services.auth import get_password_hash, verify_password

    over_limit = "Aa1" + ("漢" * 40)   # 123 bytes
    assert len(over_limit.encode("utf-8")) > 72

    hashed = get_password_hash(over_limit)
    assert verify_password(over_limit, hashed) is True
