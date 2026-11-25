import os
import sys
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from main import app
from services import groq_client
from services.auth import create_access_token
from services.india_banned import (
    ban_stats,
    lookup_ban,
    plain_status,
    search_banned,
)

client = TestClient(app)


def make_auth_headers(prefix: str = "cdsco_test") -> dict:
    uid = f"{prefix}_{uuid.uuid4().hex[:8]}"
    token = create_access_token({"sub": uid, "uid": uid, "is_guest": False})
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# UNIT TESTS: services/india_banned.py
# ==============================================================================


def test_lookup_phenacetin_matches_unqualified_prohibited():
    match = lookup_ban(["phenacetin"])
    assert match is not None
    assert match.entry_name == "Phenacetin"
    assert match.status == "Prohibited"
    assert match.qualified is False
    assert match.heading == "BANNED IN INDIA"
    assert "banned in India" in match.message
    assert match.notification in match.message


def test_lookup_amoxicillin_serratiopeptidase_matches_2026_fdc():
    match = lookup_ban(["amoxicillin", "serratiopeptidase"])
    assert match is not None
    assert match.kind == "fdc"
    assert match.status == "Prohibited"
    assert match.qualified is False
    assert match.date == "2026-06-11"
    assert "Amoxicillin + Serratiopeptidase" == match.entry_name

    # Order-independent and salt/strength-normalized matching
    match_variants = lookup_ban(["Serratiopeptidase 10mg", "Amoxicillin Trihydrate 500mg"])
    assert match_variants is not None
    assert match_variants.entry_name == match.entry_name
    assert match_variants.date == "2026-06-11"


def test_lookup_non_banned_singles_return_none():
    assert lookup_ban(["paracetamol"]) is None
    assert lookup_ban(["amoxicillin"]) is None
    assert lookup_ban(["Dolo 650"]) is None


def test_lookup_nimesulide_matches_qualified_entry():
    match = lookup_ban(["nimesulide"])
    assert match is not None
    assert match.qualified is True
    assert match.status == "Prohibited"
    assert match.heading == "BANNED IN INDIA IN THIS CASE"
    assert "children below 12 years" in match.entry_name.lower()
    assert match.entry_name in match.message


def test_lookup_quashed_status_verbatim_and_non_prohibited_statuses():
    quashed = lookup_ban(["aceclofenac", "paracetamol", "rabeprazole"])
    assert quashed is not None
    assert "Quashed" in quashed.status
    assert quashed.heading == "BAN CANCELLED BY COURT"
    assert quashed.status in quashed.message

    quashed_etodolac = lookup_ban(["etodolac", "paracetamol"])
    assert quashed_etodolac is not None
    assert "Quashed" in quashed_etodolac.status
    assert quashed_etodolac.heading == "BAN CANCELLED BY COURT"

    unapproved = lookup_ban(["mirabegron", "solifenacin"])
    assert unapproved is not None
    assert unapproved.status.startswith("Unapproved FDC")
    assert unapproved.heading == "STOPPED IN INDIA: NOT APPROVED"

    under_exam = lookup_ban(["paracetamol", "phenylephrine", "caffeine"])
    assert under_exam is not None
    assert under_exam.status.startswith("Under examination")
    assert under_exam.heading == "UNDER GOVERNMENT EXAMINATION"

    revoked = lookup_ban(["dextropropoxyphene"])
    assert revoked is not None
    assert "revoked" in revoked.status.lower()
    assert revoked.heading == "BAN CANCELLED BY COURT"

    stayed = lookup_ban(["phenylpropanolamine"])
    assert stayed is not None
    assert stayed.heading == "INDIA REGULATORY STATUS"
    assert stayed.status in stayed.message


def test_empty_ingredient_entries_never_match_lookup_but_appear_in_search():
    assert lookup_ban(["kaolin"]) is None
    assert lookup_ban(["pectin"]) is None
    assert lookup_ban(["chloroform"]) is None

    hits = search_banned("kaolin")
    assert len(hits) >= 1
    assert any("kaolin" in h["name"].lower() for h in hits)


def test_ban_stats_and_plain_status_no_em_dash_or_emoji():
    stats = ban_stats()
    assert stats["total"] == 726
    assert stats["prohibited"] == 662
    assert stats["unapproved"] == 36
    assert stats["under_examination"] == 19
    assert stats["quashed_or_revoked"] == 8

    # plain_status accepts single-argument entry dict cleanly
    heading, msg = plain_status({
        "name": "Phenacetin",
        "status": "Prohibited",
        "notification": "GSR 578(E) 23.07.1983",
        "ingredients": ["phenacetin"],
    })
    assert heading == "BANNED IN INDIA"
    assert "banned in India" in msg
    assert "\u2014" not in msg


# ==============================================================================
# API TESTS: /api/chat, /api/check, /api/medicine/{name}/profile, /api/india/banned
# ==============================================================================


def test_api_chat_phenacetin_no_groq_key(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    headers = make_auth_headers("chat_phen")

    resp = client.post(
        "/api/chat",
        json={"medicine": "Phenacetin", "question": None},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["india_ban"]["matched"] is True
    assert data["india_ban"]["entry_name"] == "Phenacetin"
    assert data["india_ban"]["qualified"] is False
    assert data["india_ban_overview"] is False
    assert data["ai_fallback"] is False
    assert data["profile"] is None
    assert "banned in India" in (data["answer"] or "")

    # Follow-up question keeps india_ban on every response
    followup = client.post(
        "/api/chat",
        json={"medicine": "Phenacetin", "question": "Can I take this for fever?"},
        headers=headers,
    )
    assert followup.status_code == 200
    fu_data = followup.json()
    assert fu_data["india_ban"]["matched"] is True
    assert "banned in India" in (fu_data["answer"] or "")


def test_api_chat_banned_combination_string(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    resp = client.post(
        "/api/chat",
        json={"medicine": "Amoxicillin + Serratiopeptidase", "question": None},
        headers=make_auth_headers("chat_fdc"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["india_ban"]["matched"] is True
    assert data["india_ban"]["entry_name"] == "Amoxicillin + Serratiopeptidase"
    assert data["india_ban"]["date"] == "2026-06-11"
    assert "banned in India" in (data["answer"] or "")


def test_api_chat_curated_qualified_ban_with_and_without_groq(monkeypatch):
    headers = make_auth_headers("chat_diclo")
    captured = {}

    async def fake_groq(prompt: str, system_prompt: str = None):
        captured["prompt"] = prompt
        captured["system_prompt"] = system_prompt
        return "What it is:\nDiclofenac is a pain medicine.\n\nFor your own treatment, please ask your doctor or pharmacist."

    with patch.object(groq_client, "call_groq_api", new=fake_groq):
        resp = client.post(
            "/api/chat",
            json={"medicine": "Diclofenac", "question": None},
            headers=headers,
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["india_ban"]["matched"] is True
    assert data["india_ban"]["qualified"] is True
    assert "for animal use" in data["india_ban"]["entry_name"].lower()
    assert data["answer"].startswith(data["india_ban"]["message"] + "\n\n")
    assert "What it is:" in data["answer"]
    assert "Diclofenac and its formulations (for animal use)" in captured["system_prompt"]
    assert "Never soften" in captured["system_prompt"]

    # Without Groq key, answer is the ban message alone
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    resp_no_key = client.post(
        "/api/chat",
        json={"medicine": "Diclofenac", "question": "Is it safe?"},
        headers=headers,
    )
    assert resp_no_key.status_code == 200
    no_key_data = resp_no_key.json()
    assert no_key_data["india_ban"]["matched"] is True
    assert no_key_data["answer"] == no_key_data["india_ban"]["message"]
    assert no_key_data["ai_available"] is False


def test_api_chat_banned_overview_question(monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    resp = client.post(
        "/api/chat",
        json={"medicine": "which medicines are banned in India", "question": None},
        headers=make_auth_headers("chat_over"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["india_ban_overview"] is True
    assert data["found"] is False
    assert data["ai_fallback"] is False
    assert data["profile"] is None
    assert data["india_ban"] is None
    assert "726" in (data["answer"] or "")
    assert "ingredient" in (data["answer"] or "").lower()
    assert "brand" in (data["answer"] or "").lower()
    assert "Amidopyrine" in (data["answer"] or "")
    assert "Phenacetin" in (data["answer"] or "")


def test_api_check_fdc_ban_alerts_and_separate_medicines_no_false_positive():
    headers = make_auth_headers("chk_ban")

    with patch("services.openfda.fetch_drug_label", new=AsyncMock(return_value=None)):
        # Basket with a banned FDC product (both explicit combo and Indian brand FDC)
        fdc_resp = client.post(
            "/api/check",
            json={"medicines": ["Amoxicillin + Serratiopeptidase"]},
            headers=headers,
        )
        assert fdc_resp.status_code == 200
        fdc_data = fdc_resp.json()
        assert len(fdc_data["india_ban_alerts"]) == 1
        assert fdc_data["india_ban_alerts"][0]["medicine"] == "Amoxicillin + Serratiopeptidase"
        assert fdc_data["india_ban_alerts"][0]["info"]["matched"] is True
        assert fdc_data["india_ban_alerts"][0]["info"]["date"] == "2026-06-11"

        gemer_resp = client.post(
            "/api/check",
            json={"medicines": ["Gemer"]},
            headers=headers,
        )
        assert gemer_resp.status_code == 200
        gemer_data = gemer_resp.json()
        assert len(gemer_data["india_ban_alerts"]) == 1
        assert gemer_data["india_ban_alerts"][0]["info"]["heading"] == "STOPPED IN INDIA: NOT APPROVED"

        # Basket of Paracetamol and Amoxicillin as separate medicines returns empty alerts
        safe_resp = client.post(
            "/api/check",
            json={"medicines": ["Paracetamol", "Amoxicillin"]},
            headers=headers,
        )
        assert safe_resp.status_code == 200
        assert safe_resp.json()["india_ban_alerts"] == []

        # Separate basket items must never be combined to match an FDC entry
        sep_resp = client.post(
            "/api/check",
            json={"medicines": ["Amoxicillin", "Serratiopeptidase"]},
            headers=headers,
        )
        assert sep_resp.status_code == 200
        assert sep_resp.json()["india_ban_alerts"] == []


def test_api_medicine_profile_sets_india_ban():
    headers = make_auth_headers("prof_ban")

    with patch("services.openfda.fetch_drug_label", new=AsyncMock(return_value=None)):
        diclo_resp = client.get("/api/medicine/Diclofenac/profile", headers=headers)
        assert diclo_resp.status_code == 200
        diclo_data = diclo_resp.json()
        assert diclo_data["india_ban"]["matched"] is True
        assert diclo_data["india_ban"]["qualified"] is True

        para_resp = client.get("/api/medicine/Paracetamol/profile", headers=headers)
        assert para_resp.status_code == 200
        assert para_resp.json()["india_ban"] is None


def test_api_medicine_profile_fallback_for_non_curated_and_regression_probes():
    headers = make_auth_headers("prof_fallback")

    async def fake_openfda_label(drug_name: str):
        key = (drug_name or "").lower().strip()
        # Simulate real OpenFDA mismatch where Phenacetin resolves to an unrelated generic name
        if key == "phenacetin":
            return {
                "generic_name": "homeopathic liquid",
                "brand_names": ["phenacetin homeopathic"],
                "substance_names": ["phenacetin"],
                "product_types": [],
                "pharm_class_cs": None,
                "is_rx": None,
                "dosage_forms": ["Liquid"],
                "warnings": [],
                "boxed_warnings": [],
                "drug_interactions": [],
                "adverse_reactions": [],
                "food_interactions": [],
                "contraindications": [],
                "precautions": [],
                "raw_text_summary": "Homeopathic preparation.",
                "found": True,
            }
        # Simulate OpenFDA returning only a single constituent for a slash-separated combo
        if "amoxicillin" in key and "serratiopeptidase" in key:
            return {
                "generic_name": "amoxicillin",
                "brand_names": [],
                "substance_names": ["amoxicillin"],
                "product_types": ["HUMAN PRESCRIPTION DRUG"],
                "pharm_class_cs": None,
                "is_rx": True,
                "dosage_forms": ["Capsule"],
                "warnings": [],
                "boxed_warnings": [],
                "drug_interactions": [],
                "adverse_reactions": [],
                "food_interactions": [],
                "contraindications": [],
                "precautions": [],
                "raw_text_summary": "Amoxicillin capsule.",
                "found": True,
            }
        return None

    with patch("main.get_cached_drug_detail", new=AsyncMock(return_value=None)), \
         patch("main.save_drug_detail_to_cache", new=AsyncMock(return_value=None)), \
         patch("main.fetch_drug_label", new=fake_openfda_label):
        # 1. Phenacetin (OpenFDA-built profile with unrelated generic_name)
        phen_resp = client.get("/api/medicine/Phenacetin/profile", headers=headers)
        assert phen_resp.status_code == 200
        phen_data = phen_resp.json()
        assert phen_data["data_source"] == "openfda_live"
        assert phen_data["india_ban"] is not None
        assert phen_data["india_ban"]["matched"] is True
        assert phen_data["india_ban"]["heading"] == "BANNED IN INDIA"
        assert phen_data["india_ban"]["entry_name"] == "Phenacetin"
        assert phen_data["india_ban"]["notification"] == "GSR 578(E) 23.07.1983"
        assert phen_data["india_ban"]["date"] == "1983-07-23"
        assert phen_data["india_ban"]["status"] == "Prohibited"
        assert phen_data["india_ban"]["qualified"] is False
        assert phen_data["india_ban"]["source"]

        # Parenthetical alternate name normalization via normalize_drug_query
        phen_paren_resp = client.get("/api/medicine/Phenacetin%20(Acetaminophen)/profile", headers=headers)
        assert phen_paren_resp.status_code == 200
        phen_paren_ban = phen_paren_resp.json()["india_ban"]
        assert phen_paren_ban is not None
        assert phen_paren_ban["entry_name"] == "Phenacetin"
        assert phen_paren_ban["notification"] == "GSR 578(E) 23.07.1983"

        # 2. Combination typed with '+' or '/' -> June 2026 FDC entry
        fdc_resp = client.get("/api/medicine/Amoxicillin%20%2B%20Serratiopeptidase/profile", headers=headers)
        assert fdc_resp.status_code == 200
        fdc_ban = fdc_resp.json()["india_ban"]
        assert fdc_ban is not None
        assert fdc_ban["matched"] is True
        assert fdc_ban["heading"] == "BANNED IN INDIA"
        assert fdc_ban["entry_name"] == "Amoxicillin + Serratiopeptidase"
        assert fdc_ban["date"] == "2026-06-11"
        assert fdc_ban["status"] == "Prohibited"

        fdc_slash_resp = client.get("/api/medicine/Amoxicillin%20%2F%20Serratiopeptidase/profile", headers=headers)
        assert fdc_slash_resp.status_code == 200
        fdc_slash_ban = fdc_slash_resp.json()["india_ban"]
        assert fdc_slash_ban is not None
        assert fdc_slash_ban["entry_name"] == "Amoxicillin + Serratiopeptidase"
        assert fdc_slash_ban["date"] == "2026-06-11"

        # 3. Paracetamol -> safe medicine, must remain null
        para_resp = client.get("/api/medicine/Paracetamol/profile", headers=headers)
        assert para_resp.status_code == 200
        assert para_resp.json()["india_ban"] is None

        # 4. Gemer -> curated FDC still returns exact April 2025 entry
        gemer_resp = client.get("/api/medicine/Gemer/profile", headers=headers)
        assert gemer_resp.status_code == 200
        gemer_ban = gemer_resp.json()["india_ban"]
        assert gemer_ban is not None
        assert gemer_ban["matched"] is True
        assert gemer_ban["heading"] == "STOPPED IN INDIA: NOT APPROVED"
        assert gemer_ban["entry_name"] == "Glimepiride 1mg + Metformin Hydrochloride 500mg (tablet)"
        assert gemer_ban["date"] == "2025-04-11"
        assert gemer_ban["notification"] == "CDSCO circular F. No. 4-01/2023-DC (Misc. 3), April 2025"
        assert gemer_ban["status"].startswith("Unapproved FDC")

        # 5. Nimesulide -> qualified heading & children-below-12 scope preserved
        nime_resp = client.get("/api/medicine/Nimesulide/profile", headers=headers)
        assert nime_resp.status_code == 200
        nime_ban = nime_resp.json()["india_ban"]
        assert nime_ban is not None
        assert nime_ban["matched"] is True
        assert nime_ban["qualified"] is True
        assert nime_ban["heading"] == "BANNED IN INDIA IN THIS CASE"
        assert nime_ban["heading"] != "BANNED IN INDIA"
        assert "children below 12 years" in nime_ban["entry_name"].lower()
        assert nime_ban["notification"] == "GSR 82(E) 10.02.2011"

        # 6. Warfarin -> safe medicine, must remain null
        warf_resp = client.get("/api/medicine/Warfarin/profile", headers=headers)
        assert warf_resp.status_code == 200
        assert warf_resp.json()["india_ban"] is None

        # 7. Non-Prohibited statuses keep exact official wording (never flattened)
        stayed_resp = client.get("/api/medicine/Phenylpropanolamine/profile", headers=headers)
        assert stayed_resp.status_code == 200
        stayed_ban = stayed_resp.json()["india_ban"]
        assert stayed_ban is not None
        assert stayed_ban["heading"] == "INDIA REGULATORY STATUS"
        assert "stayed" in stayed_ban["status"].lower()

        revoked_resp = client.get("/api/medicine/Dextropropoxyphene/profile", headers=headers)
        assert revoked_resp.status_code == 200
        revoked_ban = revoked_resp.json()["india_ban"]
        assert revoked_ban is not None
        assert revoked_ban["heading"] == "BAN CANCELLED BY COURT"
        assert "revoked" in revoked_ban["status"].lower()

        quashed_resp = client.get("/api/medicine/Aceclofenac%20%2B%20Paracetamol%20%2B%20Rabeprazole/profile", headers=headers)
        assert quashed_resp.status_code == 200
        quashed_ban = quashed_resp.json()["india_ban"]
        assert quashed_ban is not None
        assert quashed_ban["heading"] == "BAN CANCELLED BY COURT"
        assert "quashed" in quashed_ban["status"].lower()

    # Phenacetin also works when OpenFDA finds nothing (unknown_fallback)
    with patch("main.get_cached_drug_detail", new=AsyncMock(return_value=None)), \
         patch("main.fetch_drug_label", new=AsyncMock(return_value=None)):
        phen_unk = client.get("/api/medicine/Phenacetin/profile", headers=headers)
        assert phen_unk.status_code == 200
        phen_unk_data = phen_unk.json()
        assert phen_unk_data["data_source"] == "unknown_fallback"
        assert phen_unk_data["india_ban"]["heading"] == "BANNED IN INDIA"
        assert phen_unk_data["india_ban"]["notification"] == "GSR 578(E) 23.07.1983"


def test_api_india_banned_search_endpoint():
    # Requires auth
    unauth = client.get("/api/india/banned?query=serratiopeptidase")
    assert unauth.status_code == 401

    # Guest token works
    guest = client.post("/api/auth/guest")
    assert guest.status_code == 200
    headers = {"Authorization": f"Bearer {guest.json()['access_token']}"}

    resp = client.get("/api/india/banned?query=serratiopeptidase", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert len(data["results"]) >= 1
    assert any((item.get("date") or "").startswith("2026") for item in data["results"])

    # Empty query returns first limit Prohibited entries
    empty_resp = client.get("/api/india/banned?query=&limit=10", headers=headers)
    assert empty_resp.status_code == 200
    empty_data = empty_resp.json()
    assert empty_data["total"] == 662
    assert len(empty_data["results"]) == 10
    assert all(item["status"] == "Prohibited" for item in empty_data["results"])
