import os
import json
import logging
import re
import httpx
from typing import Dict, Any, Optional, List, Tuple
from models import ParsedDrugInfo, InteractionItem

logger = logging.getLogger("mistral_parser")

MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

# Built-in clinical pharmacology rules for guaranteed deterministic analysis and zero-key fallback
KNOWN_CLINICAL_RULES = [
    {
        "drugs": {"warfarin", "aspirin"},
        "severity": "high",
        "explanation": "Combining Warfarin (an anticoagulant) with Aspirin (an antiplatelet agent) significantly amplifies the risk of major internal and gastrointestinal bleeding. Co-administration requires strict medical supervision and INR monitoring."
    },
    {
        "drugs": {"warfarin", "ibuprofen"},
        "severity": "high",
        "explanation": "Ibuprofen is an NSAID that irritates the stomach lining and inhibits platelet aggregation, dramatically elevating the risk of severe gastrointestinal hemorrhage when taken alongside Warfarin."
    },
    {
        "drugs": {"aspirin", "ibuprofen"},
        "severity": "moderate",
        "explanation": "Ibuprofen may competitively interfere with the antiplatelet cardioprotective effect of low-dose Aspirin. Concurrent use also increases the risk of gastrointestinal ulcers and stomach irritation."
    },
    {
        "drugs": {"metformin", "alcohol"},
        "severity": "high",
        "explanation": "Alcohol potentiates the effect of Metformin on lactate metabolism, significantly increasing the risk of potentially life-threatening lactic acidosis and severe hypoglycemia."
    },
    {
        "drugs": {"atorvastatin", "clarithromycin"},
        "severity": "high",
        "explanation": "Strong CYP3A4 inhibitors like Clarithromycin can significantly increase blood concentrations of Atorvastatin, elevating the risk of myopathy and severe muscle breakdown (rhabdomyolysis)."
    },
    {
        "drugs": {"omeprazole", "clopidogrel"},
        "severity": "moderate",
        "explanation": "Omeprazole inhibits the CYP2C19 enzyme responsible for activating Clopidogrel, potentially reducing its cardiovascular antiplatelet efficacy."
    },
    {
        "drugs": {"levothyroxine", "omeprazole"},
        "severity": "moderate",
        "explanation": "Proton pump inhibitors like Omeprazole decrease stomach acidity, which can impair the gastrointestinal absorption and efficacy of Levothyroxine."
    },
    {
        "drugs": {"metoprolol", "amlodipine"},
        "severity": "moderate",
        "explanation": "Concurrent use of a beta-blocker (Metoprolol) and a calcium channel blocker (Amlodipine) can cause additive blood pressure lowering and enhanced negative chronotropic effects, increasing risk of dizziness or bradycardia."
    },
    {
        "drugs": {"paracetamol", "alcohol"},
        "severity": "moderate",
        "explanation": "Regular or excessive alcohol consumption during Paracetamol (Acetaminophen) therapy significantly heightens the risk of acute hepatic toxicity and liver damage."
    },
    {
        "drugs": {"paracetamol", "warfarin"},
        "severity": "low",
        "explanation": "Occasional low doses of Paracetamol are generally safe with Warfarin, but chronic or high-dose usage (>2g/day) may prolong the INR and slightly increase bleeding risk."
    },
    {
        "drugs": {"lisinopril", "potassium"},
        "severity": "high",
        "explanation": "ACE inhibitors reduce aldosterone secretion, decreasing potassium excretion. Concomitant potassium supplementation can cause dangerous hyperkalemia."
    },
    {
        "drugs": {"ciprofloxacin", "theophylline"},
        "severity": "high",
        "explanation": "Ciprofloxacin inhibits the hepatic metabolism of Theophylline, causing toxic blood levels of Theophylline leading to nausea, cardiac arrhythmias, and seizures."
    }
]

async def parse_drug_label_with_mistral(raw_label: Dict[str, Any]) -> ParsedDrugInfo:
    """
    Use Mistral AI to parse unstructured drug label into structured clinical fields.
    Falls back to deterministic rule extraction if API key is not available.
    """
    api_key = os.getenv("MISTRAL_API_KEY", "").strip()
    generic_name = raw_label.get("generic_name", "unknown")
    raw_text = raw_label.get("raw_text_summary", "")

    if not api_key:
        logger.info("MISTRAL_API_KEY not configured. Using rule-based clinical extractor.")
        return fallback_extract_drug_info(raw_label)

    prompt = f"""You are an expert clinical pharmacist and pharmacology data parser.
Parse the following FDA drug label summary for '{generic_name}' into structured JSON.

FDA Drug Label Summary:
\"\"\"
{raw_text[:4000]}
\"\"\"

Respond ONLY with a valid JSON object strictly matching this schema:
{{
  "generic_name": "{generic_name}",
  "side_effects": ["list", "of", "top", "side", "effects"],
  "food_warnings": ["list", "of", "food/alcohol", "warnings"],
  "drug_interactions": ["list", "of", "interacting", "drugs", "or", "classes"],
  "severity": "low" | "moderate" | "high"
}}
"""

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(
                MISTRAL_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "mistral-small-latest",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                }
            )
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                parsed_dict = json.loads(content)
                return ParsedDrugInfo(
                    generic_name=parsed_dict.get("generic_name", generic_name),
                    brand_names=raw_label.get("brand_names", []),
                    side_effects=parsed_dict.get("side_effects", [])[:6],
                    food_warnings=parsed_dict.get("food_warnings", [])[:4],
                    drug_interactions=parsed_dict.get("drug_interactions", [])[:8],
                    severity=parsed_dict.get("severity", "low"),
                    raw_text=raw_text[:1000]
                )
    except Exception as e:
        logger.warning(f"Mistral AI parse failed: {e}. Falling back to rule-based parser.")

    return fallback_extract_drug_info(raw_label)

def fallback_extract_drug_info(raw_label: Dict[str, Any]) -> ParsedDrugInfo:
    """
    Extract structured items from raw openFDA sections using regex and keyword analysis.
    """
    generic_name = raw_label.get("generic_name", "unknown")
    brand_names = raw_label.get("brand_names", [])
    raw_text = raw_label.get("raw_text_summary", "")

    side_effects = []
    for item in raw_label.get("adverse_reactions", []):
        cleaned = re.sub(r'[\r\n\t]+', ' ', item)[:250].strip()
        if cleaned and len(cleaned) > 10:
            side_effects.append(cleaned)
    if not side_effects:
        side_effects = ["Nausea", "Headache", "Dizziness", "Gastrointestinal upset"]

    food_warnings = []
    for item in raw_label.get("food_interactions", []):
        cleaned = re.sub(r'[\r\n\t]+', ' ', item)[:200].strip()
        if cleaned:
            food_warnings.append(cleaned)
    if "alcohol" in raw_text.lower() and not food_warnings:
        food_warnings.append("Avoid excessive alcohol consumption while taking this medication.")

    drug_interactions = []
    for item in raw_label.get("drug_interactions", []):
        cleaned = re.sub(r'[\r\n\t]+', ' ', item)[:300].strip()
        if cleaned:
            drug_interactions.append(cleaned)

    return ParsedDrugInfo(
        generic_name=generic_name,
        brand_names=brand_names,
        side_effects=side_effects[:5],
        food_warnings=food_warnings[:3],
        drug_interactions=drug_interactions[:6],
        severity="low",
        raw_text=raw_text[:1000]
    )

async def analyze_drug_pair(
    drug_a: str,
    drug_b: str,
    label_a: Optional[Dict[str, Any]] = None,
    label_b: Optional[Dict[str, Any]] = None
) -> Optional[InteractionItem]:
    """
    Analyzes potential drug-drug interaction between drug_a and drug_b.
    Checks:
    1. Built-in clinical pharmacology rules.
    2. Mistral AI contextual synthesis if API key is present.
    3. OpenFDA label text cross-matching (warnings, contraindications, drug interactions).
    """
    pair_set = {drug_a.lower().strip(), drug_b.lower().strip()}

    # 1. Match against known high/moderate risk clinical rules
    for rule in KNOWN_CLINICAL_RULES:
        if rule["drugs"] == pair_set:
            return InteractionItem(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=rule["severity"],
                explanation=rule["explanation"]
            )

    # 2. Check openFDA label text cross-mentions
    fda_text_a = (label_a.get("raw_text_summary", "") if label_a else "").lower()
    fda_text_b = (label_b.get("raw_text_summary", "") if label_b else "").lower()

    name_a = drug_a.lower()
    name_b = drug_b.lower()

    # If label A mentions drug B or label B mentions drug A
    a_in_b = bool(name_a in fda_text_b and len(name_a) > 3)
    b_in_a = bool(name_b in fda_text_a and len(name_b) > 3)

    if a_in_b or b_in_a:
        # Check for severity indicators in the text
        combined_text = f"{fda_text_a} {fda_text_b}"
        if any(w in combined_text for w in ["fatal", "severe hemorrhage", "contraindicated", "life-threatening", "do not use with"]):
            sev = "high"
        elif any(w in combined_text for w in ["caution", "monitoring", "increase the risk", "adversely affect"]):
            sev = "moderate"
        else:
            sev = "low"

        explanation = f"FDA drug label data indicates potential interaction between {drug_a.capitalize()} and {drug_b.capitalize()}. Concurrent administration may alter drug metabolism, absorption, or increase adverse reaction risks. Consult a doctor or pharmacist."
        return InteractionItem(
            drug_a=drug_a,
            drug_b=drug_b,
            severity=sev,
            explanation=explanation
        )

    # 3. Mistral dynamic evaluation if API key is configured
    api_key = os.getenv("MISTRAL_API_KEY", "").strip()
    if api_key and (label_a or label_b):
        try:
            prompt = f"""As an expert clinical pharmacist, evaluate if there is any clinically significant drug-drug interaction between {drug_a} and {drug_b}.

Context for {drug_a}:
{fda_text_a[:1500]}

Context for {drug_b}:
{fda_text_b[:1500]}

Respond ONLY in JSON format:
{{
  "has_interaction": true | false,
  "severity": "high" | "moderate" | "low" | "none",
  "explanation": "Clear, patient-accessible 2-3 sentence explanation of the interaction mechanism and risk."
}}
"""
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    MISTRAL_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "mistral-small-latest",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"}
                    }
                )
                if res.status_code == 200:
                    result = json.loads(res.json()["choices"][0]["message"]["content"])
                    if result.get("has_interaction") and result.get("severity") != "none":
                        return InteractionItem(
                            drug_a=drug_a,
                            drug_b=drug_b,
                            severity=result.get("severity", "moderate"),
                            explanation=result.get("explanation", f"Potential interaction detected between {drug_a} and {drug_b}.")
                        )
        except Exception as e:
            logger.warning(f"Mistral dynamic pair evaluation error: {e}")

    return None
