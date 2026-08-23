from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

class CheckRequest(BaseModel):
    medicines: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="List of 1 to 20 medicine names to analyze"
    )

    @field_validator("medicines")
    @classmethod
    def validate_medicines(cls, v: List[str]) -> List[str]:
        cleaned = [m.strip().lower() for m in v if m and m.strip()]
        seen = set()
        deduped = []
        for m in cleaned:
            if m not in seen:
                seen.add(m)
                deduped.append(m)
        if len(deduped) < 1:
            raise ValueError("At least 1 medicine name is required.")
        if len(deduped) > 20:
            raise ValueError("A maximum of 20 medicines can be checked simultaneously to prevent performance degradation.")
        return deduped

class InteractionItem(BaseModel):
    drug_a: str
    drug_b: str
    severity: str = Field(..., description="'high', 'moderate', 'low', or 'none'")
    explanation: str
    mechanism: Optional[str] = None
    clinical_impact: Optional[str] = None
    stomach_impact: Optional[str] = None
    food_consideration: Optional[str] = None
    action_guidance: Optional[str] = None

class SideEffectDetail(BaseModel):
    effect: str
    frequency: str = Field(..., description="'very_common', 'common', 'uncommon', 'rare'")
    frequency_percentage: str = Field("1-10%", description="e.g. '>10%', '1-10%', '0.1-1%', '<0.1%'")
    severity: str = Field("mild", description="'mild', 'moderate', 'severe'")
    category: str = "General"
    is_amplified: bool = False

class FoodInteractionDetail(BaseModel):
    type: str = Field(..., description="'take_with_food', 'empty_stomach', 'avoid_alcohol', 'avoid_grapefruit', 'avoid_dairy_2h', 'hydration'")
    title: str
    description: str
    severity: str = Field("recommended", description="'recommended', 'warning', 'critical'")
    icon: str = "meal"

class GIProfile(BaseModel):
    stomach_health_score: int = Field(20, description="0-100 GI stress score, higher means higher stomach risk")
    risk_tier: str = Field("gentle", description="'gentle', 'moderate', 'high'")
    nausea_risk: str = "low"
    ulcer_risk: str = "low"
    bleeding_risk: str = "none"
    reflux_aggravation: bool = False
    constipation_diarrhea: str = "none"
    recommendations: List[str] = []

class MedicineProfileResponse(BaseModel):
    name: str
    generic_name: str
    brand_names: List[str] = []
    category: str = "General Medication"
    drug_type: str = Field("otc", description="'prescription', 'otc', 'supplement'")
    dosage_forms: List[str] = ["Oral Tablet"]
    description: str = ""
    side_effects: List[SideEffectDetail] = []
    food_interactions: List[FoodInteractionDetail] = []
    gi_profile: GIProfile
    lifestyle_warnings: List[str] = []

class FoodConflictDetail(BaseModel):
    medicine_a: str
    medicine_b: str
    conflict_type: str
    conflict: str
    recommended_schedule: str

class TimelineSlot(BaseModel):
    time: str
    title: str
    medicine: Optional[str] = None
    action_type: str = Field("meal", description="'med_empty_stomach', 'meal', 'med_with_food', 'dairy_restriction', 'bedtime_med'")
    icon: str = "utensils"
    note: str

class AmplifiedSideEffect(BaseModel):
    effect: str
    sources: List[str]
    severity: str = "moderate"
    amplified: bool = True
    clinical_note: str

class MedicineSearchResult(BaseModel):
    name: str
    generic_name: str
    category: str
    drug_type: str = "otc"
    stomach_risk_badge: str = "Gentle"
    stomach_score: int = 20
    top_side_effects: List[str] = []
    food_warning_count: int = 0

class ParsedDrugInfo(BaseModel):
    generic_name: str
    brand_names: List[str] = []
    side_effects: List[str] = []
    food_warnings: List[str] = []
    drug_interactions: List[str] = []
    severity: str = "low"
    raw_text: Optional[str] = None

class CheckResponse(BaseModel):
    medicines: List[str]
    interactions: List[InteractionItem]
    safe: bool
    summary: Optional[str] = None
    analyzed_pairs_count: int = 0
    composite_gi_score: int = 20
    composite_gi_tier: str = "gentle"
    composite_gi_contributors: List[Dict[str, Any]] = []
    composite_gi_recommendations: List[str] = []
    food_conflicts: List[FoodConflictDetail] = []
    daily_food_timeline: List[TimelineSlot] = []
    aggregated_side_effects: List[AmplifiedSideEffect] = []
    profiles: Dict[str, MedicineProfileResponse] = {}
