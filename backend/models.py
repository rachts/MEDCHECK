from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

class CheckRequest(BaseModel):
    medicines: List[str] = Field(..., min_length=1, description="List of medicine names to check")

    @field_validator("medicines")
    @classmethod
    def validate_medicines(cls, v: List[str]) -> List[str]:
        cleaned = [m.strip().lower() for m in v if m and m.strip()]
        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for m in cleaned:
            if m not in seen:
                seen.add(m)
                deduped.append(m)
        if len(deduped) < 2:
            raise ValueError("At least 2 unique medicine names are required to check for interactions.")
        return deduped

class InteractionItem(BaseModel):
    drug_a: str
    drug_b: str
    severity: str = Field(..., description="'high', 'moderate', 'low', or 'none'")
    explanation: str

class CheckResponse(BaseModel):
    medicines: List[str]
    interactions: List[InteractionItem]
    safe: bool
    summary: Optional[str] = None
    analyzed_pairs_count: int = 0

class ParsedDrugInfo(BaseModel):
    generic_name: str
    brand_names: List[str] = []
    side_effects: List[str] = []
    food_warnings: List[str] = []
    drug_interactions: List[str] = []
    severity: str = "low"
    raw_text: Optional[str] = None
