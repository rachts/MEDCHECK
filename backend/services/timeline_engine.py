from typing import List, Dict, Any, Tuple
from models import (
    MedicineProfileResponse, 
    FoodConflictDetail, 
    TimelineSlot
)
from services.clinical_rules import expand_aliases

def generate_food_conflicts_and_timeline(
    medicines: List[str], 
    profiles: Dict[str, MedicineProfileResponse]
) -> Tuple[List[FoodConflictDetail], List[TimelineSlot]]:
    """
    Analyzes dietary instructions across all active medicines to detect timing/food conflicts
    and generates a synchronized 24-hour patient dosing schedule.
    """
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

    # Build 24-Hour Patient Daily Schedule
    # 07:00 AM - Empty Stomach Meds
    if has_empty_stomach_meds:
        timeline.append(TimelineSlot(
            time="07:00 AM",
            title=f"Take {', '.join(has_empty_stomach_meds)} (Fast)",
            medicine=", ".join(has_empty_stomach_meds),
            action_type="med_empty_stomach",
            icon="clock",
            note="Take with a full 8 oz glass of water 30-60 minutes before food."
        ))

    # 08:00 AM - Breakfast & Morning Food Meds
    morning_food_meds = [m for m in has_with_food_meds if m not in ["Metformin"]]
    timeline.append(TimelineSlot(
        time="08:00 AM",
        title="Breakfast Meal Window",
        medicine=", ".join(morning_food_meds) if morning_food_meds else None,
        action_type="meal",
        icon="utensils",
        note="Substantial meal buffers stomach acid." + (f" Administer {', '.join(morning_food_meds)} with meal." if morning_food_meds else "")
    ))

    # 01:00 PM - Lunch Window
    timeline.append(TimelineSlot(
        time="01:00 PM",
        title="Lunch & Mid-Day Dosing",
        medicine=None,
        action_type="meal",
        icon="utensils",
        note="If taking twice-daily antibiotic (e.g. Augmentin), take with lunch."
    ))

    # 07:00 PM - Dinner & Evening Meds
    evening_food_meds = [m for m in medicines if "metformin" in expand_aliases(m) or "atorvastatin" in expand_aliases(m) or "warfarin" in expand_aliases(m)]
    timeline.append(TimelineSlot(
        time="07:00 PM",
        title="Dinner Meal & Evening Dosing",
        medicine=", ".join([m.capitalize() for m in evening_food_meds]) if evening_food_meds else None,
        action_type="med_with_food" if evening_food_meds else "meal",
        icon="utensils",
        note="Take evening medications with dinner to maximize tolerance and maintain stable overnight levels."
    ))

    # 10:00 PM - Bedtime
    timeline.append(TimelineSlot(
        time="10:00 PM",
        title="Bedtime Review",
        medicine=None,
        action_type="bedtime_med",
        icon="moon",
        note="Ensure at least 30 minutes of upright posture after taking any final pills before lying down."
    ))

    return conflicts, timeline
