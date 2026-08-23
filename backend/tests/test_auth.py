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

    # 2. Reject duplicate username
    dup_resp = client.post("/api/auth/register", json={
        "username": uname,
        "password": "anotherpassword"
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
