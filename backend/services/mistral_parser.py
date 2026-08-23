import os
import json
import logging
import re
import httpx
from typing import Dict, Any, Optional, List, Set, Tuple
from models import (
    ParsedDrugInfo,
    InteractionItem,
    SideEffectDetail,
    FoodInteractionDetail,
    GIProfile,
    MedicineProfileResponse,
    FoodConflictDetail,
    TimelineSlot,
    AmplifiedSideEffect,
    MedicineSearchResult
)

logger = logging.getLogger("mistral_parser")

MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

# =============================================================================
# 1. CURATED CLINICAL PHARMACOLOGY KNOWLEDGE BASE (60+ DRUGS & CLASSES)
# =============================================================================

COMMON_BRAND_MAPPINGS = {
    # NSAIDs & Analgesics
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "nurofen": "ibuprofen",
    "brufen": "ibuprofen",
    "caldolor": "ibuprofen",
    "tylenol": "paracetamol",
    "panadol": "paracetamol",
    "crocin": "paracetamol",
    "calpol": "paracetamol",
    "acetaminophen": "paracetamol",
    "apap": "paracetamol",
    "aspirin": "aspirin",
    "bayer": "aspirin",
    "ecotrin": "aspirin",
    "bufferin": "aspirin",
    "acetylsalicylic acid": "aspirin",
    "asa": "aspirin",
    "aleve": "naproxen",
    "naprosyn": "naproxen",
    "anaprox": "naproxen",
    "celebrex": "celecoxib",
    "voltaren": "diclofenac",
    "cataflam": "diclofenac",
    # Anticoagulants & Antiplatelets
    "coumadin": "warfarin",
    "jantoven": "warfarin",
    "plavix": "clopidogrel",
    "eliquis": "apixaban",
    "xarelto": "rivaroxaban",
    "pradaxa": "dabigatran",
    # Cardiovascular & Antihypertensives
    "lipitor": "atorvastatin",
    "crestor": "rosuvastatin",
    "zocor": "simvastatin",
    "norvasc": "amlodipine",
    "lopressor": "metoprolol",
    "toprol": "metoprolol",
    "toprol-xl": "metoprolol",
    "prinivil": "lisinopril",
    "zestril": "lisinopril",
    "cozaar": "losartan",
    "lasix": "furosemide",
    "hydrodiuril": "hydrochlorothiazide",
    # Gastrointestinal
    "prilosec": "omeprazole",
    "losec": "omeprazole",
    "zegerid": "omeprazole",
    "nexium": "esomeprazole",
    "prevacid": "lansoprazole",
    "protonix": "pantoprazole",
    "pepcid": "famotidine",
    # Endocrine & Diabetes
    "glucophage": "metformin",
    "fortamet": "metformin",
    "glumetza": "metformin",
    "riomet": "metformin",
    "synthroid": "levothyroxine",
    "levoxyl": "levothyroxine",
    "eltroxin": "levothyroxine",
    "tirosint": "levothyroxine",
    # Antibiotics & Respiratory
    "biaxin": "clarithromycin",
    "cipro": "ciprofloxacin",
    "proquin": "ciprofloxacin",
    "theochron": "theophylline",
    "uniphyl": "theophylline",
    "theo-24": "theophylline",
    "amoxil": "amoxicillin",
    "augmentin": "amoxicillin",
    "zanocin": "ofloxacin",
    "floxin": "ofloxacin",
    "zithromax": "azithromycin",
    "doryx": "doxycycline",
    "vibramycin": "doxycycline",
    # Mental Health / Psychotropics
    "prozac": "fluoxetine",
    "zoloft": "sertraline",
    "lexapro": "escitalopram",
    "xanax": "alprazolam",
    "valium": "diazepam",
    "ativan": "lorazepam",
    # Supplements & Substances
    "potassium chloride": "potassium",
    "k-dur": "potassium",
    "klor-con": "potassium",
    "micro-k": "potassium",
    "alcohol": "alcohol",
    "ethanol": "alcohol",
    "beer": "alcohol",
    "wine": "alcohol",
    "liquor": "alcohol",
}

SYNONYM_SETS = [
    {"paracetamol", "acetaminophen", "apap"},
    {"aspirin", "acetylsalicylic acid", "asa"},
    {"ibuprofen", "iso-butylpropanoic-phenolic acid"},
    {"potassium", "potassium chloride", "potassium supplement"},
    {"alcohol", "ethanol"},
]

# Curated high-yield clinical profiles for instant sub-second rich responses
CURATED_MEDICINE_PROFILES: Dict[str, Dict[str, Any]] = {
    "ibuprofen": {
        "name": "Ibuprofen",
        "generic_name": "ibuprofen",
        "brand_names": ["Advil", "Motrin", "Nurofen", "Brufen"],
        "category": "NSAID Analgesic & Anti-inflammatory",
        "drug_type": "otc",
        "dosage_forms": ["Oral Tablet", "Liquid Gel Capsule", "Oral Suspension"],
        "description": "Nonsteroidal anti-inflammatory drug (NSAID) used to relieve pain, fever, and inflammation by non-selectively inhibiting COX-1 and COX-2 enzymes.",
        "side_effects": [
            {"effect": "Dyspepsia / Stomach pain", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Nausea & Heartburn", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Dizziness / Lightheadedness", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Fluid retention / Mild edema", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Gastric ulceration & GI bleeding", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Gastrointestinal"},
            {"effect": "Renal impairment / Nephrotoxicity", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Renal"}
        ],
        "food_interactions": [
            {"type": "take_with_food", "title": "Take with Food or Milk", "description": "Always ingest with a meal, snack, or glass of milk to form a gastric protective barrier against mucosal irritation.", "severity": "recommended", "icon": "meal"},
            {"type": "avoid_alcohol", "title": "Avoid Alcohol", "description": "Alcohol exponentially accelerates gastric mucosal erosion and elevates the hazard of sudden GI hemorrhage.", "severity": "warning", "icon": "alcohol"}
        ],
        "gi_profile": {
            "stomach_health_score": 65,
            "risk_tier": "high",
            "nausea_risk": "moderate",
            "ulcer_risk": "high_with_prolonged_use",
            "bleeding_risk": "increased",
            "reflux_aggravation": True,
            "constipation_diarrhea": "mild_digestive_shift",
            "recommendations": [
                "Take with a substantial meal, milk, or antacid to buffer stomach acid.",
                "Do not lie flat for 15-30 minutes after taking to prevent esophageal reflux.",
                "If using daily for >2 weeks, consult a physician about a gastroprotective PPI (e.g. Omeprazole)."
            ]
        },
        "lifestyle_warnings": [
            "Maintain optimal hydration to prevent renal vasoconstriction.",
            "Avoid taking simultaneously with other over-the-counter NSAIDs (e.g. Aspirin, Naproxen)."
        ]
    },
    "aspirin": {
        "name": "Aspirin",
        "generic_name": "aspirin",
        "brand_names": ["Bayer", "Ecotrin", "Bufferin", "Disprin"],
        "category": "Antiplatelet & Salicylate NSAID",
        "drug_type": "otc",
        "dosage_forms": ["Enteric Coated Tablet", "Chewable Tablet", "Effervescent"],
        "description": "Irreversible cyclooxygenase inhibitor that prevents platelet aggregation to reduce myocardial infarction and stroke recurrence.",
        "side_effects": [
            {"effect": "Epigastric distress & Heartburn", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Easy bruising & minor bleeding", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Hematological"},
            {"effect": "Nausea & Gastritis", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Tinnitus (ringing in ears)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Otic"},
            {"effect": "Major gastrointestinal hemorrhage", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Gastrointestinal"}
        ],
        "food_interactions": [
            {"type": "take_with_food", "title": "Take with Food", "description": "Taking with food or a full glass of water minimizes direct stomach contact and irritation.", "severity": "recommended", "icon": "meal"},
            {"type": "avoid_alcohol", "title": "Strictly Limit Alcohol", "description": "Concurrent alcohol consumption increases the baseline risk of gastrointestinal bleeding by up to 4-fold.", "severity": "warning", "icon": "alcohol"}
        ],
        "gi_profile": {
            "stomach_health_score": 60,
            "risk_tier": "high",
            "nausea_risk": "moderate",
            "ulcer_risk": "high_with_prolonged_use",
            "bleeding_risk": "increased",
            "reflux_aggravation": True,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Consider enteric-coated tablets if experiencing chronic dyspepsia.",
                "Take with a full 8 oz glass of water to speed gastric transit.",
                "Seek immediate medical care if black/tarry stools or vomit resembling coffee grounds occurs."
            ]
        },
        "lifestyle_warnings": [
            "Inform dentists and surgeons of aspirin use prior to procedures.",
            "Do not administer to children or adolescents recovering from viral infections due to Reye's Syndrome risk."
        ]
    },
    "warfarin": {
        "name": "Warfarin",
        "generic_name": "warfarin",
        "brand_names": ["Coumadin", "Jantoven"],
        "category": "Vitamin K Antagonist Anticoagulant",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet"],
        "description": "Oral anticoagulant that inhibits vitamin K epoxide reductase, preventing clotting factor synthesis in atrial fibrillation, DVT, and heart valve replacement.",
        "side_effects": [
            {"effect": "Prolonged bleeding from minor cuts", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Hematological"},
            {"effect": "Easy bruising & epistaxis (nosebleeds)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Hematological"},
            {"effect": "Nausea, vomiting, mild diarrhea", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Major internal / intracranial hemorrhage", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Hematological"},
            {"effect": "Warfarin-induced skin necrosis", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Dermatological"}
        ],
        "food_interactions": [
            {"type": "avoid_alcohol", "title": "Avoid Binge Alcohol", "description": "Alcohol acutely inhibits Warfarin metabolism, drastically elevating INR and causing severe spontaneous bleeding risk.", "severity": "critical", "icon": "alcohol"},
            {"type": "avoid_grapefruit", "title": "Consistent Vitamin K Intake", "description": "Maintain a steady daily intake of green leafy vegetables (spinach, kale) rather than making sudden dietary swings.", "severity": "warning", "icon": "grapefruit"},
            {"type": "hydration", "title": "Avoid Cranberry Juice in Excess", "description": "Cranberry compounds can potentiate warfarin effect and alter anticoagulant control.", "severity": "recommended", "icon": "water"}
        ],
        "gi_profile": {
            "stomach_health_score": 35,
            "risk_tier": "moderate",
            "nausea_risk": "low",
            "ulcer_risk": "moderate",
            "bleeding_risk": "severe",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Warfarin does not directly erode mucosa, but any preexisting ulcer will bleed profusely.",
                "Strictly avoid combining with OTC NSAIDs (Advil, Aleve, Aspirin) without direct hematologist clearance.",
                "Adhere to regular INR clinic blood monitoring appointments."
            ]
        },
        "lifestyle_warnings": [
            "Use a soft-bristle toothbrush and electric razor to minimize tissue microtrauma.",
            "Wear a medical alert bracelet indicating anticoagulant therapy."
        ]
    },
    "paracetamol": {
        "name": "Paracetamol",
        "generic_name": "paracetamol",
        "brand_names": ["Tylenol", "Panadol", "Crocin", "Calpol", "Acetaminophen"],
        "category": "Centrally-Acting Analgesic & Antipyretic",
        "drug_type": "otc",
        "dosage_forms": ["Oral Tablet", "Caplet", "Syrup", "Suppository"],
        "description": "First-line pain reliever and fever reducer that acts centrally without inhibiting peripheral prostaglandin synthesis or irritating gastric mucosa.",
        "side_effects": [
            {"effect": "Nausea / mild abdominal discomfort", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Allergic skin rash / urticaria", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "moderate", "category": "Dermatological"},
            {"effect": "Acute hepatic toxicity / liver damage", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Hepatic"}
        ],
        "food_interactions": [
            {"type": "avoid_alcohol", "title": "Strictly Avoid Heavy Alcohol", "description": "Alcohol induces CYP2E1, converting Paracetamol into toxic NAPQI and causing severe acute liver injury.", "severity": "critical", "icon": "alcohol"},
            {"type": "take_with_food", "title": "Can Take With or Without Food", "description": "Exceptionally gentle on gastric mucosa; food is optional.", "severity": "recommended", "icon": "meal"}
        ],
        "gi_profile": {
            "stomach_health_score": 15,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Stomach-safe alternative for patients with a history of peptic ulcers or acid reflux.",
                "Never exceed the absolute maximum limit of 4,000 mg (4g) in a 24-hour period.",
                "Check all cold/flu combo products to avoid accidental double-dosing."
            ]
        },
        "lifestyle_warnings": [
            "Do not consume >3 alcoholic beverages daily while taking Paracetamol.",
            "Patients with pre-existing liver impairment must use reduced dosages (max 2g/day)."
        ]
    },
    "metformin": {
        "name": "Metformin",
        "generic_name": "metformin",
        "brand_names": ["Glucophage", "Fortamet", "Glumetza", "Riomet"],
        "category": "Biguanide Oral Antihyperglycemic",
        "drug_type": "prescription",
        "dosage_forms": ["Immediate Release Tablet", "Extended Release Tablet (XR)"],
        "description": "First-line medication for type 2 diabetes that decreases hepatic glucose production, decreases intestinal absorption, and improves insulin sensitivity.",
        "side_effects": [
            {"effect": "Diarrhea & loose stools", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Nausea, vomiting & abdominal gas", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Metallic taste in mouth", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Sensory"},
            {"effect": "Vitamin B12 deficiency (long term)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Nutritional"},
            {"effect": "Lactic Acidosis (rare, critical)", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Metabolic"}
        ],
        "food_interactions": [
            {"type": "take_with_food", "title": "Always Take with Main Meals", "description": "Taking metformin midway through meals substantially dampens nausea and severe intestinal cramping.", "severity": "recommended", "icon": "meal"},
            {"type": "avoid_alcohol", "title": "Strictly Avoid Alcohol Binging", "description": "Alcohol strongly inhibits lactate clearance, precipitating life-threatening lactic acidosis.", "severity": "critical", "icon": "alcohol"}
        ],
        "gi_profile": {
            "stomach_health_score": 45,
            "risk_tier": "moderate",
            "nausea_risk": "high",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea_likely",
            "recommendations": [
                "Start with low doses and titrate gradually to build gastrointestinal tolerance.",
                "Take with dinner or the largest meal of the day.",
                "Switching to Metformin XR (Extended Release) reduces GI adverse events by over 50%."
            ]
        },
        "lifestyle_warnings": [
            "Temporarily withhold before iodinated radiocontrast imaging procedures.",
            "Stay well hydrated during intense physical activity or hot weather."
        ]
    },
    "atorvastatin": {
        "name": "Atorvastatin",
        "generic_name": "atorvastatin",
        "brand_names": ["Lipitor", "Atorvaliq"],
        "category": "HMG-CoA Reductase Inhibitor (Statin)",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet"],
        "description": "Lipid-lowering agent that selectively inhibits HMG-CoA reductase to reduce LDL cholesterol, triglycerides, and cardiovascular event risk.",
        "side_effects": [
            {"effect": "Myalgia (muscle ache / stiffness)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Musculoskeletal"},
            {"effect": "Mild diarrhea or constipation", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Elevated liver enzymes (transaminases)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Hepatic"},
            {"effect": "Rhabdomyolysis & myoglobinuria", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Musculoskeletal"}
        ],
        "food_interactions": [
            {"type": "avoid_grapefruit", "title": "Avoid Grapefruit & Grapefruit Juice", "description": "Grapefruit inhibits intestinal CYP3A4, causing 300%+ increase in blood statin levels and severe muscle breakdown risk.", "severity": "warning", "icon": "grapefruit"},
            {"type": "avoid_alcohol", "title": "Moderate Alcohol Consumption", "description": "Heavy alcohol adds compounding stress on hepatic metabolic pathways.", "severity": "recommended", "icon": "alcohol"}
        ],
        "gi_profile": {
            "stomach_health_score": 20,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "mild_digestive_shift",
            "recommendations": [
                "Can be taken at any time of day, with or without food, but take consistently at the same time.",
                "Report unexplained muscle weakness or dark tea-colored urine to a physician immediately."
            ]
        },
        "lifestyle_warnings": [
            "Avoid co-administration with strong CYP3A4 inhibitors (e.g. Clarithromycin, Ketoconazole).",
            "Routine periodic baseline liver function testing is recommended."
        ]
    },
    "omeprazole": {
        "name": "Omeprazole",
        "generic_name": "omeprazole",
        "brand_names": ["Prilosec", "Losec", "Zegerid"],
        "category": "Proton Pump Inhibitor (Gastric Acid Reducer)",
        "drug_type": "otc",
        "dosage_forms": ["Delayed Release Capsule", "Oral Suspension"],
        "description": "Suppresses gastric acid secretion by specific inhibition of the H+/K+-ATPase enzyme system at the secretory surface of the gastric parietal cell.",
        "side_effects": [
            {"effect": "Headache", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Mild abdominal pain / flatulence", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Nausea / Diarrhea", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Hypomagnesemia / B12 malabsorption", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Nutritional"},
            {"effect": "Clostridium difficile-associated diarrhea", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Infectious"}
        ],
        "food_interactions": [
            {"type": "empty_stomach", "title": "Take 30-60 Minutes Before Breakfast", "description": "Must be taken on an empty stomach before the first meal so proton pumps are maximally inhibited during meal stimulation.", "severity": "recommended", "icon": "empty_stomach"}
        ],
        "gi_profile": {
            "stomach_health_score": 10,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Acts as an active stomach protector against NSAID-induced ulcers and GERD.",
                "Swallow capsules whole; do not crush or chew delayed-release pellets.",
                "Long-term use (>1 year) may impair absorption of calcium, magnesium, iron, and vitamin B12."
            ]
        },
        "lifestyle_warnings": [
            "Inhibits CYP2C19: can reduce the antiplatelet conversion of Clopidogrel (Plavix).",
            "Decreases stomach acidity: reduces absorption of Levothyroxine and antifungal azoles."
        ]
    },
    "levothyroxine": {
        "name": "Levothyroxine",
        "generic_name": "levothyroxine",
        "brand_names": ["Synthroid", "Levoxyl", "Eltroxin", "Tirosint"],
        "category": "Synthetic Thyroid Hormone (T4)",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet", "Oral Capsule"],
        "description": "Synthetic levo-isomer of thyroxine (T4) used for thyroid hormone replacement therapy in hypothyroidism and TSH suppression.",
        "side_effects": [
            {"effect": "Palpitations / Tachycardia (if overdosed)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Insomnia & Nervousness", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Heat intolerance / Sweating", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "General"},
            {"effect": "Weight loss / Increased appetite", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Metabolic"},
            {"effect": "Cardiac arrhythmias / Angina", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Cardiovascular"}
        ],
        "food_interactions": [
            {"type": "empty_stomach", "title": "Strict Empty Stomach First Thing in AM", "description": "Take with a full glass of water 60 minutes before breakfast to ensure reliable gastrointestinal absorption.", "severity": "critical", "icon": "empty_stomach"},
            {"type": "avoid_dairy_2h", "title": "Separate from Dairy, Calcium & Iron by 4 Hours", "description": "Calcium (milk, cheese), iron, and aluminum bind Levothyroxine in the gut, completely neutralizing its absorption.", "severity": "warning", "icon": "dairy"},
            {"type": "hydration", "title": "Separate Coffee / Espresso by 60 Minutes", "description": "Morning coffee significantly reduces oral T4 bioavailability.", "severity": "recommended", "icon": "water"}
        ],
        "gi_profile": {
            "stomach_health_score": 10,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Extremely gentle on stomach lining, but absorption is exceptionally fragile.",
                "Take at 7:00 AM on an empty stomach; eat breakfast at 8:00 AM.",
                "Maintain the exact same brand or generic formulation consistently."
            ]
        },
        "lifestyle_warnings": [
            "Do not take simultaneously with antacids, sucralfate, or multivitamin supplements.",
            "Periodic TSH blood monitoring is required to maintain euthyroid state."
        ]
    },
    "amlodipine": {
        "name": "Amlodipine",
        "generic_name": "amlodipine",
        "brand_names": ["Norvasc", "Katerzia"],
        "category": "Dihydropyridine Calcium Channel Blocker",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet"],
        "description": "Inhibits transmembrane influx of extracellular calcium ions into myocardial and vascular smooth muscle cells, causing coronary and peripheral vasodilation.",
        "side_effects": [
            {"effect": "Peripheral edema (ankle/foot swelling)", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Dizziness / Lightheadedness", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Flushing & Feeling hot", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Vascular"},
            {"effect": "Fatigue / Somnolence", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "General"},
            {"effect": "Gingival hyperplasia (gum enlargement)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Oral"}
        ],
        "food_interactions": [
            {"type": "avoid_grapefruit", "title": "Avoid Excessive Grapefruit Juice", "description": "Grapefruit can slightly increase amlodipine bioavailability, potentially causing precipitous drops in blood pressure.", "severity": "recommended", "icon": "grapefruit"},
            {"type": "take_with_food", "title": "Take With or Without Food", "description": "Food does not alter absorption; take consistently at the same time each day.", "severity": "recommended", "icon": "meal"}
        ],
        "gi_profile": {
            "stomach_health_score": 15,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": True,
            "constipation_diarrhea": "none",
            "recommendations": [
                "May occasionally relax the lower esophageal sphincter, exacerbating acid reflux in susceptible individuals.",
                "Elevate feet when resting if ankle swelling develops."
            ]
        },
        "lifestyle_warnings": [
            "Rise slowly from seated or lying positions to avoid orthostatic dizziness.",
            "Avoid combining with excessive alcohol which worsens vasodilation and postural hypotension."
        ]
    },
    "metoprolol": {
        "name": "Metoprolol",
        "generic_name": "metoprolol",
        "brand_names": ["Lopressor", "Toprol-XL"],
        "category": "Cardioselective Beta-1 Adrenergic Blocker",
        "drug_type": "prescription",
        "dosage_forms": ["Tartrate Tablet (Immediate)", "Succinate Tablet (Extended Release)"],
        "description": "Selective beta-1 blocker that decreases heart rate, cardiac output, and blood pressure to treat hypertension, angina, and heart failure.",
        "side_effects": [
            {"effect": "Bradycardia (slow heart rate)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Fatigue & Exercise intolerance", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "General"},
            {"effect": "Dizziness / Postural hypotension", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Cold extremities (hands/feet)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Vascular"},
            {"effect": "Bronchospasm in asthmatic patients", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "severe", "category": "Respiratory"}
        ],
        "food_interactions": [
            {"type": "take_with_food", "title": "Take With or Immediately After Meals", "description": "Food significantly enhances the systemic bioavailability of Metoprolol Tartrate; take with breakfast/dinner.", "severity": "recommended", "icon": "meal"},
            {"type": "avoid_alcohol", "title": "Limit Alcohol", "description": "Alcohol enhances hypotensive effects, causing severe dizziness and drowsiness.", "severity": "warning", "icon": "alcohol"}
        ],
        "gi_profile": {
            "stomach_health_score": 15,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Gentle on gastric mucosa; food is primarily needed for optimal pharmacological absorption.",
                "Do not abruptly discontinue taking metoprolol; taper slowly under medical supervision to avoid rebound tachycardia."
            ]
        },
        "lifestyle_warnings": [
            "Monitor resting pulse rate; report heart rates consistently under 50 bpm.",
            "May mask autonomic symptoms of hypoglycemia (e.g. tremors, palpitations) in diabetic patients."
        ]
    },
    "clopidogrel": {
        "name": "Clopidogrel",
        "generic_name": "clopidogrel",
        "brand_names": ["Plavix"],
        "category": "P2Y12 Platelet Inhibitor",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet"],
        "description": "Thienopyridine prodrug that selectively inhibits ADP binding to platelet P2Y12 receptors, preventing glycoprotein IIb/IIIa activation and clot formation.",
        "side_effects": [
            {"effect": "Bleeding & Hematoma", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Hematological"},
            {"effect": "Purpura / Skin Bruising", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Dermatological"},
            {"effect": "Epistaxis (nosebleeds)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Hematological"},
            {"effect": "Gastrointestinal hemorrhage", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "severe", "category": "Gastrointestinal"},
            {"effect": "Thrombotic Thrombocytopenic Purpura (TTP)", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Hematological"}
        ],
        "food_interactions": [
            {"type": "avoid_alcohol", "title": "Avoid Alcohol", "description": "Alcohol elevates GI bleeding risk while on antiplatelet therapy.", "severity": "warning", "icon": "alcohol"},
            {"type": "take_with_food", "title": "Take With or Without Food", "description": "Food does not affect absorption.", "severity": "recommended", "icon": "meal"}
        ],
        "gi_profile": {
            "stomach_health_score": 35,
            "risk_tier": "moderate",
            "nausea_risk": "low",
            "ulcer_risk": "moderate",
            "bleeding_risk": "severe",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Avoid pairing with Omeprazole; Omeprazole blocks the CYP2C19 enzyme needed to activate Clopidogrel.",
                "If stomach protection is needed, ask your doctor about Pantoprazole or Famotidine."
            ]
        },
        "lifestyle_warnings": [
            "Do not combine with OTC NSAIDs (Advil, Aleve) without strict cardiologist guidance."
        ]
    },
    "ciprofloxacin": {
        "name": "Ciprofloxacin",
        "generic_name": "ciprofloxacin",
        "brand_names": ["Cipro", "Proquin XR"],
        "category": "Fluoroquinolone Antibacterial",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet", "Ophthalmic / Otic Solution", "IV"],
        "description": "Broad-spectrum fluoroquinolone that inhibits bacterial DNA gyrase and topoisomerase IV, preventing DNA replication.",
        "side_effects": [
            {"effect": "Nausea & Diarrhea", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Dizziness & Headache", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Tendinitis & Tendon Rupture (Black Box)", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Musculoskeletal"},
            {"effect": "Peripheral Neuropathy / Nerve pain", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Neurological"},
            {"effect": "QT Interval Prolongation", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Cardiovascular"}
        ],
        "food_interactions": [
            {"type": "avoid_dairy_2h", "title": "Do NOT Take with Dairy or Calcium Fortified Juice", "description": "Calcium, magnesium, and aluminum chelate ciprofloxacin in the gut, reducing absorption by up to 90%. Take 2h before or 6h after dairy.", "severity": "critical", "icon": "dairy"},
            {"type": "hydration", "title": "Drink Plentiful Water", "description": "Ensure vigorous hydration to prevent crystalluria (crystal formation in urine).", "severity": "recommended", "icon": "water"}
        ],
        "gi_profile": {
            "stomach_health_score": 35,
            "risk_tier": "moderate",
            "nausea_risk": "moderate",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea_likely",
            "recommendations": [
                "Take with meals to alleviate nausea, but ensure meals are free of milk, yogurt, and cheese.",
                "Take a probiotic supplement separated by 3 hours to replenish beneficial gut microbiome."
            ]
        },
        "lifestyle_warnings": [
            "Avoid strenuous exercise; stop immediately if pain, swelling, or inflammation occurs in the Achilles tendon.",
            "Increases sun sensitivity: wear protective clothing and SPF 50 sunscreen."
        ]
    },
    "alcohol": {
        "name": "Alcohol",
        "generic_name": "alcohol",
        "brand_names": ["Beer", "Wine", "Liquor", "Ethanol"],
        "category": "CNS Depressant & Gastric Irritant",
        "drug_type": "supplement",
        "dosage_forms": ["Liquid Beverage"],
        "description": "Central nervous system depressant and systemic metabolic disruptor that alters gastric mucosal integrity and drug biotransformation.",
        "side_effects": [
            {"effect": "Gastric mucosal erosion & Acid stimulation", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Central nervous system depression / Sedation", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Neurological"},
            {"effect": "Impaired motor coordination & reaction time", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Neurological"},
            {"effect": "Acute hepatic metabolic overload", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Hepatic"}
        ],
        "food_interactions": [
            {"type": "take_with_food", "title": "Never Ingest on Empty Stomach", "description": "Consuming alcohol without food drastically accelerates gastric absorption and mucosal ulceration.", "severity": "warning", "icon": "meal"}
        ],
        "gi_profile": {
            "stomach_health_score": 60,
            "risk_tier": "high",
            "nausea_risk": "high",
            "ulcer_risk": "high_with_prolonged_use",
            "bleeding_risk": "increased",
            "reflux_aggravation": True,
            "constipation_diarrhea": "diarrhea_likely",
            "recommendations": [
                "Directly erodes the stomach protective mucous lining.",
                "Synergistically amplifies gastric ulcer risk when combined with any NSAID (Ibuprofen, Aspirin).",
                "Causes dangerous lactic acidosis when combined with Metformin."
            ]
        },
        "lifestyle_warnings": [
            "Do not drive or operate machinery.",
            "Avoid combining with sedatives, narcotics, or antihistamines."
        ]
    }
}

# =============================================================================
# 2. DETERMINISTIC CLINICAL RULES & DETAILED MECHANISMS
# =============================================================================

KNOWN_CLINICAL_RULES = [
    {
        "drugs": {"warfarin", "aspirin"},
        "severity": "high",
        "explanation": "Combining Warfarin (an anticoagulant) with Aspirin (an antiplatelet agent) significantly amplifies the risk of major internal and gastrointestinal bleeding. Co-administration requires strict medical supervision and INR monitoring.",
        "mechanism": "Dual-pathway hemostatic blockade: Warfarin blocks coagulation factors II, VII, IX, X via Vitamin K inhibition while Aspirin irreversibly inhibits platelet aggregation via COX-1.",
        "clinical_impact": "Dramatically increased hazard of major internal, gastrointestinal, and intracranial hemorrhage.",
        "stomach_impact": "Aspirin directly erodes gastric mucosa and causes micro-ulcers; Warfarin prevents clotting, causing severe continuous GI bleeding.",
        "food_consideration": "Strictly avoid alcohol; maintain steady Vitamin K diet.",
        "action_guidance": "Consult cardiologist before combining. Never add OTC Aspirin without explicit prescription."
    },
    {
        "drugs": {"warfarin", "ibuprofen"},
        "severity": "high",
        "explanation": "Ibuprofen is an NSAID that irritates the stomach lining and inhibits platelet aggregation, dramatically elevating the risk of severe gastrointestinal hemorrhage when taken alongside Warfarin.",
        "mechanism": "Ibuprofen inhibits protective gastric prostaglandins and reversibly blocks platelets, compounded by Warfarin systemic anticoagulation.",
        "clinical_impact": "High risk of rapid, severe gastrointestinal ulceration and hemorrhage.",
        "stomach_impact": "Extreme gastric stress: NSAID mucosal damage paired with anticoagulant bleeding synergy.",
        "food_consideration": "Avoid alcohol; take with meals if doctor prescribes an alternative pain reliever.",
        "action_guidance": "Substitute with Paracetamol (Acetaminophen) for mild pain/fever relief."
    },
    {
        "drugs": {"aspirin", "ibuprofen"},
        "severity": "moderate",
        "explanation": "Ibuprofen may competitively interfere with the antiplatelet cardioprotective effect of low-dose Aspirin. Concurrent use also increases the risk of gastrointestinal ulcers and stomach irritation.",
        "mechanism": "Ibuprofen competitively blocks Aspirin access to the COX-1 catalytic site (Ser529), neutralizing cardioprotective platelet inhibition.",
        "clinical_impact": "Loss of Aspirin stroke/heart attack protection + doubled rate of gastric mucosal injury.",
        "stomach_impact": "Additive dual-NSAID stomach ulceration and acid irritation.",
        "food_consideration": "Always take with food.",
        "action_guidance": "Take immediate-release Aspirin at least 30-60 minutes BEFORE Ibuprofen, or 8 hours AFTER."
    },
    {
        "drugs": {"metformin", "alcohol"},
        "severity": "high",
        "explanation": "Alcohol potentiates the effect of Metformin on lactate metabolism, significantly increasing the risk of potentially life-threatening lactic acidosis and severe hypoglycemia.",
        "mechanism": "Alcohol oxidation consumes NAD+, shifting pyruvate to lactate while Metformin inhibits mitochondrial complex I.",
        "clinical_impact": "Life-threatening metabolic lactic acidosis (nausea, severe weakness, hyperventilation, cardiac arrest).",
        "stomach_impact": "Compounded nausea, persistent diarrhea, and severe abdominal cramping.",
        "food_consideration": "Completely avoid binge drinking or chronic heavy alcohol intake.",
        "action_guidance": "Seek emergency medical care if sudden malaise, muscle ache, or rapid breathing occurs."
    },
    {
        "drugs": {"atorvastatin", "clarithromycin"},
        "severity": "high",
        "explanation": "Strong CYP3A4 inhibitors like Clarithromycin can significantly increase blood concentrations of Atorvastatin, elevating the risk of myopathy and severe muscle breakdown (rhabdomyolysis).",
        "mechanism": "Clarithromycin potent CYP3A4 inhibition blocks Atorvastatin hepatic first-pass metabolism, elevating statin AUC by up to 400%.",
        "clinical_impact": "Acute rhabdomyolysis, renal failure, and severe muscle pain.",
        "stomach_impact": "Moderate nausea and digestive disturbance.",
        "food_consideration": "Avoid grapefruit juice completely.",
        "action_guidance": "Temporarily suspend Atorvastatin therapy during the course of Clarithromycin antibiotic treatment."
    },
    {
        "drugs": {"omeprazole", "clopidogrel"},
        "severity": "moderate",
        "explanation": "Omeprazole inhibits the CYP2C19 enzyme responsible for activating Clopidogrel, potentially reducing its cardiovascular antiplatelet efficacy.",
        "mechanism": "Competitive inhibition of CYP2C19 prevents bioactivation of Clopidogrel prodrug into active thiol metabolite.",
        "clinical_impact": "Decreased antiplatelet protection, increasing risk of recurrent myocardial infarction or stent thrombosis.",
        "stomach_impact": "Omeprazole protects stomach, but reduces heart protection.",
        "food_consideration": "Take PPI before breakfast.",
        "action_guidance": "Ask cardiologist to switch Omeprazole to Pantoprazole (Protonix) or Famotidine (Pepcid)."
    },
    {
        "drugs": {"levothyroxine", "omeprazole"},
        "severity": "moderate",
        "explanation": "Proton pump inhibitors like Omeprazole decrease stomach acidity, which can impair the gastrointestinal absorption and efficacy of Levothyroxine.",
        "mechanism": "Elevated gastric pH reduces Levothyroxine dissolution and intestinal transport across mucosal epithelium.",
        "clinical_impact": "Sub-therapeutic thyroid levels resulting in fatigue, weight gain, and elevated TSH.",
        "stomach_impact": "None direct; altered pH affects thyroid absorption.",
        "food_consideration": "Take Levothyroxine on empty stomach at 7 AM; take Omeprazole 30m before breakfast at 8 AM.",
        "action_guidance": "Monitor TSH levels periodically if starting or stopping Omeprazole."
    },
    {
        "drugs": {"metoprolol", "amlodipine"},
        "severity": "moderate",
        "explanation": "Concurrent use of a beta-blocker (Metoprolol) and a calcium channel blocker (Amlodipine) can cause additive blood pressure lowering and enhanced negative chronotropic effects, increasing risk of dizziness or bradycardia.",
        "mechanism": "Additive arterial vasodilation plus myocardial calcium channel/beta-adrenergic blockade.",
        "clinical_impact": "Excessive hypotension, lightheadedness, fatigue, and symptomatic bradycardia.",
        "stomach_impact": "Minimal direct GI load; possible mild reflux from amlodipine.",
        "food_consideration": "Take metoprolol with meals; avoid excessive alcohol.",
        "action_guidance": "Monitor resting heart rate and blood pressure; rise slowly from sitting."
    },
    {
        "drugs": {"paracetamol", "alcohol"},
        "severity": "moderate",
        "explanation": "Regular or excessive alcohol consumption during Paracetamol (Acetaminophen) therapy significantly heightens the risk of acute hepatic toxicity and liver damage.",
        "mechanism": "Alcohol induces CYP2E1 enzyme while depleting hepatic glutathione stores, accumulating toxic NAPQI metabolite.",
        "clinical_impact": "Acute hepatic necrosis and liver enzyme elevation.",
        "stomach_impact": "Moderate stomach irritation from alcohol.",
        "food_consideration": "Do not combine alcoholic drinks with paracetamol.",
        "action_guidance": "Limit paracetamol to max 2,000 mg/day if alcohol was recently consumed."
    },
    {
        "drugs": {"paracetamol", "warfarin"},
        "severity": "low",
        "explanation": "Occasional low doses of Paracetamol are generally safe with Warfarin, but chronic or high-dose usage (>2g/day for multiple days) may prolong the INR and slightly increase bleeding risk.",
        "mechanism": "Paracetamol metabolite NAPQI may slightly inhibit vitamin K-dependent clotting factor carboxylation.",
        "clinical_impact": "Mild increase in INR with sustained daily use.",
        "stomach_impact": "Gentle on stomach — superior choice over NSAIDs for warfarin patients.",
        "food_consideration": "Maintain steady diet.",
        "action_guidance": "Safe for occasional pain. If taking daily for >3 days, check INR."
    },
    {
        "drugs": {"lisinopril", "potassium"},
        "severity": "high",
        "explanation": "ACE inhibitors reduce aldosterone secretion, decreasing potassium excretion. Concomitant potassium supplementation can cause dangerous hyperkalemia.",
        "mechanism": "Inhibition of Angiotensin II synthesis decreases aldosterone, causing renal potassium retention.",
        "clinical_impact": "Severe hyperkalemia leading to cardiac arrhythmias and muscle weakness.",
        "stomach_impact": "Potassium pills can cause GI upset.",
        "food_consideration": "Avoid high-potassium salt substitutes.",
        "action_guidance": "Do not take potassium supplements without serum potassium monitoring."
    },
    {
        "drugs": {"ciprofloxacin", "theophylline"},
        "severity": "high",
        "explanation": "Ciprofloxacin inhibits the hepatic metabolism of Theophylline, causing toxic blood levels of Theophylline leading to nausea, cardiac arrhythmias, and seizures.",
        "mechanism": "Ciprofloxacin strongly inhibits CYP1A2, reducing theophylline clearance by up to 50%.",
        "clinical_impact": "Theophylline toxicity: tremors, persistent vomiting, supraventricular arrhythmias, seizures.",
        "stomach_impact": "Severe nausea and vomiting.",
        "food_consideration": "Avoid caffeine (also CYP1A2 substrate).",
        "action_guidance": "Reduce theophylline dosage by 50% and monitor serum levels closely."
    }
]

# =============================================================================
# 3. CLINICAL ALIAS RESOLUTION & PROFILING ENGINE
# =============================================================================

def resolve_drug_aliases(drug_name: str, label: Optional[Dict[str, Any]] = None) -> Set[str]:
    """Resolve a drug name to all its known generic, brand, substance, and synonym aliases."""
    cleaned = drug_name.strip().lower()
    aliases = {cleaned}

    if cleaned in COMMON_BRAND_MAPPINGS:
        aliases.add(COMMON_BRAND_MAPPINGS[cleaned])

    for syn_set in SYNONYM_SETS:
        if any(item in aliases for item in syn_set):
            aliases.update(syn_set)

    if label:
        gen = label.get("generic_name")
        if gen:
            aliases.add(gen.lower().strip())
        for b in label.get("brand_names", []):
            if b:
                aliases.add(b.lower().strip())
        for s in label.get("substance_names", []):
            if s:
                aliases.add(s.lower().strip())

    for syn_set in SYNONYM_SETS:
        if any(item in aliases for item in syn_set):
            aliases.update(syn_set)

    return aliases

def get_primary_generic_name(drug_name: str, label: Optional[Dict[str, Any]] = None) -> str:
    """Get the most accurate primary generic name for display and lookups."""
    cleaned = drug_name.strip().lower()
    if cleaned in COMMON_BRAND_MAPPINGS:
        return COMMON_BRAND_MAPPINGS[cleaned]
    if label and label.get("generic_name"):
        return label["generic_name"].lower().strip()
    return cleaned

def get_or_build_medicine_profile(drug_name: str, label: Optional[Dict[str, Any]] = None) -> MedicineProfileResponse:
    """
    Retrieve curated clinical profile or dynamically build one from openFDA label data.
    """
    generic_key = get_primary_generic_name(drug_name, label)
    
    # 1. Check curated knowledge base
    if generic_key in CURATED_MEDICINE_PROFILES:
        data = CURATED_MEDICINE_PROFILES[generic_key]
        return MedicineProfileResponse(
            name=drug_name.capitalize(),
            generic_name=data["generic_name"],
            brand_names=data.get("brand_names", []),
            category=data.get("category", "General Medication"),
            drug_type=data.get("drug_type", "prescription"),
            dosage_forms=data.get("dosage_forms", ["Oral Tablet"]),
            description=data.get("description", ""),
            side_effects=[SideEffectDetail(**se) for se in data.get("side_effects", [])],
            food_interactions=[FoodInteractionDetail(**fi) for fi in data.get("food_interactions", [])],
            gi_profile=GIProfile(**data["gi_profile"]),
            lifestyle_warnings=data.get("lifestyle_warnings", [])
        )

    # 2. Dynamic Fallback Profile Generation from openFDA Label
    raw_text = label.get("raw_text_summary", "") if label else ""
    raw_lower = raw_text.lower()
    
    # Heuristic GI analysis
    gi_score = 25
    nausea_risk = "low"
    ulcer_risk = "low"
    bleeding_risk = "none"
    reflux = False
    diarrhea_const = "none"
    recs = ["Take with a full glass of water.", "Consult your healthcare provider for dosage timing."]

    if any(k in raw_lower for k in ["bleeding", "hemorrhage", "ulcer", "erosion"]):
        gi_score += 35
        ulcer_risk = "moderate"
        bleeding_risk = "increased"
        recs.append("Take with meals to buffer against stomach discomfort.")
    if any(k in raw_lower for k in ["nausea", "vomiting", "dyspepsia", "heartburn"]):
        gi_score += 20
        nausea_risk = "moderate"
        reflux = True
    if "diarrhea" in raw_lower:
        diarrhea_const = "diarrhea_likely"
    elif "constipation" in raw_lower:
        diarrhea_const = "constipation_likely"

    gi_score = min(100, max(10, gi_score))
    risk_tier = "gentle" if gi_score <= 30 else ("moderate" if gi_score <= 60 else "high")

    # Generate side effects list
    side_effects = [
        SideEffectDetail(effect="Nausea / GI Upset", frequency="common", frequency_percentage="1-10%", severity="mild", category="Gastrointestinal"),
        SideEffectDetail(effect="Headache", frequency="common", frequency_percentage="1-10%", severity="mild", category="Neurological"),
        SideEffectDetail(effect="Dizziness / Fatigue", frequency="uncommon", frequency_percentage="0.1-1%", severity="mild", category="General"),
        SideEffectDetail(effect="Allergic rash / Pruritus", frequency="rare", frequency_percentage="<0.1%", severity="moderate", category="Dermatological")
    ]

    food_ints = [
        FoodInteractionDetail(type="take_with_food", title="Take with Meals", description="Taking medication alongside food reduces potential stomach irritation.", severity="recommended", icon="meal"),
        FoodInteractionDetail(type="avoid_alcohol", title="Moderate Alcohol", description="Alcohol can alter medication biotransformation and worsen adverse effects.", severity="warning", icon="alcohol")
    ]

    return MedicineProfileResponse(
        name=drug_name.capitalize(),
        generic_name=generic_key,
        brand_names=label.get("brand_names", []) if label else [],
        category="Prescription / Therapeutic Agent",
        drug_type="prescription",
        dosage_forms=["Oral Tablet", "Capsule"],
        description=f"Therapeutic medication: {generic_key.capitalize()}. Consult clinical documentation for detailed pharmacokinetics.",
        side_effects=side_effects,
        food_interactions=food_ints,
        gi_profile=GIProfile(
            stomach_health_score=gi_score,
            risk_tier=risk_tier,
            nausea_risk=nausea_risk,
            ulcer_risk=ulcer_risk,
            bleeding_risk=bleeding_risk,
            reflux_aggravation=reflux,
            constipation_diarrhea=diarrhea_const,
            recommendations=recs
        ),
        lifestyle_warnings=["Stay hydrated and report adverse events to your doctor."]
    )

# =============================================================================
# 4. COMPOSITE STOMACH GUARDIAN ALGORITHM
# =============================================================================

def calculate_composite_gi_score(
    basket_drugs: List[str],
    profiles: Dict[str, MedicineProfileResponse]
) -> Tuple[int, str, List[Dict[str, Any]], List[str]]:
    """
    Computes the composite Stomach Guardian Risk Score (0-100), risk tier,
    individual contributors breakdown, and actionable clinical advice.
    """
    if not basket_drugs:
        return 10, "gentle", [], ["Your medicine basket is currently empty."]

    drug_scores = {}
    total_raw = 0
    all_categories = []
    has_nsaid = False
    nsaid_count = 0
    has_anticoagulant = False
    has_ppi = False
    has_alcohol = False

    for drug in basket_drugs:
        prof = profiles.get(drug)
        if not prof:
            prof = get_or_build_medicine_profile(drug)
        
        score = prof.gi_profile.stomach_health_score
        drug_scores[drug] = score
        total_raw += score
        
        cat = prof.category.lower()
        all_categories.append(cat)
        
        if "nsaid" in cat or prof.generic_name in ["ibuprofen", "aspirin", "naproxen", "diclofenac", "celecoxib"]:
            has_nsaid = True
            nsaid_count += 1
        if "anticoagulant" in cat or "antiplatelet" in cat or prof.generic_name in ["warfarin", "clopidogrel", "apixaban", "rivaroxaban"]:
            has_anticoagulant = True
        if "proton pump" in cat or "ppi" in cat or prof.generic_name in ["omeprazole", "esomeprazole", "pantoprazole", "lansoprazole"]:
            has_ppi = True
        if prof.generic_name == "alcohol":
            has_alcohol = True

    # Base weighted average of individual GI scores
    avg_score = total_raw / len(basket_drugs)

    # Compounding Multipliers
    penalty = 0
    recs = []

    if nsaid_count >= 2:
        penalty += 25
        recs.append("⚠️ Dual-NSAID Hazard: Combining multiple anti-inflammatory drugs substantially elevates the risk of severe gastric ulceration and stomach bleeding.")
    
    if has_nsaid and has_anticoagulant:
        penalty += 30
        recs.append("🚨 Anticoagulant + NSAID Synergy: NSAIDs damage the protective stomach lining while anticoagulants prevent clotting, creating a critical bleeding hazard.")

    if has_nsaid and has_alcohol:
        penalty += 20
        recs.append("🍷 Alcohol + NSAID Risk: Alcohol accelerates mucosal erosion. Strictly avoid alcohol while taking anti-inflammatory medications.")

    if has_ppi:
        # PPI stomach protective relief
        penalty -= 20
        recs.append("🛡️ Gastroprotective Benefit: Presence of a Proton Pump Inhibitor (e.g. Omeprazole) actively buffers stomach acid and lowers ulcer risk.")

    composite = int(min(100, max(10, avg_score + penalty)))
    
    tier = "gentle" if composite <= 30 else ("moderate" if composite <= 60 else "high")

    # Calculate percentage contributions
    contributors = []
    total_for_pct = sum(drug_scores.values()) or 1
    for drug, sc in drug_scores.items():
        pct = int(round((sc / total_for_pct) * 100))
        contributors.append({
            "drug": drug.capitalize(),
            "score": sc,
            "percentage": pct,
            "tier": "high" if sc > 50 else ("moderate" if sc > 25 else "gentle")
        })

    # Sort contributors highest risk first
    contributors.sort(key=lambda x: x["score"], reverse=True)

    if not recs:
        if tier == "gentle":
            recs.append("Your current medication basket is gentle on the gastrointestinal tract.")
        elif tier == "moderate":
            recs.append("Consider taking medications with a meal to minimize digestive sensitivity.")
        else:
            recs.append("Ask your doctor or pharmacist about co-prescribing stomach protection if taking daily.")

    return composite, tier, contributors, recs

# =============================================================================
# 5. SIDE EFFECT AMPLIFICATION RADAR
# =============================================================================

def detect_side_effect_amplifications(
    basket_drugs: List[str],
    profiles: Dict[str, MedicineProfileResponse]
) -> List[AmplifiedSideEffect]:
    """
    Identifies when multiple basket medications compound the same clinical adverse effect.
    """
    amplified_list = []
    if len(basket_drugs) < 2:
        return amplified_list

    # Known synergy clinical patterns
    generic_names = [profiles[d].generic_name for d in basket_drugs if d in profiles]

    # Pattern 1: GI Bleeding / Stomach Damage
    bleeding_drugs = [d for d in basket_drugs if profiles.get(d) and (
        profiles[d].gi_profile.bleeding_risk in ["increased", "severe"] or
        "nsaid" in profiles[d].category.lower() or
        profiles[d].generic_name in ["warfarin", "aspirin", "ibuprofen", "naproxen", "clopidogrel", "alcohol"]
    )]
    if len(bleeding_drugs) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Gastrointestinal Bleeding & Mucosal Ulceration",
            sources=[d.capitalize() for d in bleeding_drugs],
            severity="critical" if any(profiles[d].generic_name in ["warfarin", "clopidogrel"] for d in bleeding_drugs) else "high",
            amplified=True,
            clinical_note="Compounded platelet inhibition and gastric mucosal erosion elevate the risk of major internal GI bleeding."
        ))

    # Pattern 2: Drowsiness / CNS Depression
    sedative_drugs = [d for d in basket_drugs if profiles.get(d) and (
        any("drowsiness" in se.effect.lower() or "somnolence" in se.effect.lower() or "sedation" in se.effect.lower() for se in profiles[d].side_effects) or
        profiles[d].generic_name in ["alcohol", "alprazolam", "lorazepam", "diazepam", "cetirizine", "diphenhydramine"]
    )]
    if len(sedative_drugs) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Drowsiness & Central Nervous System Depression",
            sources=[d.capitalize() for d in sedative_drugs],
            severity="high",
            amplified=True,
            clinical_note="Combined sedative effects impair cognitive reflexes and reaction time. Strictly avoid driving or operating heavy machinery."
        ))

    # Pattern 3: Hypotension / Orthostatic Dizziness
    bp_drugs = [d for d in basket_drugs if profiles.get(d) and (
        "blocker" in profiles[d].category.lower() or
        "inhibitor" in profiles[d].category.lower() or
        profiles[d].generic_name in ["amlodipine", "metoprolol", "lisinopril", "losartan", "furosemide"]
    )]
    if len(bp_drugs) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Hypotension & Orthostatic Dizziness",
            sources=[d.capitalize() for d in bp_drugs],
            severity="moderate",
            amplified=True,
            clinical_note="Additive blood pressure reduction can cause postural lightheadedness and fainting when standing up quickly."
        ))

    # Pattern 4: Hepatic Stress
    liver_drugs = [d for d in basket_drugs if profiles.get(d) and (
        profiles[d].generic_name in ["paracetamol", "alcohol", "atorvastatin", "simvastatin", "methotrexate"]
    )]
    if len(liver_drugs) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Hepatic Stress & Liver Enzyme Elevation",
            sources=[d.capitalize() for d in liver_drugs],
            severity="high" if "alcohol" in [profiles[d].generic_name for d in liver_drugs] else "moderate",
            amplified=True,
            clinical_note="Dual hepatic metabolic load increases strain on liver enzymes (ALT/AST). Avoid alcohol and excess dosing."
        ))

    # Pattern 5: Hyperkalemia
    k_drugs = [d for d in basket_drugs if profiles.get(d) and (
        profiles[d].generic_name in ["lisinopril", "potassium", "spironolactone", "losartan"]
    )]
    if len(k_drugs) >= 2:
        amplified_list.append(AmplifiedSideEffect(
            effect="Hyperkalemia (Elevated Blood Potassium)",
            sources=[d.capitalize() for d in k_drugs],
            severity="critical",
            amplified=True,
            clinical_note="Reduced potassium excretion combined with potassium retention can trigger cardiac arrhythmias."
        ))

    return amplified_list

# =============================================================================
# 6. FOOD CONFLICTS & DAILY TIMELINE GENERATOR
# =============================================================================

def generate_food_conflicts_and_timeline(
    basket_drugs: List[str],
    profiles: Dict[str, MedicineProfileResponse]
) -> Tuple[List[FoodConflictDetail], List[TimelineSlot]]:
    """
    Detects food timing contradictions and builds a recommended 24-hour daily timeline.
    """
    conflicts = []
    
    empty_stomach_drugs = []
    with_food_drugs = []
    dairy_restricted_drugs = []
    grapefruit_drugs = []
    alcohol_restricted_drugs = []

    for drug in basket_drugs:
        prof = profiles.get(drug)
        if not prof:
            continue
        gen = prof.generic_name
        
        for fi in prof.food_interactions:
            if fi.type == "empty_stomach":
                empty_stomach_drugs.append(drug.capitalize())
            elif fi.type == "take_with_food":
                with_food_drugs.append(drug.capitalize())
            elif fi.type == "avoid_dairy_2h":
                dairy_restricted_drugs.append(drug.capitalize())
            elif fi.type == "avoid_grapefruit":
                grapefruit_drugs.append(drug.capitalize())
            elif fi.type == "avoid_alcohol":
                alcohol_restricted_drugs.append(drug.capitalize())

    # Detect Scheduling Conflicts
    if empty_stomach_drugs and with_food_drugs:
        conflicts.append(FoodConflictDetail(
            medicine_a=", ".join(empty_stomach_drugs),
            medicine_b=", ".join(with_food_drugs),
            conflict_type="meal_timing_conflict",
            conflict=f"{', '.join(empty_stomach_drugs)} requires an empty stomach, whereas {', '.join(with_food_drugs)} requires food to avoid stomach irritation.",
            recommended_schedule=f"Take {', '.join(empty_stomach_drugs)} immediately upon waking (7:00 AM); eat breakfast and take {', '.join(with_food_drugs)} at 8:30 AM."
        ))

    if dairy_restricted_drugs:
        conflicts.append(FoodConflictDetail(
            medicine_a=", ".join(dairy_restricted_drugs),
            medicine_b="Dairy Products (Milk/Cheese)",
            conflict_type="calcium_chelation",
            conflict=f"{', '.join(dairy_restricted_drugs)} binds with calcium in dairy, reducing antibiotic/hormone absorption by up to 90%.",
            recommended_schedule="Separate dairy consumption by at least 2 hours before or 4 hours after taking these medications."
        ))

    # Build 24-Hour Visual Daily Timeline
    timeline = []

    if empty_stomach_drugs:
        timeline.append(TimelineSlot(
            time="7:00 AM",
            title=f"Morning Dose: {', '.join(empty_stomach_drugs)}",
            medicine=", ".join(empty_stomach_drugs),
            action_type="med_empty_stomach",
            icon="sunrise",
            note="Take with a full 8 oz glass of plain water at least 60 minutes before food."
        ))

    timeline.append(TimelineSlot(
        time="8:30 AM",
        title="Breakfast",
        medicine=None,
        action_type="meal",
        icon="utensils",
        note="Balanced morning meal."
    ))

    if with_food_drugs:
        # Separate morning with-food meds
        morning_with_food = [d for d in with_food_drugs if d not in ["Metformin", "Omeprazole"]]
        if morning_with_food:
            timeline.append(TimelineSlot(
                time="8:45 AM",
                title=f"With-Food Dose: {', '.join(morning_with_food)}",
                medicine=", ".join(morning_with_food),
                action_type="med_with_food",
                icon="pill",
                note="Take during or immediately following breakfast to buffer stomach lining."
            ))

    timeline.append(TimelineSlot(
        time="1:00 PM",
        title="Lunch",
        medicine=None,
        action_type="meal",
        icon="utensils",
        note="Midday meal."
    ))

    if dairy_restricted_drugs:
        timeline.append(TimelineSlot(
            time="2:00 PM",
            title=f"Midday Dose: {', '.join(dairy_restricted_drugs)}",
            medicine=", ".join(dairy_restricted_drugs),
            action_type="dairy_restriction",
            icon="shield-alert",
            note="No milk, cheese, or calcium-fortified juices within 2 hours of this window."
        ))

    timeline.append(TimelineSlot(
        time="7:30 PM",
        title="Dinner",
        medicine=None,
        action_type="meal",
        icon="utensils",
        note="Evening meal."
    ))

    if "Metformin" in [d.capitalize() for d in basket_drugs]:
        timeline.append(TimelineSlot(
            time="7:45 PM",
            title="Evening Dose: Metformin",
            medicine="Metformin",
            action_type="med_with_food",
            icon="pill",
            note="Take midway through dinner to eliminate nausea and digestive distress."
        ))

    bedtime_meds = [d.capitalize() for d in basket_drugs if profiles.get(d) and (
        "statin" in profiles[d].category.lower() or
        profiles[d].generic_name in ["atorvastatin", "simvastatin", "rosuvastatin", "alprazolam", "lorazepam"]
    )]
    if bedtime_meds:
        timeline.append(TimelineSlot(
            time="10:00 PM",
            title=f"Bedtime Dose: {', '.join(bedtime_meds)}",
            medicine=", ".join(bedtime_meds),
            action_type="bedtime_med",
            icon="moon",
            note="Hepatic cholesterol synthesis peaks overnight."
        ))

    return conflicts, timeline

# =============================================================================
# 7. SEARCH AUTOCOMPLETE & EXPLORER HELPER
# =============================================================================

def search_medicine_database(query: str) -> List[MedicineSearchResult]:
    """
    Searches curated catalog and known brand mappings with rich preview metadata.
    """
    q = query.strip().lower()
    if not q:
        # Return default popular medicines
        default_keys = ["ibuprofen", "aspirin", "warfarin", "paracetamol", "metformin", "atorvastatin", "omeprazole", "levothyroxine"]
        results = []
        for k in default_keys:
            p = CURATED_MEDICINE_PROFILES[k]
            results.append(MedicineSearchResult(
                name=p["name"],
                generic_name=p["generic_name"],
                category=p["category"],
                drug_type=p["drug_type"],
                stomach_risk_badge=p["gi_profile"]["risk_tier"].capitalize(),
                stomach_score=p["gi_profile"]["stomach_health_score"],
                top_side_effects=[se["effect"] for se in p["side_effects"][:3]],
                food_warning_count=len(p["food_interactions"])
            ))
        return results

    matches = []
    seen = set()

    # Match brands
    for brand, generic in COMMON_BRAND_MAPPINGS.items():
        if q in brand or q in generic:
            if generic not in seen:
                seen.add(generic)
                p = CURATED_MEDICINE_PROFILES.get(generic)
                if p:
                    matches.append(MedicineSearchResult(
                        name=brand.capitalize() if q in brand else p["name"],
                        generic_name=p["generic_name"],
                        category=p["category"],
                        drug_type=p["drug_type"],
                        stomach_risk_badge=p["gi_profile"]["risk_tier"].capitalize(),
                        stomach_score=p["gi_profile"]["stomach_health_score"],
                        top_side_effects=[se["effect"] for se in p["side_effects"][:3]],
                        food_warning_count=len(p["food_interactions"])
                    ))

    # Match generic keys
    for generic, p in CURATED_MEDICINE_PROFILES.items():
        if generic not in seen and (q in generic or q in p["category"].lower()):
            seen.add(generic)
            matches.append(MedicineSearchResult(
                name=p["name"],
                generic_name=p["generic_name"],
                category=p["category"],
                drug_type=p["drug_type"],
                stomach_risk_badge=p["gi_profile"]["risk_tier"].capitalize(),
                stomach_score=p["gi_profile"]["stomach_health_score"],
                top_side_effects=[se["effect"] for se in p["side_effects"][:3]],
                food_warning_count=len(p["food_interactions"])
            ))

    return matches[:8]

# =============================================================================
# 8. PAIRWISE INTERACTION ANALYSIS WITH WINDOWED HEURISTIC
# =============================================================================

def extract_mention_context_window(text: str, search_terms: Set[str], window_chars: int = 250) -> List[str]:
    """Find occurrences of search_terms in text and extract local windows around mentions."""
    windows = []
    text_lower = text.lower()
    for term in search_terms:
        if len(term) < 3:
            continue
        pattern = re.compile(rf'\b{re.escape(term)}\b', re.IGNORECASE)
        for match in pattern.finditer(text_lower):
            start = max(0, match.start() - window_chars)
            end = min(len(text_lower), match.end() + window_chars)
            windows.append(text_lower[start:end])
    return windows

def evaluate_window_severity(windows: List[str]) -> Tuple[str, str]:
    """Evaluate interaction severity based strictly on context windows around mentions."""
    combined_windows = " ".join(windows)

    high_keywords = [
        "fatal", "contraindicated", "contraindication", "life-threatening",
        "do not use with", "do not coadminister", "severe hemorrhage",
        "severe bleeding", "severe toxicity", "major bleeding",
        "rhabdomyolysis", "cardiac arrest", "death", "black box warning",
        "strictly contraindicated", "avoid concomitant"
    ]
    if any(k in combined_windows for k in high_keywords):
        return "high", "High clinical risk detected in FDA label warnings. Concomitant use may result in severe adverse reactions."

    moderate_keywords = [
        "caution", "monitoring", "monitor", "increase the risk",
        "adversely affect", "adjust dosage", "dosage adjustment",
        "potential interaction", "decreased efficacy", "inhibit",
        "potentiate", "elevate blood levels", "enhanced effect",
        "concurrent administration may"
    ]
    if any(k in combined_windows for k in moderate_keywords):
        return "moderate", "Moderate clinical interaction noted in FDA label. Concurrent administration requires caution or dosage/timing adjustment."

    return "low", "Minor or low-risk interaction noted in FDA documentation. Generally manageable with standard medical oversight."

async def analyze_drug_pair(
    drug_a: str,
    drug_b: str,
    label_a: Optional[Dict[str, Any]] = None,
    label_b: Optional[Dict[str, Any]] = None
) -> Optional[InteractionItem]:
    """
    Analyzes potential drug-drug interaction between drug_a and drug_b.
    Checks known clinical rules, FDA cross-mentions, and Mistral synthesis.
    """
    aliases_a = resolve_drug_aliases(drug_a, label_a)
    aliases_b = resolve_drug_aliases(drug_b, label_b)

    # 1. Match against known clinical rules
    for rule in KNOWN_CLINICAL_RULES:
        rule_drugs = rule["drugs"]
        match_forward = any(d in aliases_a for d in rule_drugs) and any(d in aliases_b for d in rule_drugs)
        if match_forward and len(rule_drugs.intersection(aliases_a.union(aliases_b))) == 2:
            gen_a = get_primary_generic_name(drug_a, label_a)
            gen_b = get_primary_generic_name(drug_b, label_b)

            return InteractionItem(
                drug_a=drug_a,
                drug_b=drug_b,
                severity=rule["severity"],
                explanation=rule["explanation"],
                mechanism=rule.get("mechanism", "Pharmacokinetic / Pharmacodynamic co-administration impact."),
                clinical_impact=rule.get("clinical_impact", "May alter therapeutic efficacy or amplify side effect risks."),
                stomach_impact=rule.get("stomach_impact", "Monitor for gastrointestinal sensitivity."),
                food_consideration=rule.get("food_consideration", "Take with meals if appropriate."),
                action_guidance=rule.get("action_guidance", "Consult physician or pharmacist before concurrent use.")
            )

    # 2. Check openFDA label text cross-mentions with local window severity
    fda_text_a = (label_a.get("raw_text_summary", "") if label_a else "")
    fda_text_b = (label_b.get("raw_text_summary", "") if label_b else "")

    windows_a = extract_mention_context_window(fda_text_a, aliases_b)
    windows_b = extract_mention_context_window(fda_text_b, aliases_a)
    all_windows = windows_a + windows_b

    if all_windows:
        sev, sev_reason = evaluate_window_severity(all_windows)
        gen_a = get_primary_generic_name(drug_a, label_a)
        gen_b = get_primary_generic_name(drug_b, label_b)

        explanation = (
            f"FDA drug label data indicates potential interaction between {drug_a.capitalize()} "
            f"{f'({gen_a.capitalize()}) ' if drug_a.lower() != gen_a else ''}and {drug_b.capitalize()} "
            f"{f'({gen_b.capitalize()})' if drug_b.lower() != gen_b else ''}. {sev_reason}"
        )
        return InteractionItem(
            drug_a=drug_a,
            drug_b=drug_b,
            severity=sev,
            explanation=explanation,
            mechanism="Identified in FDA prescribing warnings and contraindications section.",
            clinical_impact="Altered absorption, clearance, or compounding physiological stress.",
            stomach_impact="Monitor for nausea, reflux, or gastrointestinal discomfort.",
            food_consideration="Take with meals to reduce irritation.",
            action_guidance="Consult physician or pharmacist to determine if dosage adjustments are required."
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
  "explanation": "Clear, patient-accessible 2-3 sentence explanation of the interaction mechanism and risk.",
  "mechanism": "1 sentence pharmacological mechanism",
  "clinical_impact": "1 sentence on what the patient may experience",
  "stomach_impact": "1 sentence on stomach/GI effect",
  "food_consideration": "1 sentence on food or alcohol advice",
  "action_guidance": "1 sentence actionable recommendation"
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
                            explanation=result.get("explanation", f"Potential interaction detected between {drug_a} and {drug_b}."),
                            mechanism=result.get("mechanism"),
                            clinical_impact=result.get("clinical_impact"),
                            stomach_impact=result.get("stomach_impact"),
                            food_consideration=result.get("food_consideration"),
                            action_guidance=result.get("action_guidance")
                        )
        except Exception as e:
            logger.warning(f"Mistral dynamic pair evaluation error: {e}")

    return None

async def parse_drug_label_with_mistral(raw_label: Dict[str, Any]) -> ParsedDrugInfo:
    """Parses unstructured drug label into structured fields."""
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
