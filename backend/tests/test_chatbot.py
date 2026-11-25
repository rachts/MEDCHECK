import os
import sys
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
import main as main_module
from config import settings
from services.auth import create_access_token
from services import groq_client
from services.medicine_chat import (
    AI_FALLBACK_DISCLAIMER,
    SYSTEM_PROMPT_INITIAL,
    SYSTEM_PROMPT_FOLLOWUP,
    SYSTEM_PROMPT_FALLBACK,
)
from models import DrugLabelResult

client = TestClient(app)


def make_auth_headers(prefix: str = "chat_test") -> dict:
    uid = f"{prefix}_{uuid.uuid4().hex[:8]}"
    token = create_access_token({"sub": uid, "uid": uid, "is_guest": False})
    return {"Authorization": f"Bearer {token}"}


def test_chat_rejects_unauthenticated_requests():
    """Unauthenticated POST /api/chat must return 401 identical to /api/check."""
    resp = client.post("/api/chat", json={"medicine": "Warfarin", "question": None})
    assert resp.status_code == 401
    assert "Could not validate clinical session credentials" in resp.json()["detail"]


def test_chat_accepts_guest_token():
    """Guest tokens issued by /api/auth/guest must authenticate /api/chat."""
    guest_resp = client.post("/api/auth/guest")
    assert guest_resp.status_code == 200
    token = guest_resp.json()["access_token"]

    with patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)):
        resp = client.post(
            "/api/chat",
            json={"medicine": "Dolo 650", "question": None},
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    assert resp.json()["found"] is True


def test_chat_rejects_xss_and_empty_medicine():
    """Validation rejects script payloads and blank medicine strings with 422."""
    headers = make_auth_headers("val")
    xss_resp = client.post(
        "/api/chat",
        json={"medicine": "<script>alert('xss')</script>", "question": None},
        headers=headers,
    )
    assert xss_resp.status_code == 422

    blank_resp = client.post(
        "/api/chat",
        json={"medicine": "   ", "question": None},
        headers=headers,
    )
    assert blank_resp.status_code == 422


def test_chat_unknown_medicine_fallback_succeeds_with_mocked_groq():
    """Unknown medicine with Groq available returns ai_fallback: true, answer, disclaimer, and profile: null."""
    captured = {}

    async def fake_groq(prompt: str, system_prompt: str = None):
        captured["prompt"] = prompt
        captured["system_prompt"] = system_prompt
        return (
            "What it is:\nNotARealCompound999 is not a standard known medicine.\n\n"
            "What it is used for:\nUnknown outside a label.\n\n"
            "Common side effects:\nNot listed.\n\n"
            "Important cautions:\nCheck with a pharmacist before taking any unknown tablet.\n\n"
            "For your own treatment, please ask your doctor or pharmacist."
        )

    with patch.object(groq_client, "call_groq_api", new=fake_groq):
        resp = client.post(
            "/api/chat",
            json={"medicine": "NotARealCompound999", "question": None},
            headers=make_auth_headers("unk_ok"),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False
    assert data["ai_fallback"] is True
    assert data["ai_available"] is True
    assert data["medicine"] == "NotARealCompound999"
    assert data["profile"] is None
    assert "What it is:" in (data["answer"] or "")
    assert data["disclaimer"] == (
        "This is AI-fetched data, not from the MEDCHECK database. Kindly consult a pharmacist before use."
    )
    assert data["message"] is None
    assert captured["system_prompt"] == SYSTEM_PROMPT_FALLBACK
    assert "NotARealCompound999" in captured["prompt"]


def test_chat_unknown_medicine_followup_uses_fallback_path():
    """Follow-up question on an unknown medicine uses the same AI fallback path and keeps the disclaimer."""
    captured = {}

    async def fake_groq(prompt: str, system_prompt: str = None):
        captured["prompt"] = prompt
        captured["system_prompt"] = system_prompt
        return "Take it only as a doctor advises.\n\nFor your own treatment, please ask your doctor or pharmacist."

    with patch.object(groq_client, "call_groq_api", new=fake_groq):
        resp = client.post(
            "/api/chat",
            json={"medicine": "NotARealCompound999", "question": "Can I take this after breakfast?"},
            headers=make_auth_headers("unk_fu"),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False
    assert data["ai_fallback"] is True
    assert data["ai_available"] is True
    assert data["profile"] is None
    assert data["medicine"] == "NotARealCompound999"
    assert data["disclaimer"] == AI_FALLBACK_DISCLAIMER
    assert "Can I take this after breakfast?" in captured["prompt"]
    assert captured["system_prompt"] == SYSTEM_PROMPT_FALLBACK


def test_chat_unknown_medicine_with_no_groq_key_returns_not_found(monkeypatch):
    """Unknown medicine with no GROQ_API_KEY configured returns today's not-found response without calling Groq HTTP."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)

    resp = client.post(
        "/api/chat",
        json={"medicine": "NotARealCompound999", "question": None},
        headers=make_auth_headers("unk_nokey"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False
    assert data["ai_fallback"] is False
    assert data["ai_available"] is False
    assert data["profile"] is None
    assert data["answer"] is None
    assert data["disclaimer"] is None
    assert "not found" in (data["message"] or "").lower()


def test_chat_unknown_medicine_when_groq_fails_returns_not_found_no_500():
    """Unknown medicine when Groq returns None or raises an exception degrades cleanly to today's response, never a 500."""
    with patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)):
        resp_none = client.post(
            "/api/chat",
            json={"medicine": "NotARealCompound999", "question": None},
            headers=make_auth_headers("unk_fail1"),
        )
    assert resp_none.status_code == 200
    data_none = resp_none.json()
    assert data_none["found"] is False
    assert data_none["ai_fallback"] is False
    assert data_none["ai_available"] is False
    assert data_none["profile"] is None
    assert data_none["answer"] is None
    assert data_none["disclaimer"] is None
    assert "not found" in (data_none["message"] or "").lower()

    with patch.object(
        groq_client,
        "call_groq_api",
        new=AsyncMock(side_effect=RuntimeError("Groq service unreachable")),
    ):
        resp_err = client.post(
            "/api/chat",
            json={"medicine": "NotARealCompound999", "question": None},
            headers=make_auth_headers("unk_fail2"),
        )
    assert resp_err.status_code == 200
    data_err = resp_err.json()
    assert data_err["found"] is False
    assert data_err["ai_fallback"] is False
    assert data_err["ai_available"] is False
    assert data_err["profile"] is None
    assert data_err["answer"] is None
    assert data_err["disclaimer"] is None
    assert "not found" in (data_err["message"] or "").lower()


def test_chat_unknown_fallback_profile_branch_triggers_ai_fallback():
    """Second found:false branch (profile.data_source == 'unknown_fallback') also uses AI fallback cleanly."""
    missing_label = DrugLabelResult(generic_name="mysterycompound", found=False, source="fallback")

    async def fake_groq(prompt: str, system_prompt: str = None):
        return (
            "What it is:\nMysteryBrand is a general example.\n\n"
            "For your own treatment, please ask your doctor or pharmacist."
        )

    with (
        patch.object(main_module, "resolve_medicine_for_chat", return_value=("mysterycompound", "MysteryBrand")),
        patch.object(main_module, "fetch_and_cache_single_drug", new=AsyncMock(return_value=missing_label)),
        patch.object(groq_client, "call_groq_api", new=fake_groq),
    ):
        resp_ok = client.post(
            "/api/chat",
            json={"medicine": "MysteryBrand", "question": None},
            headers=make_auth_headers("unk_prof_ok"),
        )
    assert resp_ok.status_code == 200
    ok_data = resp_ok.json()
    assert ok_data["found"] is False
    assert ok_data["ai_fallback"] is True
    assert ok_data["ai_available"] is True
    assert ok_data["medicine"] == "MysteryBrand"
    assert ok_data["profile"] is None
    assert ok_data["disclaimer"] == AI_FALLBACK_DISCLAIMER
    assert "MysteryBrand" in ok_data["answer"]

    with (
        patch.object(main_module, "resolve_medicine_for_chat", return_value=("mysterycompound", "MysteryBrand")),
        patch.object(main_module, "fetch_and_cache_single_drug", new=AsyncMock(return_value=missing_label)),
        patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)),
    ):
        resp_fail = client.post(
            "/api/chat",
            json={"medicine": "MysteryBrand", "question": None},
            headers=make_auth_headers("unk_prof_fail"),
        )
    assert resp_fail.status_code == 200
    fail_data = resp_fail.json()
    assert fail_data["found"] is False
    assert fail_data["ai_fallback"] is False
    assert fail_data["ai_available"] is False
    assert fail_data["answer"] is None
    assert fail_data["disclaimer"] is None
    assert "no detailed prescribing label data" in (fail_data["message"] or "").lower()


def test_chat_prompts_enforce_simple_english_india_rules():
    """All three system prompts enforce simple English for India, no em dashes, and the standard closing line."""
    closing_line = "For your own treatment, please ask your doctor or pharmacist."
    for prompt in (SYSTEM_PROMPT_INITIAL, SYSTEM_PROMPT_FOLLOWUP, SYSTEM_PROMPT_FALLBACK):
        assert closing_line in prompt
        assert "India" in prompt
        assert "\u2014" not in prompt
        assert "simple English" in prompt

    for heading in (
        "What it is:",
        "What it is used for:",
        "How it is usually taken:",
        "Common side effects:",
        "Food and alcohol cautions:",
        "Serious warnings:",
    ):
        assert heading in SYSTEM_PROMPT_INITIAL

    for heading in (
        "What it is:",
        "What it is used for:",
        "Common side effects:",
        "Important cautions:",
    ):
        assert heading in SYSTEM_PROMPT_FALLBACK

    assert "MEDCHECK database" in SYSTEM_PROMPT_FALLBACK
    assert "personal dosing" in SYSTEM_PROMPT_FALLBACK


def test_chat_without_api_key_returns_profile_and_ai_available_false(monkeypatch):
    """With no GROQ_API_KEY configured, /api/chat returns full profile with answer null and ai_available false."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)

    resp = client.post(
        "/api/chat",
        json={"medicine": "Warfarin", "question": None},
        headers=make_auth_headers("nokey"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["ai_fallback"] is False
    assert data["disclaimer"] is None
    assert data["medicine"] == "Warfarin"
    assert data["answer"] is None
    assert data["ai_available"] is False
    assert data["profile"]["generic_name"] == "warfarin"
    assert len(data["profile"]["side_effects"]) > 0
    assert len(data["profile"]["food_interactions"]) > 0
    assert data["boxed_warning"] is not None
    assert len(data["known_interactions"]) >= 2


def test_chat_brand_canonicalisation_and_mocked_groq_initial():
    """Brands like Dolo 650, Crocin, Ecosprin resolve canonically and pass grounded profile context to Groq."""
    captured = {}

    async def fake_groq(prompt: str, system_prompt: str = None):
        captured["prompt"] = prompt
        captured["system_prompt"] = system_prompt
        return (
            "What it is:\nParacetamol is a pain reliever and fever reducer.\n"
            "What it is used for:\nRelieving mild to moderate pain and fever."
        )

    with patch.object(groq_client, "call_groq_api", new=fake_groq):
        dolo_resp = client.post(
            "/api/chat",
            json={"medicine": "Dolo 650", "question": None},
            headers=make_auth_headers("brand1"),
        )
        assert dolo_resp.status_code == 200
        dolo_data = dolo_resp.json()
        assert dolo_data["found"] is True
        assert dolo_data["ai_fallback"] is False
        assert dolo_data["disclaimer"] is None
        assert dolo_data["medicine"] == "Paracetamol"
        assert dolo_data["profile"]["generic_name"] == "paracetamol"
        assert dolo_data["ai_available"] is True
        assert "pain reliever" in dolo_data["answer"]
        assert "ONLY from the supplied medicine data" in captured["system_prompt"]
        assert "Dolo 650" in captured["prompt"]
        assert "Paracetamol" in captured["prompt"]
        assert "CYP2E1" in captured["prompt"]

        crocin_resp = client.post(
            "/api/chat",
            json={"medicine": "Crocin", "question": None},
            headers=make_auth_headers("brand2"),
        )
        assert crocin_resp.status_code == 200
        assert crocin_resp.json()["medicine"] == "Paracetamol"

        ecosprin_resp = client.post(
            "/api/chat",
            json={"medicine": "Ecosprin", "question": None},
            headers=make_auth_headers("brand3"),
        )
        assert ecosprin_resp.status_code == 200
        assert ecosprin_resp.json()["medicine"] == "Aspirin"


def test_chat_follow_up_question_uses_same_grounded_data():
    """Follow-up questions supply both the profile data and the user's question to Groq."""
    captured = {}

    async def fake_groq(prompt: str, system_prompt: str = None):
        captured["prompt"] = prompt
        captured["system_prompt"] = system_prompt
        return "Avoid excessive alcohol because it raises the risk of lactic acidosis."

    with patch.object(main_module, "call_groq_api", new=fake_groq):
        resp = client.post(
            "/api/chat",
            json={"medicine": "Metformin", "question": "Can I drink alcohol with this?"},
            headers=make_auth_headers("followup"),
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["medicine"] == "Metformin"
    assert data["ai_available"] is True
    assert "lactic acidosis" in data["answer"]
    assert "Can I drink alcohol with this?" in captured["prompt"]
    assert "follow-up" in captured["system_prompt"].lower()


def test_chat_graceful_degradation_when_groq_fails():
    """When call_groq_api returns None (e.g. circuit breaker open), profile still returns cleanly."""
    with patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)):
        resp = client.post(
            "/api/chat",
            json={"medicine": "Metformin", "question": None},
            headers=make_auth_headers("degrade"),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["profile"]["generic_name"] == "metformin"
    assert data["answer"] is None
    assert data["ai_available"] is False


def test_chat_rate_limiting_enforced():
    """POST /api/chat enforces RATE_LIMIT_CHECK (10/minute per client)."""
    headers = make_auth_headers("ratelimit")
    with patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)):
        statuses = []
        for _ in range(11):
            r = client.post(
                "/api/chat",
                json={"medicine": "Dolo 650", "question": None},
                headers=headers,
            )
            statuses.append(r.status_code)
    assert statuses[:10] == [200] * 10
    assert statuses[10] == 429


@pytest.mark.asyncio
async def test_groq_client_no_key_smoke_and_request_shape(monkeypatch):
    """Smoke check: missing GROQ_API_KEY returns None; configured key posts to Groq OpenAI-compatible URL."""
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    assert await groq_client.call_groq_api("hello") is None

    monkeypatch.setattr(settings, "GROQ_API_KEY", "test-groq-key")
    monkeypatch.setattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b")
    groq_client.circuit_breaker.record_success()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": "Grounded summary"}}]
    }

    mock_post = AsyncMock(return_value=mock_resp)
    mock_http = MagicMock()
    mock_http.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
    mock_http.__aexit__ = AsyncMock(return_value=False)

    with patch("services.groq_client.httpx.AsyncClient", return_value=mock_http):
        result = await groq_client.call_groq_api("user text", system_prompt="sys text")

    assert result == "Grounded summary"
    call_args = mock_post.call_args
    assert call_args.args[0] == "https://api.groq.com/openai/v1/chat/completions"
    assert call_args.kwargs["json"]["model"] == "openai/gpt-oss-120b"
    assert call_args.kwargs["json"]["temperature"] == 0.1
    assert call_args.kwargs["json"]["max_tokens"] == 800
