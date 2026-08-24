"""
Contract tests for the two endpoints that had no coverage at all:

  * POST /api/client-error   -- the browser error sink (audit item 47)
  * POST /api/basket/analyze -- the compatibility alias for /api/check (item 48)

Both are reachable in production and both were previously untested, so a change
to either could ship broken: the alias in particular is hidden from the OpenAPI
schema (include_in_schema=False), which means no schema-driven check would ever
have noticed it regressing.
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from models import ClientErrorReport
from services.auth import create_access_token

client = TestClient(app)
auth_headers = {
    "Authorization": f"Bearer {create_access_token({'sub': 'contract_user', 'uid': 'u-contract', 'is_guest': False})}"
}


# ==============================================================================
# POST /api/client-error  (audit item 47)
# ==============================================================================

def test_client_error_accepts_valid_report_without_auth():
    """
    The ErrorBoundary reports crashes before a session may exist, so this endpoint
    is deliberately unauthenticated. That is a design decision worth pinning: if
    auth were ever added, the frontend would silently stop reporting crashes.
    """
    resp = client.post("/api/client-error", json={
        "error": "TypeError: Cannot read properties of undefined (reading 'gi_profile')",
        "stack": "at MedicineProfilePanel (MedicineProfilePanel.jsx:360)"
    })
    assert resp.status_code == 200
    assert resp.json() == {"status": "logged"}


def test_client_error_allows_missing_stack():
    """`stack` defaults to empty: a thrown non-Error value carries no stack."""
    resp = client.post("/api/client-error", json={"error": "Unknown render failure"})
    assert resp.status_code == 200


def test_client_error_rejects_empty_and_oversized_payloads():
    """
    The payload is bounded by schema, not merely by the 1MB body guard. An
    unbounded string here would let any anonymous client write arbitrarily large
    volumes into the log sink.
    """
    empty_resp = client.post("/api/client-error", json={"error": ""})
    assert empty_resp.status_code == 422

    missing_resp = client.post("/api/client-error", json={"stack": "no error field"})
    assert missing_resp.status_code == 422

    oversized_error = client.post("/api/client-error", json={"error": "E" * 501})
    assert oversized_error.status_code == 422

    oversized_stack = client.post("/api/client-error", json={
        "error": "Deep component tree crash",
        "stack": "S" * 4001
    })
    assert oversized_stack.status_code == 422


def test_client_error_report_strips_control_characters():
    """
    Newlines in an attacker-supplied message must not survive into the log, or a
    single report can forge additional log lines (log injection). Asserted on the
    model directly, because the endpoint response does not echo the payload back.
    """
    report = ClientErrorReport(
        error="Real failure\n2026-08-24 12:00:00 ERROR Forged: admin login succeeded",
        stack="frame one\r\nframe two\tcolumn"
    )
    assert "\n" not in report.error
    assert "\r" not in report.error
    assert "Forged" in report.error, "sanitising must not silently discard content"

    assert "\r" not in report.stack
    assert "\n" not in report.stack
    assert "\t" not in report.stack

    # A NUL byte is neither printable nor whitespace and must be dropped outright.
    nul_report = ClientErrorReport(error="before\x00after")
    assert "\x00" not in nul_report.error


def test_client_error_accepts_a_realistic_react_component_stack():
    """
    Guards the contract the ErrorBoundary depends on: a genuine React
    componentStack from a deeply nested tree must fit inside the schema bound.
    """
    component_stack = "\n".join(
        f"    in ComponentNumber{i} (created by MedicineProfilePanel)" for i in range(40)
    )
    assert len(component_stack) < 4000, "fixture must stay inside the documented bound"

    resp = client.post("/api/client-error", json={
        "error": "TypeError: undefined is not an object",
        "stack": component_stack
    })
    assert resp.status_code == 200


# ==============================================================================
# POST /api/basket/analyze  (audit item 48)
# ==============================================================================

def test_basket_analyze_alias_requires_authentication():
    """The alias must not be a way around the auth applied to /api/check."""
    resp = client.post("/api/basket/analyze", json={"medicines": ["aspirin", "warfarin"]})
    assert resp.status_code == 401


def test_basket_analyze_alias_enforces_the_same_validation():
    """The alias shares CheckRequest, so injection payloads are rejected identically."""
    resp = client.post(
        "/api/basket/analyze",
        json={"medicines": ["<script>alert('xss')</script>"]},
        headers=auth_headers
    )
    assert resp.status_code == 422


def test_basket_analyze_alias_matches_check_response():
    """
    The alias exists only for backwards compatibility with older clients, so its
    value is entirely in returning what /api/check returns. Clinically meaningful
    fields are compared rather than the whole body, because per-request metadata
    (request id, response timing) legitimately differs between the two calls.
    """
    payload = {"medicines": ["Warfarin", "Ibuprofen"]}

    canonical = client.post("/api/check", json=payload, headers=auth_headers)
    alias = client.post("/api/basket/analyze", json=payload, headers=auth_headers)

    assert canonical.status_code == 200
    assert alias.status_code == 200

    a, b = canonical.json(), alias.json()
    assert a["safe"] == b["safe"] is False
    assert a["composite_gi_score"] == b["composite_gi_score"]
    assert a["composite_gi_tier"] == b["composite_gi_tier"]
    assert len(a["interactions"]) == len(b["interactions"]) >= 1
    assert sorted(a["profiles"].keys()) == sorted(b["profiles"].keys())


def test_basket_analyze_alias_is_hidden_from_the_public_schema():
    """
    Deliberately excluded from OpenAPI so the alias is not advertised as a second
    supported entry point. /api/check must still be documented.
    """
    schema = client.get("/openapi.json").json()
    assert "/api/basket/analyze" not in schema["paths"]
    assert "/api/check" in schema["paths"]
