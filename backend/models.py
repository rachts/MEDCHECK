import re
from enum import Enum
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, field_validator

# Permitted characters in a medicine name: letters, digits, whitespace,
# hyphens, dots, slashes and parentheses.
MEDICINE_NAME_RE = re.compile(r"^[a-zA-Z0-9\s\-\.\/\(\)]+$")

# Pragmatic RFC-5322 subset. Deliberately a local regex rather than
# pydantic's EmailStr, which would pull in the email-validator dependency.
EMAIL_RE = re.compile(r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~\-]+"
                      r"(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~\-]+)*"
                      r"@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+"
                      r"[A-Za-z]{2,63}$")

# "7:00 AM" / "07:00 am" (12-hour) or "07:00" / "23:30" (24-hour).
WAKE_TIME_12H_RE = re.compile(r"^(0?[1-9]|1[0-2]):[0-5][0-9]\s?[APap][Mm]$")
WAKE_TIME_24H_RE = re.compile(r"^([01][0-9]|2[0-3]):[0-5][0-9]$")

MIN_PASSWORD_LENGTH = 8
# bcrypt silently truncates beyond 72 bytes, so refuse longer inputs outright
# rather than accepting a password whose tail is ignored.
MAX_PASSWORD_LENGTH = 72

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
    password: str = Field(
        ...,
        min_length=MIN_PASSWORD_LENGTH,
        max_length=MAX_PASSWORD_LENGTH,
        description=(
            f"Minimum {MIN_PASSWORD_LENGTH} characters, including at least one "
            f"uppercase letter, one lowercase letter and one digit. "
            f"Maximum {MAX_PASSWORD_LENGTH} bytes (bcrypt limit)."
        )
    )
    email: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v.encode("utf-8")) > MAX_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must not exceed {MAX_PASSWORD_LENGTH} bytes."
            )
        missing = []
        if not any(c.isupper() for c in v):
            missing.append("an uppercase letter")
        if not any(c.islower() for c in v):
            missing.append("a lowercase letter")
        if not any(c.isdigit() for c in v):
            missing.append("a digit")
        if missing:
            raise ValueError("Password must contain " + ", ".join(missing) + ".")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        # The email field is optional; the client sends "" when left blank.
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            return None
        if len(trimmed) > 254:
            raise ValueError("Email address exceeds the maximum length of 254 characters.")
        if not EMAIL_RE.match(trimmed):
            raise ValueError("Email address is not a valid address.")
        return trimmed.lower()

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

class ClientErrorReport(BaseModel):
    """
    Bounded schema for browser-reported UI exceptions. Both fields are truncated
    and stripped of control characters before they reach the log sink so that a
    hostile client cannot forge log lines or flood the log with a large payload.
    """
    error: str = Field(..., min_length=1, max_length=500)
    stack: str = Field("", max_length=4000)

    @field_validator("error", "stack")
    @classmethod
    def strip_control_characters(cls, v: str) -> str:
        # Newlines and carriage returns permit log-injection; tabs and other C0
        # control codes can corrupt structured log consumers.
        return "".join(" " if c in "\r\n\t" else c for c in v if c.isprintable() or c in "\r\n\t").strip()

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
    patient_wake_time: Optional[str] = Field(
        None,
        max_length=10,
        description="Patient wake time as '07:00 AM' (12-hour) or '07:00' (24-hour). "
                    "Anchors the generated 24-hour administration timeline."
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

            # Sanitization: allow alphanumeric, whitespace, hyphens, dots, slashes, and parentheses
            if not MEDICINE_NAME_RE.match(trimmed):
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

    @field_validator("patient_wake_time")
    @classmethod
    def validate_wake_time(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            return None
        if WAKE_TIME_12H_RE.match(trimmed):
            return trimmed.upper()
        if WAKE_TIME_24H_RE.match(trimmed):
            return trimmed
        raise ValueError(
            "patient_wake_time must be formatted as '07:00 AM' (12-hour) or '07:00' (24-hour)."
        )


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
    category_tags: List[str] = Field(
        default_factory=list,
        description="Stable machine-readable therapeutic-class slugs (e.g. 'nsaid', "
                    "'cardio', 'diabetes', 'gi', 'antibiotic') for client-side filtering."
    )


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
