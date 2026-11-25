from typing import Optional, Tuple, List
from models import (
    CatalogueProduct,
    MedicineProfileResponse,
    ChatKnownInteraction,
    IndiaBanInfo,
    Severity,
)
from services.knowledge_base import (
    CURATED_MEDICINE_PROFILES,
    COMMON_BRAND_MAPPINGS,
    SYNONYM_SETS,
    get_fdc_info,
)
from services.clinical_rules import (
    KNOWN_CLINICAL_RULES,
    resolve_canonical_name,
    expand_aliases,
)
from services.search_engine import search_medicine_database
from services.india_banned import normalize_ingredient


AI_FALLBACK_DISCLAIMER = (
    "This is AI-fetched data, not from the MEDCHECK database. Kindly consult a pharmacist before use."
)

CATALOGUE_DISCLAIMER = (
    "This is from the Indian medicines catalogue, not from the MEDCHECK clinical "
    "database. It has no interaction check and no stomach safety score. "
    "Kindly consult a pharmacist before use."
)

SYSTEM_PROMPT_INITIAL = (
    "You are the MEDCHECK medicine label assistant. Explain the supplied medicine label and "
    "profile data in very simple English for readers in India, using short sentences and everyday words.\n\n"
    "STRICT GROUNDING RULES:\n"
    "1. Answer ONLY from the supplied medicine data. Never use outside medical memory and never "
    "invent dosages, schedules, interactions, side effects, contraindications, or any facts not present in the supplied data.\n"
    "2. Never present your answer as medical advice. Remind the reader that personal treatment questions belong to a doctor or pharmacist.\n"
    "3. If the supplied data does not cover part of a section (for example, exact milligram dose schedules), "
    "say plainly that the available label data does not cover it and suggest checking the official prescribing label or asking a pharmacist.\n"
    "4. Structure your answer cleanly under these exact plain-language headings:\n"
    "What it is:\n"
    "What it is used for:\n"
    "How it is usually taken:\n"
    "Common side effects:\n"
    "Food and alcohol cautions:\n"
    "Serious warnings:\n"
    "5. Under 'How it is usually taken', include ONLY what the supplied dosage forms, food timing rules, and recommendations explicitly state.\n"
    "6. Use calm, readable prose without em dashes; use commas, colons, or semicolons instead.\n\n"
    "LANGUAGE AND AUDIENCE RULES (INDIA):\n"
    "7. Write in very simple English: short sentences, everyday words, the way you would explain a medicine to a family member at home. "
    "Avoid clinical jargon; when a medical term from the data is important, explain it in simple words in brackets the first time, "
    "for example \"INR (a blood test that shows how quickly the blood clots)\".\n"
    "8. Address the reader in India: refer to the medicine by the brand name the visitor typed as well as the generic name when both are known; "
    "use familiar everyday references for timing and food only to illustrate what the supplied data already says (for example, \"with your morning meal\"), "
    "and never add a food rule, dose, or fact that is not in the supplied data.\n"
    "9. Keep the same six plain-language headings above. Keep answers complete but not longer than the data needs.\n"
    "10. No em dashes; use commas, colons, or semicolons.\n"
    "11. End every answer with exactly this line:\n"
    "For your own treatment, please ask your doctor or pharmacist."
)

SYSTEM_PROMPT_FOLLOWUP = (
    "You are the MEDCHECK medicine label assistant. Answer the visitor's follow-up question "
    "in very simple English for readers in India, using short sentences and everyday words.\n\n"
    "STRICT GROUNDING RULES:\n"
    "1. Answer ONLY from the supplied medicine data. Never rely on outside knowledge.\n"
    "2. Never invent dosages, interactions, side effects, or facts not explicitly stated in the supplied data.\n"
    "3. If the supplied data does not cover the visitor's question, say plainly that the available label data does not cover it and suggest checking the official label or asking a pharmacist.\n"
    "4. Never present your response as medical advice; remind the visitor to consult a doctor or pharmacist for personal treatment decisions.\n"
    "5. Use calm, readable prose without em dashes; use commas, colons, or semicolons instead.\n\n"
    "LANGUAGE AND AUDIENCE RULES (INDIA):\n"
    "6. Write in very simple English: short sentences, everyday words, the way you would explain a medicine to a family member at home. "
    "Avoid clinical jargon; when a medical term from the data is important, explain it in simple words in brackets the first time, "
    "for example \"INR (a blood test that shows how quickly the blood clots)\".\n"
    "7. Address the reader in India: refer to the medicine by the brand name the visitor typed as well as the generic name when both are known; "
    "use familiar everyday references for timing and food only to illustrate what the supplied data already says (for example, \"with your morning meal\"), "
    "and never add a food rule, dose, or fact that is not in the supplied data.\n"
    "8. Keep answers complete but not longer than the data needs.\n"
    "9. No em dashes; use commas, colons, or semicolons.\n"
    "10. End every answer with exactly this line:\n"
    "For your own treatment, please ask your doctor or pharmacist."
)

SYSTEM_PROMPT_FALLBACK = (
    "You are the MEDCHECK assistant helping a reader in India understand a medicine that is not currently in the MEDCHECK database. "
    "Provide a general plain-language overview from general medical knowledge.\n\n"
    "FALLBACK SAFETY RULES:\n"
    "1. Never give personal dosing instructions or tell the reader what dose to take; give general label-style information only.\n"
    "2. Never claim that your answer comes from the MEDCHECK database or from an official prescribing label.\n"
    "3. For an initial overview (when no specific follow-up question is asked), structure your answer cleanly under these exact headings in this order:\n"
    "What it is:\n"
    "What it is used for:\n"
    "Common side effects:\n"
    "Important cautions:\n"
    "4. For a follow-up question, answer the question directly using general label-style knowledge under the same safety and language rules.\n\n"
    "LANGUAGE AND AUDIENCE RULES (INDIA):\n"
    "5. Write in very simple English: short sentences, everyday words, the way you would explain a medicine to a family member at home. "
    "Avoid clinical jargon; when a medical term is important, explain it in simple words in brackets the first time, "
    "for example \"INR (a blood test that shows how quickly the blood clots)\".\n"
    "6. Address the reader in India: refer to the medicine by the brand name the visitor typed as well as the generic name when both are known; "
    "use familiar everyday references for timing and food when describing general guidance (for example, \"with your morning meal\").\n"
    "7. Keep answers complete but concise.\n"
    "8. No em dashes; use commas, colons, or semicolons.\n"
    "9. End every answer with exactly this line:\n"
    "For your own treatment, please ask your doctor or pharmacist."
)


def format_canonical_medicine_name(canonical_key: str) -> str:
    """Formats a canonical lowercase key (e.g. 'paracetamol', 'mefenamic acid') for display."""
    cleaned = (canonical_key or "").strip()
    if not cleaned:
        return ""
    if "/" in cleaned:
        return "/".join(
            " ".join(word.capitalize() for word in part.split())
            for part in cleaned.split("/")
        )
    return " ".join(word.capitalize() for word in cleaned.split())


def resolve_medicine_for_chat(raw_medicine: str) -> Optional[Tuple[str, str]]:
    """
    Resolves a visitor-supplied medicine string through MEDCHECK's canonicalisation
    and search index.

    Returns (canonical_generic_key, profile_builder_query) or None if unresolved.
    """
    cleaned = (raw_medicine or "").strip()
    if not cleaned:
        return None

    q_lower = cleaned.lower()
    known_generics = set(CURATED_MEDICINE_PROFILES.keys()) | set(COMMON_BRAND_MAPPINGS.values())

    # 1. Exact brand/dosage/generic normalisation (e.g. 'Dolo 650' -> 'paracetamol', 'Pan 40' -> 'pantoprazole')
    canonical = resolve_canonical_name(cleaned)
    if canonical in known_generics:
        return canonical, cleaned

    # 2. Synonym table match (e.g. 'acetaminophen' -> 'paracetamol', 'acetylsalicylic acid' -> 'aspirin')
    for syn_set in SYNONYM_SETS:
        if q_lower in syn_set or canonical in syn_set:
            for candidate in syn_set:
                if candidate in CURATED_MEDICINE_PROFILES:
                    return candidate, cleaned
            for candidate in syn_set:
                if candidate in COMMON_BRAND_MAPPINGS.values():
                    return candidate, cleaned

    # 3. FDC check (e.g. combination products)
    fdc = get_fdc_info(cleaned)
    if fdc and fdc.get("primary_ingredient"):
        primary = resolve_canonical_name(fdc["primary_ingredient"])
        if primary in known_generics:
            return primary, cleaned

    # Combination inputs ("A + B") or general ban-list questions must not collapse
    # to a single drug via substring matching in the search index.
    if "+" in q_lower or "banned" in q_lower or "ban list" in q_lower:
        return None

    # 4. Prefix / substring match via search_medicine_database (name, generic, or brand alias)
    if len(q_lower) >= 3:
        search_results = search_medicine_database(cleaned)
        for res in search_results:
            g_key = res.generic_name.lower()
            curated = CURATED_MEDICINE_PROFILES.get(g_key, {})
            brands = [b.lower() for b in curated.get("brand_names", [])]
            if (
                q_lower in g_key
                or q_lower in res.name.lower()
                or res.brand_context is not None
                or any(q_lower in b for b in brands)
            ):
                # When matching a partial generic (e.g. 'ibuprof'), pass the resolved key to profile builder
                builder_input = cleaned if canonical in known_generics else g_key
                return g_key, builder_input

    return None


def get_known_interactions_for_medicine(
    canonical_generic: str,
    fdc_ingredients: Optional[List[str]] = None,
) -> Tuple[List[ChatKnownInteraction], Optional[str]]:
    """
    Collects all curated interaction rules involving this medicine (or its FDC
    constituents) and extracts any FDA Black Box Warning text cited in those rules.
    """
    aliases = expand_aliases(canonical_generic)
    if fdc_ingredients:
        for ing in fdc_ingredients:
            aliases.update(expand_aliases(ing))

    severity_rank = {
        Severity.HIGH: 0,
        Severity.MODERATE: 1,
        Severity.LOW: 2,
        Severity.NONE: 3,
    }

    interactions: List[ChatKnownInteraction] = []
    seen_keys = set()
    boxed_rule_notes: List[str] = []

    for (k1, k2), rule in KNOWN_CLINICAL_RULES.items():
        other_key = None
        if k1 in aliases and k2 not in aliases:
            other_key = k2
        elif k2 in aliases and k1 not in aliases:
            other_key = k1

        if not other_key:
            continue

        dedup_key = (other_key, rule["explanation"])
        if dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)

        evidence = rule.get("evidence_source") or ""
        if "black box warning" in evidence.lower() or "boxed warning" in evidence.lower():
            boxed_rule_notes.append(f"{evidence}: {rule['explanation']}")

        interactions.append(
            ChatKnownInteraction(
                other_medicine=format_canonical_medicine_name(other_key),
                severity=rule["severity"],
                explanation=rule["explanation"],
                mechanism=rule.get("mechanism"),
                clinical_impact=rule.get("clinical_impact"),
                food_consideration=rule.get("food_consideration"),
                action_guidance=rule.get("action_guidance"),
                evidence_source=rule.get("evidence_source"),
            )
        )

    interactions.sort(key=lambda item: (severity_rank.get(item.severity, 9), item.other_medicine))
    boxed_warning = " ".join(boxed_rule_notes) if boxed_rule_notes else None
    return interactions, boxed_warning


def resolve_ban_ingredients(
    raw_medicine: str,
    canonical_key: Optional[str] = None,
    profile: Optional[MedicineProfileResponse] = None,
) -> List[str]:
    """
    Computes ONE normalized ingredient list for CDSCO ban checking, matching the
    same FDC ingredient knowledge used by the therapeutic duplication engine.
    """
    raw = (raw_medicine or "").strip()

    if profile and profile.is_fdc and profile.fdc_ingredients:
        raw_parts = list(profile.fdc_ingredients)
        if canonical_key and "/" not in canonical_key:
            norm_canon = normalize_ingredient(canonical_key)
            existing = {normalize_ingredient(p) for p in raw_parts}
            if norm_canon and norm_canon not in existing:
                raw_parts.append(canonical_key)
        return [n for n in (normalize_ingredient(p) for p in raw_parts) if n]

    fdc = get_fdc_info(raw)
    if fdc and fdc.get("ingredients"):
        raw_parts = list(fdc["ingredients"])
        if canonical_key and "/" not in canonical_key:
            norm_canon = normalize_ingredient(canonical_key)
            existing = {normalize_ingredient(p) for p in raw_parts}
            if norm_canon and norm_canon not in existing:
                raw_parts.append(canonical_key)
        return [n for n in (normalize_ingredient(p) for p in raw_parts) if n]

    if "+" in raw:
        parts = [p.strip() for p in raw.split("+") if p.strip()]
        return [n for n in (normalize_ingredient(p) for p in parts) if n]

    target = canonical_key or raw
    if "/" in target:
        parts = [p.strip() for p in target.split("/") if p.strip()]
        return [n for n in (normalize_ingredient(p) for p in parts) if n]

    norm = normalize_ingredient(target)
    return [norm] if norm else []


def compose_medicine_context(
    canonical_display: str,
    profile: MedicineProfileResponse,
    known_interactions: List[ChatKnownInteraction],
    boxed_warning: Optional[str] = None,
    label_interaction_notes: Optional[List[str]] = None,
    typed_medicine: Optional[str] = None,
    india_ban: Optional[IndiaBanInfo] = None,
) -> str:
    """
    Serializes the medicine profile, boxed warning (if present), and known interactions
    into a strictly grounded plain-text dossier for Groq.
    """
    lines: List[str] = [
        f"MEDICINE PROFILE: {canonical_display}",
        f"Official Display Name: {profile.name}",
        f"Canonical Generic Name: {profile.generic_name}",
    ]
    if typed_medicine and typed_medicine.strip():
        lines.append(f"Name Typed by Visitor: {typed_medicine.strip()}")
    lines.extend([
        f"Regulatory Type: {profile.drug_type.value}",
        f"Pharmacological Category: {profile.category}",
        f"Dosage Forms Listed: {', '.join(profile.dosage_forms) if profile.dosage_forms else 'Not specified'}",
        f"Known Brand Names: {', '.join(profile.brand_names) if profile.brand_names else 'None listed'}",
        f"Data Source: {profile.data_source}",
    ])

    if profile.is_fdc:
        lines.append(
            f"Fixed-Dose Combination: Yes (Ingredients: {', '.join(profile.fdc_ingredients)}; "
            f"Note: {profile.fdc_warning or 'Combination product'})"
        )

    lines.extend([
        "",
        "OVERVIEW & USES:",
        profile.description or "No overview description available in the label profile.",
    ])

    if boxed_warning:
        lines.extend([
            "",
            "BOXED WARNING (CRITICAL):",
            boxed_warning,
        ])

    if india_ban and india_ban.matched:
        lines.extend([
            "",
            "INDIA REGULATORY STATUS (CDSCO - MANDATORY WARNING):",
            f"- Official Entry: {india_ban.entry_name}",
            f"- Status: {india_ban.status}",
            f"- Notification: {india_ban.notification or 'Not specified'}",
            f"- Regulatory Notice: {india_ban.message}",
            "- Instruction: Keep this warning clearly in your answer. Never soften or contradict this ban or regulatory restriction.",
        ])

    lines.append("")
    lines.append("SIDE EFFECTS:")
    if profile.side_effects:
        for se in profile.side_effects:
            lines.append(
                f"- {se.effect} (frequency: {se.frequency.value}, rate: {se.frequency_percentage}, "
                f"severity: {se.severity}, category: {se.category})"
            )
    else:
        lines.append("- None indexed in the available profile.")

    lines.append("")
    lines.append("FOOD AND ALCOHOL RULES:")
    if profile.food_interactions:
        for fi in profile.food_interactions:
            lines.append(f"- [{fi.severity.upper()}] {fi.title}: {fi.description}")
    else:
        lines.append("- No specific food or alcohol restrictions listed in the available profile.")

    gi = profile.gi_profile
    lines.extend([
        "",
        "STOMACH & PRECAUTIONS / WARNINGS:",
        f"- Stomach Health Score: {gi.stomach_health_score}/100 (Risk tier: {gi.risk_tier.value})",
        f"- GI Risks: nausea={gi.nausea_risk}, ulcer={gi.ulcer_risk}, bleeding={gi.bleeding_risk}, reflux_aggravation={gi.reflux_aggravation}",
    ])
    if gi.recommendations:
        for rec in gi.recommendations:
            lines.append(f"- Administration / GI guidance: {rec}")
    if profile.lifestyle_warnings:
        for warn in profile.lifestyle_warnings:
            lines.append(f"- Precaution: {warn}")
    if profile.disclaimer:
        lines.append(f"- Profile Disclaimer: {profile.disclaimer}")

    lines.append("")
    lines.append("KNOWN INTERACTIONS:")
    if known_interactions:
        for ix in known_interactions:
            parts = [f"- With {ix.other_medicine} (severity: {ix.severity.value.upper()}): {ix.explanation}"]
            if ix.clinical_impact:
                parts.append(f"Clinical impact: {ix.clinical_impact}")
            if ix.action_guidance:
                parts.append(f"Guidance: {ix.action_guidance}")
            if ix.evidence_source:
                parts.append(f"Source: {ix.evidence_source}")
            lines.append(" ".join(parts))
    elif label_interaction_notes:
        for note in label_interaction_notes[:6]:
            lines.append(f"- FDA label interaction excerpt: {note}")
    else:
        lines.append("- No specific interaction pairs indexed in the curated clinical rule table.")

    return "\n".join(lines)


def build_chat_prompts(
    context: str,
    canonical_display: str,
    question: Optional[str] = None,
    typed_medicine: Optional[str] = None,
    india_ban: Optional[IndiaBanInfo] = None,
) -> Tuple[str, str]:
    """Returns (system_prompt, user_prompt) for initial summary or follow-up Q&A."""
    cleaned_typed = (typed_medicine or "").strip()
    med_label = (
        f"{cleaned_typed} (generic name: {canonical_display})"
        if cleaned_typed and cleaned_typed.lower() != canonical_display.lower()
        else canonical_display
    )
    ban_instruction = ""
    if india_ban and india_ban.matched:
        ban_instruction = (
            "\n\nINDIA REGULATORY WARNING REQUIREMENT:\n"
            f"CDSCO regulatory entry applies: {india_ban.entry_name} | "
            f"Status: {india_ban.status} | "
            f"Notification: {india_ban.notification or 'Not specified'}.\n"
            "You MUST keep the regulatory warning clear and prominent. "
            "Never soften, minimize, or contradict this ban or regulatory restriction."
        )
    if question:
        user_prompt = (
            f"Supplied medicine data:\n{context}\n\n"
            f"Visitor follow-up question about {med_label}: {question}\n"
            "Answer ONLY from the supplied medicine data above."
        )
        return SYSTEM_PROMPT_FOLLOWUP + ban_instruction, user_prompt

    user_prompt = (
        f"Supplied medicine data:\n{context}\n\n"
        f"Write a plain-language guide for a patient in India asking about {med_label}. "
        "Follow the exact six headings and use ONLY the facts in the supplied medicine data above."
    )
    return SYSTEM_PROMPT_INITIAL + ban_instruction, user_prompt


def build_fallback_chat_prompts(
    typed_medicine: str,
    question: Optional[str] = None,
    known_generic: Optional[str] = None,
) -> Tuple[str, str]:
    """Returns (system_prompt, user_prompt) for the AI fallback path when a medicine is not in MEDCHECK."""
    cleaned_typed = (typed_medicine or "").strip()
    med_label = (
        f"{cleaned_typed} (generic name: {known_generic})"
        if known_generic and known_generic.strip().lower() != cleaned_typed.lower()
        else cleaned_typed
    )
    if question:
        user_prompt = (
            f"The medicine '{med_label}' is not in the MEDCHECK database.\n"
            f"Visitor follow-up question about {med_label}: {question}\n"
            "Answer using general label-style medical knowledge in very simple English for a reader in India. "
            "Do not give personal dosing instructions and do not claim this comes from the MEDCHECK database or an official label. "
            "End with exactly: For your own treatment, please ask your doctor or pharmacist."
        )
        return SYSTEM_PROMPT_FALLBACK, user_prompt

    user_prompt = (
        f"The medicine '{med_label}' is not in the MEDCHECK database.\n"
        f"Write a general plain-language overview of {med_label} for a reader in India from general medical knowledge. "
        "Use these exact four headings in order: What it is:, What it is used for:, Common side effects:, Important cautions:. "
        "Do not give personal dosing instructions and do not claim this comes from the MEDCHECK database or an official label. "
        "End with exactly: For your own treatment, please ask your doctor or pharmacist."
    )
    return SYSTEM_PROMPT_FALLBACK, user_prompt


def _clean_catalogue_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = str(value).strip().replace("\u2014", "; ")
    if not cleaned or cleaned.upper() == "NA":
        return None
    return cleaned


def build_catalogue_answer(product: CatalogueProduct, question: Optional[str] = None) -> str:
    """
    Deterministic plain-English answer built strictly from a CatalogueProduct row.
    Makes no AI call and never invents composition, doses, or interactions.
    """
    sections: List[str] = []

    if question is not None and str(question).strip():
        sections.append(
            "The catalogue holds basic information only. It does not cover doses or "
            "interactions with other medicines. Here is everything it has for this medicine:"
        )

    product_name = _clean_catalogue_text(product.name) or product.name
    therapeutic_class = _clean_catalogue_text(product.therapeutic_class)
    action_class = _clean_catalogue_text(product.action_class)

    if therapeutic_class and action_class:
        what_it_is = (
            f"{product_name} is a brand product in the Indian medicines catalogue. "
            f"Its therapeutic class is {therapeutic_class}, and its action class is {action_class}."
        )
    elif therapeutic_class:
        what_it_is = (
            f"{product_name} is a brand product in the Indian medicines catalogue. "
            f"Its therapeutic class is {therapeutic_class}."
        )
    elif action_class:
        what_it_is = (
            f"{product_name} is a brand product in the Indian medicines catalogue. "
            f"Its action class is {action_class}."
        )
    else:
        what_it_is = f"{product_name} is a brand product in the Indian medicines catalogue."
    sections.append(f"What it is:\n{what_it_is}")

    uses = [u for u in (_clean_catalogue_text(item) for item in (product.uses or [])) if u]
    if uses:
        uses_text = ", ".join(uses)
        if not uses_text.endswith("."):
            uses_text += "."
    else:
        uses_text = "The catalogue does not list uses for this medicine."
    sections.append(f"What it is used for:\n{uses_text}")

    side_effects = [se for se in (_clean_catalogue_text(item) for item in (product.side_effects or [])) if se]
    if product.no_common_side_effects:
        side_effects_text = (
            "The catalogue says no common side effects are usually seen for this medicine."
        )
    elif side_effects:
        side_effects_text = ", ".join(side_effects)
        if not side_effects_text.endswith("."):
            side_effects_text += "."
    else:
        side_effects_text = "The catalogue does not list side effects for this medicine."
    sections.append(f"Common side effects:\n{side_effects_text}")

    substitutes = [s for s in (_clean_catalogue_text(item) for item in (product.substitutes or [])) if s]
    if substitutes:
        subs_text = ", ".join(substitutes)
        if not subs_text.endswith("."):
            subs_text += "."
        sections.append(f"Other brands with the same composition:\n{subs_text}")

    if product.habit_forming:
        sections.append(
            "Caution: this medicine can be habit forming. Take it only as your doctor says."
        )

    sections.append("For your own treatment, please ask your doctor or pharmacist.")
    return "\n\n".join(sections)
