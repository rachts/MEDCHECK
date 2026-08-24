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
