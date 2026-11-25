import pytest
from unittest.mock import patch

@pytest.fixture(autouse=True)
def stub_openfda_for_unknown_compounds(monkeypatch):
    """
    Ensures test suites run deterministically offline by immediately returning None
    for fictitious test compounds (e.g. CompoundX999) without waiting for network timeouts.
    """
    from services import openfda
    original_fetch = openfda.fetch_drug_label

    async def mock_fetch_drug_label(drug_name: str):
        clean = (drug_name or "").lower().strip()
        if "compound" in clean or "unknown" in clean:
            return None
        return await original_fetch(drug_name)

    monkeypatch.setattr(openfda, "fetch_drug_label", mock_fetch_drug_label)
