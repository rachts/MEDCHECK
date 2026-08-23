from enum import Enum
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

# ==============================================================================
# ENUMS
# ==============================================================================

class Severity(str, Enum):
    HIGH = "high"
    MODERATE = "moderate"
    LOW = "low"
    NONE = "none"

class Frequency(str, Enum):
    VERY_COMMON = "very_common"
    COMMON = "common"
    UNCOMMON = "uncommon"
    RARE = "rare"

class DrugType(str, Enum):
    PRESCRIPTION = "prescription"
    OTC = "otc"
    SUPPLEMENT = "supplement"
    SUBSTANCE = "substance"
    LIFESTYLE = "lifestyle_factor"
    UNKNOWN = "unknown"

class RiskTier(str, Enum):
    GENTLE = "gentle"
    MODERATE = "moderate"
    HIGH = "high"
    UNKNOWN = "unknown"

class RuleConfidence(str, Enum):
    ESTABLISHED = "established"
    THEORETICAL = "theoretical"
    CASE_REPORT = "case_report"

# ==============================================================================
# AUTH MODELS
# ==============================================================================

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_\-\.]+$")
    password: str = Field(..., min_length=6, max_length=100)
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    is_guest: bool = False

class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    is_guest: bool = False

# ==============================================================================
# CLINICAL REQUEST & RESPONSE MODELS
# ==============================================================================

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
        cleaned = []
        seen = set()
        for raw in v:
            if not raw or not raw.strip():
                continue
            trimmed = raw.strip()
            if len(trimmed) > 100:
                raise ValueError(f"Medicine name '{trimmed[:30]}...' exceeds maximum allowed length of 100 characters.")
            
            # Sanitization regex: allow alphanumeric, whitespace, hyphens, dots, slashes, and parentheses
            import re
            if not re.match(r"^[a-zA-Z0-9\s\-\.\/\(\)]+$", trimmed):
                raise ValueError(f"Invalid characters detected in medicine name '{trimmed}'. Only letters, numbers, hyphens, and dots are permitted.")
            
            norm = trimmed.lower()
            if norm not in seen:
                seen.add(norm)
                cleaned.append(trimmed)

        if len(cleaned) < 1:
            raise ValueError("At least 1 valid medicine name is required.")
        if len(cleaned) > 20:
            raise ValueError("A maximum of 20 medicines can be checked simultaneously to ensure deterministic clinical performance.")
        return cleaned

class InteractionItem(BaseModel):
    drug_a: str
    drug_b: str
    severity: Severity = Field(..., description="High, moderate, low, or none")
    explanation: str
    mechanism: Optional[str] = None
    clinical_impact: Optional[str] = None
    stomach_impact: Optional[str] = None
    food_consideration: Optional[str] = None
    action_guidance: Optional[str] = None
    evidence_source: Optional[str] = None
    confidence: Optional[RuleConfidence] = RuleConfidence.ESTABLISHED
    last_reviewed: Optional[str] = "2026-08-23"

class SideEffectDetail(BaseModel):
    effect: str
    frequency: Frequency = Field(..., description="very_common, common, uncommon, rare")
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
    risk_tier: RiskTier = Field(RiskTier.GENTLE, description="'gentle', 'moderate', 'high', 'unknown'")
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
    drug_type: DrugType = Field(DrugType.OTC, description="'prescription', 'otc', 'supplement', 'substance', 'unknown'")
    dosage_forms: List[str] = ["Oral Tablet"]
    description: str = ""
    side_effects: List[SideEffectDetail] = []
    food_interactions: List[FoodInteractionDetail] = []
    gi_profile: GIProfile
    lifestyle_warnings: List[str] = []
    data_source: Literal["curated_kb", "openfda_live", "openfda_ai_parsed", "unknown_fallback"] = "curated_kb"
    disclaimer: Optional[str] = None

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
    brand_context: Optional[str] = None

class ParsedDrugInfo(BaseModel):
    generic_name: str
    brand_names: List[str] = []
    side_effects: List[str] = []
    food_warnings: List[str] = []
    drug_interactions: List[str] = []
    severity: str = "moderate"
    raw_text: Optional[str] = None

class DrugLabelResult(BaseModel):
    generic_name: str
    brand_names: List[str] = []
    substance_names: List[str] = []
    raw_text_summary: str = ""
    found: bool = False
    source: Literal["cache", "openfda", "fallback", "curated"] = "fallback"

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
    limited_data_warnings: List[str] = []
