from typing import List, Dict, Any, Tuple, Optional
import logging
from datetime import datetime, timedelta
from models import (
    MedicineProfileResponse,
    FoodConflictDetail,
    TimelineSlot
)
from services.clinical_rules import expand_aliases

logger = logging.getLogger("timeline_engine")

DEFAULT_WAKE_TIME = "07:00 AM"


def _parse_wake_time(base_time_str: str) -> Optional[datetime]:
    """
    Parses a wake time in either supported format, returning None if it cannot.

    Separated from offset arithmetic on purpose. Parsing used to happen inside
    the per-slot offset helper, whose bare `except: return "07:00 AM"` ran once
    per slot -- so an unparseable wake time did not fall back to a 7 AM-anchored
    schedule, it collapsed every slot to the literal string "07:00 AM". The
    timeline then presented fasting, breakfast, lunch, dinner and bedtime as all
    occurring at 7:00 AM, as a clinical dosing schedule, with nothing logged.

    Parsing once means the fallback is all-or-nothing and observable.
    """
    clean = (base_time_str or "").strip()
    if not clean:
        return None
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(clean, fmt)
        except ValueError:
            continue
    return None


def _resolve_wake_time(patient_wake_time: str) -> datetime:
    """
    Resolves the timeline anchor, logging when the requested value is unusable.

    The API layer validates patient_wake_time against WAKE_TIME_12H_RE /
    WAKE_TIME_24H_RE before it reaches this module, so a fallback here means
    either a direct in-process caller or a drift between that regex and these
    formats. Both are worth a warning rather than a silent substitution.
    """
    parsed = _parse_wake_time(patient_wake_time)
    if parsed is not None:
        return parsed
    logger.warning(
        f"Unparseable patient_wake_time {patient_wake_time!r}; anchoring the "
        f"timeline to the {DEFAULT_WAKE_TIME} default. Expected '07:00 AM' "
        f"(12-hour) or '07:00' (24-hour)."
    )
    # The module default is a literal that both formats accept, so this cannot
    # itself fail; asserting that keeps the return type non-Optional.
    fallback = _parse_wake_time(DEFAULT_WAKE_TIME)
    assert fallback is not None
    return fallback


def _offset_time_str(base_time: datetime, hour_offset: float) -> str:
    """Formats `base_time` shifted by `hour_offset` as e.g. '7:00 AM'."""
    adjusted = base_time + timedelta(hours=hour_offset)
    return adjusted.strftime("%I:%M %p").lstrip("0")


def generate_food_conflicts_and_timeline(
    medicines: List[str],
    profiles: Dict[str, MedicineProfileResponse],
    patient_wake_time: str = DEFAULT_WAKE_TIME
) -> Tuple[List[FoodConflictDetail], List[TimelineSlot]]:
    """
    Analyzes dietary instructions across all active medicines to detect timing/food conflicts
    and generates a patient-tailored 24-hour daily dosing schedule starting from their wake time.
    """
    # Resolved once, up front. Every slot below is offset from this single
    # anchor, so the schedule stays internally consistent even when the
    # requested wake time has to be rejected.
    wake_anchor = _resolve_wake_time(patient_wake_time)

    conflicts: List[FoodConflictDetail] = []
    timeline: List[TimelineSlot] = []

    has_empty_stomach_meds: List[str] = []
    has_with_food_meds: List[str] = []
    has_alcohol_risk_meds: List[str] = []
    has_dairy_calcium_block_meds: List[str] = []

    for med in medicines:
        profile = profiles.get(med)
        aliases = expand_aliases(med)

        if any(d in aliases for d in ["levothyroxine", "omeprazole", "esomeprazole", "pantoprazole", "alendronate", "ampicillin"]):
            has_empty_stomach_meds.append(med.capitalize())

        if any(d in aliases for d in ["ibuprofen", "aspirin", "naproxen", "metformin", "augmentin", "amoxicillin/clavulanate", "prednisone"]):
            has_with_food_meds.append(med.capitalize())

        if any(d in aliases for d in ["warfarin", "paracetamol", "metformin", "ibuprofen", "aspirin", "alprazolam", "diazepam"]):
            has_alcohol_risk_meds.append(med.capitalize())

        if any(d in aliases for d in ["levothyroxine", "ciprofloxacin", "doxycycline"]):
            has_dairy_calcium_block_meds.append(med.capitalize())

    # Build Conflicts
    if has_empty_stomach_meds and has_with_food_meds:
        for m_empty in has_empty_stomach_meds:
            for m_food in has_with_food_meds:
                conflicts.append(FoodConflictDetail(
                    medicine_a=m_empty,
                    medicine_b=m_food,
                    conflict_type="Meal Timing Conflict",
                    conflict=f"{m_empty} requires an empty stomach, whereas {m_food} requires food co-administration to prevent gastric distress.",
                    recommended_schedule=f"Take {m_empty} 30-60 min before breakfast; take {m_food} with or immediately after the meal."
                ))

    if has_dairy_calcium_block_meds:
        for m_dairy in has_dairy_calcium_block_meds:
            conflicts.append(FoodConflictDetail(
                medicine_a=m_dairy,
                medicine_b="Dairy / Calcium Supplements",
                conflict_type="Cation Chelation Block",
                conflict=f"Calcium and dairy products chelate {m_dairy} in the gastrointestinal tract, preventing systemic absorption.",
                recommended_schedule=f"Space all milk, yogurt, and calcium/iron supplements by at least 4 hours from {m_dairy}."
            ))

    # Dynamic Time Offsets from Patient Wake Time
    time_fast = _offset_time_str(wake_anchor, 0.0)      # e.g. 7:00 AM (Fast)
    time_breakfast = _offset_time_str(wake_anchor, 1.0) # e.g. 8:00 AM (Breakfast)
    time_lunch = _offset_time_str(wake_anchor, 6.0)     # e.g. 1:00 PM (Lunch)
    time_dinner = _offset_time_str(wake_anchor, 12.0)   # e.g. 7:00 PM (Dinner)
    time_bedtime = _offset_time_str(wake_anchor, 15.0)  # e.g. 10:00 PM (Bedtime)

    # 1. Empty Stomach Window
    if has_empty_stomach_meds:
        timeline.append(TimelineSlot(
            time=time_fast,
            title=f"Take {', '.join(has_empty_stomach_meds)} (Fast)",
            medicine=", ".join(has_empty_stomach_meds),
            action_type="med_empty_stomach",
            icon="clock",
            note="Take with a full 8 oz glass of water 30-60 minutes before food."
        ))

    # 2. Breakfast & Morning Food Meds
    morning_food_meds = [m for m in has_with_food_meds if m not in ["Metformin"]]
    timeline.append(TimelineSlot(
        time=time_breakfast,
        title="Breakfast Meal Window",
        medicine=", ".join(morning_food_meds) if morning_food_meds else None,
        action_type="meal",
        icon="utensils",
        note="Substantial meal buffers stomach acid." + (f" Administer {', '.join(morning_food_meds)} with meal." if morning_food_meds else "")
    ))

    # 3. Lunch Window
    timeline.append(TimelineSlot(
        time=time_lunch,
        title="Lunch & Mid-Day Dosing",
        medicine=None,
        action_type="meal",
        icon="utensils",
        note="If taking twice-daily antibiotic (e.g. Augmentin), take with lunch."
    ))

    # 4. Dinner & Evening Meds
    evening_food_meds = [m for m in medicines if "metformin" in expand_aliases(m) or "atorvastatin" in expand_aliases(m) or "warfarin" in expand_aliases(m)]
    timeline.append(TimelineSlot(
        time=time_dinner,
        title="Dinner Meal & Evening Dosing",
        medicine=", ".join([m.capitalize() for m in evening_food_meds]) if evening_food_meds else None,
        action_type="med_with_food" if evening_food_meds else "meal",
        icon="utensils",
        note="Take evening medications with dinner to maximize tolerance and maintain stable overnight levels."
    ))

    # 5. Bedtime
    timeline.append(TimelineSlot(
        time=time_bedtime,
        title="Bedtime Review",
        medicine=None,
        action_type="bedtime_med",
        icon="moon",
        note="Ensure at least 30 minutes of upright posture after taking any final pills before lying down."
    ))

    return conflicts, timeline
