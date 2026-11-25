import gzip
import json
import os
import shutil
import sqlite3
import sys
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config import settings
from main import app
import main as main_module
from models import DrugLabelResult
from services import groq_client, india_catalogue
from services.auth import create_access_token
from services.india_catalogue import (
    catalogue_search_key,
    catalogue_stats,
    match_product_for_chat,
    search_catalogue,
)
from services.medicine_chat import CATALOGUE_DISCLAIMER, build_catalogue_answer

client = TestClient(app)


def make_auth_headers(prefix: str = "cat_test") -> dict:
    uid = f"{prefix}_{uuid.uuid4().hex[:8]}"
    token = create_access_token({"sub": uid, "uid": uid, "is_guest": False})
    return {"Authorization": f"Bearer {token}"}


def _create_fixture_catalogue_db(db_path) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.executescript(
        """
        CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            search_key TEXT NOT NULL UNIQUE,
            substitutes TEXT NOT NULL DEFAULT '[]',
            side_effects TEXT NOT NULL DEFAULT '[]',
            no_common_side_effects INTEGER NOT NULL DEFAULT 0,
            uses TEXT NOT NULL DEFAULT '[]',
            chemical_class TEXT,
            habit_forming INTEGER NOT NULL DEFAULT 0,
            therapeutic_class TEXT,
            action_class TEXT
        );
        CREATE INDEX idx_products_search_key ON products(search_key);
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
        """
    )

    products = [
        (
            "telma 40 tablet",
            "telma 40 tablet",
            json.dumps(["Telmisoft 40 Tablet", "Telmizem 40 Tablet"]),
            json.dumps(["Upper respiratory tract infection", "Back pain", "Dizziness"]),
            0,
            json.dumps(["Treatment of Hypertension (high blood pressure)"]),
            "Benzimidazole derivative",
            0,
            "CARDIAC",
            "Angiotensin receptor blockers(ARB)",
        ),
        (
            "telma 80 tablet",
            "telma 80 tablet",
            json.dumps(["Telmikind 80 Tablet"]),
            json.dumps(["Dizziness"]),
            0,
            json.dumps(["Treatment of Hypertension (high blood pressure)"]),
            "NA",
            0,
            "CARDIAC",
            "NA",
        ),
        (
            "cartelma tablet",
            "cartelma tablet",
            json.dumps([]),
            json.dumps(["Fatigue"]),
            0,
            json.dumps(["Hypertension"]),
            "NA",
            0,
            "CARDIAC",
            "NA",
        ),
        (
            "dolo 650 tablet",
            "dolo 650 tablet",
            json.dumps(["Calpol 650 Tablet"]),
            json.dumps(["Nausea"]),
            0,
            json.dumps(["Pain relief", "Fever"]),
            "Anilide",
            0,
            "PAIN ANALGESICS",
            "Analgesics",
        ),
        (
            "phenacetin tablet",
            "phenacetin tablet",
            json.dumps([]),
            json.dumps(["Kidney irritation", "Headache"]),
            0,
            json.dumps(["Pain relief"]),
            "Anilide",
            0,
            "PAIN ANALGESICS",
            "Analgesics",
        ),
        (
            "calmfast syrup",
            "calmfast syrup",
            json.dumps(["Serenex Syrup"]),
            json.dumps([]),
            1,
            json.dumps(["Short-term anxiety relief"]),
            "Benzodiazepine",
            1,
            "NEURO CNS",
            "Benzodiazepines",
        ),
        (
            "calpol",
            "calpol",
            json.dumps([]),
            json.dumps([]),
            0,
            json.dumps(["Fever"]),
            None,
            0,
            "PAIN ANALGESICS",
            None,
        ),
        (
            "calpol 500mg tablet",
            "calpol 500mg tablet",
            json.dumps([]),
            json.dumps([]),
            0,
            json.dumps(["Fever"]),
            None,
            0,
            "PAIN ANALGESICS",
            None,
        ),
        (
            "bcalpol",
            "bcalpol",
            json.dumps([]),
            json.dumps([]),
            0,
            json.dumps(["Fever"]),
            None,
            0,
            "PAIN ANALGESICS",
            None,
        ),
        (
            "ambroxol tablet",
            "ambroxol tablet",
            json.dumps([]),
            json.dumps([]),
            0,
            json.dumps(["Cough"]),
            None,
            0,
            "RESPIRATORY",
            None,
        ),
        (
            "ambroxol syrup",
            "ambroxol syrup",
            json.dumps([]),
            json.dumps([]),
            0,
            json.dumps(["Cough"]),
            None,
            0,
            "RESPIRATORY",
            None,
        ),
    ]

    conn.executemany(
        """
        INSERT INTO products (
            name, search_key, substitutes, side_effects,
            no_common_side_effects, uses, chemical_class,
            habit_forming, therapeutic_class, action_class
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        products,
    )
    conn.executemany(
        "INSERT INTO meta (key, value) VALUES (?, ?)",
        [("source_file", "fixture"), ("products_after_dedupe", str(len(products)))],
    )
    conn.commit()
    conn.close()


@pytest.fixture()
def fixture_catalogue_db(tmp_path, monkeypatch):
    db_path = tmp_path / "india_medicines.sqlite"
    _create_fixture_catalogue_db(db_path)
    monkeypatch.setattr(india_catalogue, "_DATA_PATH", str(db_path))
    return db_path


def test_catalogue_search_key_normalization():
    assert catalogue_search_key("Telma-AM 40mg Tablet!") == "telma am 40mg tablet"
    assert catalogue_search_key("   ") == ""
    assert catalogue_search_key("") == ""


def test_search_catalogue_ranking_limit_and_empty(fixture_catalogue_db):
    # Exact beats prefix beats substring (even when substring 'bcalpol' is shorter than prefix 'calpol 500mg tablet')
    ranked = search_catalogue("calpol", limit=10)
    assert [p.name for p in ranked] == ["calpol", "calpol 500mg tablet", "bcalpol"]

    # Prefix ('telma 40 tablet', 'telma 80 tablet') beats substring ('cartelma tablet')
    telma_ranked = search_catalogue("telma", limit=10)
    assert [p.name for p in telma_ranked] == ["telma 40 tablet", "telma 80 tablet", "cartelma tablet"]

    # Limit respected and no duplicates
    limited = search_catalogue("telma", limit=2)
    assert [p.name for p in limited] == ["telma 40 tablet", "telma 80 tablet"]

    # Empty / blank / punctuation-only queries return []
    assert search_catalogue("") == []
    assert search_catalogue("   ") == []
    assert search_catalogue("---!") == []


def test_match_product_for_chat(fixture_catalogue_db):
    # Single form-word match: "Telma 40" -> "telma 40 tablet"
    telma40 = match_product_for_chat("Telma 40")
    assert telma40 is not None
    assert telma40.name == "telma 40 tablet"
    assert telma40.habit_forming is False
    assert telma40.no_common_side_effects is False

    # Ambiguous / non-unique form match returns None
    assert match_product_for_chat("telma") is None
    assert match_product_for_chat("ambroxol") is None

    # Exact full name matches
    exact = match_product_for_chat("telma 40 tablet")
    assert exact is not None
    assert exact.name == "telma 40 tablet"

    # Habit-forming syrup matched by single form word
    calm = match_product_for_chat("Calmfast")
    assert calm is not None
    assert calm.name == "calmfast syrup"
    assert calm.habit_forming is True
    assert calm.no_common_side_effects is True

    # Unknown returns None
    assert match_product_for_chat("UnknownNonExistentMed") is None


def test_catalogue_stats_and_na_cleanup(fixture_catalogue_db):
    stats = catalogue_stats()
    assert stats["product_count"] == 11
    assert stats["meta"]["source_file"] == "fixture"

    telma80 = match_product_for_chat("telma 80 tablet")
    assert telma80 is not None
    assert telma80.chemical_class is None
    assert telma80.action_class is None
    assert telma80.therapeutic_class == "CARDIAC"


def test_build_catalogue_answer_formatting(fixture_catalogue_db):
    calm = match_product_for_chat("calmfast syrup")
    assert calm is not None

    initial = build_catalogue_answer(calm)
    assert "\u2014" not in initial
    assert "What it is:" in initial
    assert "What it is used for:" in initial
    assert "Common side effects:" in initial
    assert "The catalogue says no common side effects are usually seen for this medicine." in initial
    assert "Other brands with the same composition:" in initial
    assert "Caution: this medicine can be habit forming. Take it only as your doctor says." in initial
    assert initial.endswith("For your own treatment, please ask your doctor or pharmacist.")
    assert not initial.startswith("The catalogue holds basic information only.")

    followup = build_catalogue_answer(calm, question="Can I take this daily?")
    assert followup.startswith(
        "The catalogue holds basic information only. It does not cover doses or "
        "interactions with other medicines. Here is everything it has for this medicine:"
    )


def test_api_catalogue_search_endpoint(fixture_catalogue_db):
    unauth = client.get("/api/india/catalogue/search?query=telma")
    assert unauth.status_code == 401

    headers = make_auth_headers("cat_ep")
    resp = client.get("/api/india/catalogue/search?query=telma&limit=2", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert [item["name"] for item in data["results"]] == ["telma 40 tablet", "telma 80 tablet"]

    empty = client.get("/api/india/catalogue/search?query=", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == {"total": 0, "results": []}


def test_api_chat_catalogue_match_initial_and_followup(fixture_catalogue_db, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    headers = make_auth_headers("cat_chat")

    resp = client.post(
        "/api/chat",
        json={"medicine": "Calmfast", "question": None},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False
    assert data["catalogue_match"] is True
    assert data["catalogue"]["name"] == "calmfast syrup"
    assert data["catalogue"]["habit_forming"] is True
    assert data["disclaimer"] == CATALOGUE_DISCLAIMER
    assert data["profile"] is None
    assert data["ai_fallback"] is False
    assert data["ai_available"] is False
    assert data["india_ban"] is None
    assert "Caution: this medicine can be habit forming" in data["answer"]

    followup = client.post(
        "/api/chat",
        json={"medicine": "Calmfast", "question": "Can I take this with coffee?"},
        headers=headers,
    )
    assert followup.status_code == 200
    fu_data = followup.json()
    assert fu_data["found"] is False
    assert fu_data["catalogue_match"] is True
    assert fu_data["catalogue"]["name"] == "calmfast syrup"
    assert fu_data["disclaimer"] == CATALOGUE_DISCLAIMER
    assert fu_data["profile"] is None
    assert fu_data["ai_fallback"] is False
    assert fu_data["answer"].startswith("The catalogue holds basic information only.")

    # When a brand maps in COMMON_BRAND_MAPPINGS (Telma 40 -> telmisartan) and OpenFDA has no label,
    # the unresolved branch still attaches the Indian medicines catalogue match.
    missing_label = DrugLabelResult(generic_name="telmisartan", found=False, source="fallback")
    with patch.object(main_module, "fetch_and_cache_single_drug", new=AsyncMock(return_value=missing_label)):
        telma_resp = client.post(
            "/api/chat",
            json={"medicine": "Telma 40", "question": None},
            headers=headers,
        )
    assert telma_resp.status_code == 200
    telma_data = telma_resp.json()
    assert telma_data["found"] is False
    assert telma_data["catalogue_match"] is True
    assert telma_data["catalogue"]["name"] == "telma 40 tablet"
    assert telma_data["disclaimer"] == CATALOGUE_DISCLAIMER
    assert telma_data["profile"] is None
    assert telma_data["ai_fallback"] is False


def test_api_chat_phenacetin_tablet_returns_ban_and_catalogue(fixture_catalogue_db, monkeypatch):
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)
    resp = client.post(
        "/api/chat",
        json={"medicine": "phenacetin tablet", "question": None},
        headers=make_auth_headers("cat_phen"),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is False
    assert data["catalogue_match"] is True
    assert data["catalogue"]["name"] == "phenacetin tablet"
    assert data["disclaimer"] == CATALOGUE_DISCLAIMER
    assert data["profile"] is None
    assert data["ai_fallback"] is False
    assert data["india_ban"] is not None
    assert data["india_ban"]["matched"] is True
    assert data["india_ban"]["entry_name"] == "Phenacetin"


def test_missing_catalogue_db_returns_empty_and_falls_back_cleanly(tmp_path, monkeypatch):
    missing_path = str(tmp_path / "does_not_exist.sqlite")
    monkeypatch.setattr(india_catalogue, "_DATA_PATH", missing_path)
    monkeypatch.setattr(settings, "GROQ_API_KEY", None)

    assert search_catalogue("telma") == []
    assert match_product_for_chat("Telma 40") is None
    assert catalogue_stats() == {"product_count": 0, "meta": {}}

    headers = make_auth_headers("cat_miss")
    search_resp = client.get("/api/india/catalogue/search?query=telma", headers=headers)
    assert search_resp.status_code == 200
    assert search_resp.json() == {"total": 0, "results": []}

    chat_resp = client.post(
        "/api/chat",
        json={"medicine": "Calmfast", "question": None},
        headers=headers,
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["found"] is False
    assert chat_data["catalogue_match"] is False
    assert chat_data["catalogue"] is None
    assert chat_data["ai_fallback"] is False
    assert "not found" in (chat_data["message"] or "").lower()


def test_regression_chat_dolo_650_returns_clinical_profile(fixture_catalogue_db):
    with patch.object(groq_client, "call_groq_api", new=AsyncMock(return_value=None)):
        resp = client.post(
            "/api/chat",
            json={"medicine": "Dolo 650", "question": None},
            headers=make_auth_headers("cat_dolo"),
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] is True
    assert data["medicine"] == "Paracetamol"
    assert data["profile"]["generic_name"] == "paracetamol"
    assert data["catalogue_match"] is False
    assert data["catalogue"] is None


def test_catalogue_bootstraps_from_gz_only(tmp_path, monkeypatch):
    db_path = tmp_path / "india_medicines.sqlite"
    gz_path = tmp_path / "india_medicines.sqlite.gz"
    seed_path = tmp_path / "seed.sqlite"

    _create_fixture_catalogue_db(seed_path)
    with open(seed_path, "rb") as src, gzip.open(gz_path, "wb") as dst:
        shutil.copyfileobj(src, dst)
    seed_path.unlink()

    assert not db_path.exists()
    assert gz_path.is_file()

    monkeypatch.setattr(india_catalogue, "_DATA_PATH", str(db_path))

    results = search_catalogue("telma", limit=10)
    assert [p.name for p in results] == ["telma 40 tablet", "telma 80 tablet", "cartelma tablet"]
    assert db_path.is_file()
    assert {p.name for p in tmp_path.iterdir()} == {
        "india_medicines.sqlite",
        "india_medicines.sqlite.gz",
    }


def test_catalogue_corrupt_gz_returns_empty_without_raising(tmp_path, monkeypatch):
    db_path = tmp_path / "india_medicines.sqlite"
    gz_path = tmp_path / "india_medicines.sqlite.gz"
    gz_path.write_bytes(bytes(range(256)))

    assert not db_path.exists()
    monkeypatch.setattr(india_catalogue, "_DATA_PATH", str(db_path))

    with patch.object(india_catalogue.gzip, "open", wraps=india_catalogue.gzip.open) as spy_gzip_open:
        assert search_catalogue("telma") == []
        assert match_product_for_chat("Telma 40") is None
        assert catalogue_stats() == {"product_count": 0, "meta": {}}
        assert spy_gzip_open.call_count == 1

    assert not db_path.exists()
    assert {p.name for p in tmp_path.iterdir()} == {"india_medicines.sqlite.gz"}
