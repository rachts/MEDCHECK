import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from services.auth import create_access_token

client = TestClient(app)
auth_headers = {"Authorization": f"Bearer {create_access_token({'sub': 'validator_user', 'uid': 'u-1', 'is_guest': False})}"}

def test_xss_and_injection_rejection():
    """Verify that script tags and SQL injection strings return 422 Unprocessable Entity."""
    xss_resp = client.post(
        "/api/check",
        json={"medicines": ["<script>alert('xss')</script>"]},
        headers=auth_headers
    )
    assert xss_resp.status_code == 422
    assert "errors" in xss_resp.json()

    sqli_resp = client.post(
        "/api/check",
        json={"medicines": ["aspirin'; DROP TABLE users;--"]},
        headers=auth_headers
    )
    assert sqli_resp.status_code == 422

def test_maximum_medicine_length():
    """Verify medicine names exceeding 100 characters are rejected."""
    long_name = "a" * 105
    resp = client.post(
        "/api/check",
        json={"medicines": [long_name]},
        headers=auth_headers
    )
    assert resp.status_code == 422

def test_empty_basket_rejection():
    """Verify empty basket is rejected."""
    resp = client.post(
        "/api/check",
        json={"medicines": []},
        headers=auth_headers
    )
    assert resp.status_code == 422

def test_maximum_basket_size_limit():
    """Verify that baskets exceeding 20 drugs are rejected to ensure predictable latency."""
    drugs = [f"Drug{i}" for i in range(25)]
    resp = client.post(
        "/api/check",
        json={"medicines": drugs},
        headers=auth_headers
    )
    assert resp.status_code == 422
