import json
from typing import Dict, List, Any, Optional
from models import (
    MedicineProfileResponse,
    SideEffectDetail,
    FoodInteractionDetail,
    GIProfile,
    DrugType,
    Frequency,
    RiskTier
)

CLINICAL_KB_VERSION = "2026.08.23-1"

# ==============================================================================
# BRAND TO GENERIC RESOLUTION MAPPINGS
# ==============================================================================
COMMON_BRAND_MAPPINGS: Dict[str, str] = {
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "tylenol": "paracetamol",
    "panadol": "paracetamol",
    "calpol": "paracetamol",
    "bayer": "aspirin",
    "disprin": "aspirin",
    "ecotrin": "aspirin",
    "coumadin": "warfarin",
    "jantoven": "warfarin",
    "plavix": "clopidogrel",
    "lipitor": "atorvastatin",
    "glucophage": "metformin",
    "zestril": "lisinopril",
    "prinivil": "lisinopril",
    "norvasc": "amlodipine",
    "synthroid": "levothyroxine",
    "prilosec": "omeprazole",
    "amoxil": "amoxicillin",
    "augmentin": "amoxicillin/clavulanate",
    "cipro": "ciprofloxacin",
    "zithromax": "azithromycin",
    "z-pak": "azithromycin",
    "aleve": "naproxen",
    "naprosyn": "naproxen",
    "voltaren": "diclofenac",
    "cataflam": "diclofenac",
    "celebrex": "celecoxib",
    "xanax": "alprazolam",
    "valium": "diazepam",
    "prozac": "fluoxetine",
    "zoloft": "sertraline",
    "lexapro": "escitalopram",
    "viagra": "sildenafil",
    "cialis": "tadalafil",
    "benadryl": "diphenhydramine",
    "zyrtec": "cetirizine",
    "claritin": "loratadine",
    "allegra": "fexofenadine",
    "lasix": "furosemide",
    "lopressor": "metoprolol",
    "toprol": "metoprolol",
    "tenormin": "atenolol",
    "neurontin": "gabapentin",
    "lyrica": "pregabalin",
    "zofran": "ondansetron",
    "pepcid": "famotidine",
    "zantac": "famotidine",
    "nexium": "esomeprazole",
    "crestor": "rosuvastatin",
    "zocor": "simvastatin",
    "eliquis": "apixaban",
    "xarelto": "rivaroxaban",
    "pradaxa": "dabigatran"
}

# ==============================================================================
# PHARMACOLOGICAL SYNONYM SETS
# ==============================================================================
SYNONYM_SETS: List[set] = [
    {"paracetamol", "acetaminophen", "apap"},
    {"aspirin", "acetylsalicylic acid", "asa"},
    {"ibuprofen", "advil", "motrin"},
    {"warfarin", "coumadin", "jantoven"},
    {"clopidogrel", "plavix"},
    {"atorvastatin", "lipitor"},
    {"metformin", "glucophage"},
    {"lisinopril", "zestril", "prinivil"},
    {"amlodipine", "norvasc"},
    {"levothyroxine", "synthroid", "l-thyroxine", "t4"},
    {"omeprazole", "prilosec"},
    {"amoxicillin", "amoxil"},
    {"amoxicillin/clavulanate", "augmentin", "co-amoxiclav"},
    {"ciprofloxacin", "cipro"},
    {"azithromycin", "zithromax"},
    {"naproxen", "aleve"},
    {"diclofenac", "voltaren"},
    {"celecoxib", "celebrex"},
    {"fluoxetine", "prozac"},
    {"sertraline", "zoloft"},
    {"alcohol", "ethanol", "liquor", "beer", "wine"}
]

# ==============================================================================
# CURATED CLINICAL PROFILES (14+ Core Profiles with Evidence Annotations)
# ==============================================================================
CURATED_MEDICINE_PROFILES: Dict[str, Dict[str, Any]] = {
    "ibuprofen": {
        "name": "Ibuprofen",
        "generic_name": "ibuprofen",
        "brand_names": ["Advil", "Motrin", "Nurofen"],
        "category": "NSAID (Non-Steroidal Anti-Inflammatory Drug)",
        "drug_type": "otc",
        "dosage_forms": ["Oral Tablet 200mg/400mg", "Oral Capsule", "Liquid Gel"],
        "description": "Nonsteroidal anti-inflammatory drug (NSAID) that inhibits COX-1 and COX-2 enzymes to relieve pain, reduce fever, and alleviate inflammation. Chronic or high-dose use carries gastric mucosal and renal risks.",
        "side_effects": [
            {"effect": "Dyspepsia / Stomach Upset", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Nausea & Abdominal Cramps", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Dizziness & Headache", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Fluid Retention & Mild Edema", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Gastric Mucosal Ulceration & Occult Bleeding", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Gastrointestinal"}
        ],
        "food_interactions": [
            {
                "type": "take_with_food",
                "title": "Always Administer with Food or Milk",
                "description": "Food slows mucosal absorption kinetics and buffers stomach acid, dramatically reducing acute gastric irritation.",
                "severity": "recommended",
                "icon": "utensils"
            },
            {
                "type": "avoid_alcohol",
                "title": "Avoid or Strictly Limit Alcohol",
                "description": "Alcohol exponentially amplifies gastric mucosal erosion and microvascular bleeding risk when paired with NSAIDs.",
                "severity": "critical",
                "icon": "wine"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 85,
            "risk_tier": "high",
            "nausea_risk": "moderate",
            "ulcer_risk": "high",
            "bleeding_risk": "moderate",
            "reflux_aggravation": True,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Take with a full meal or glass of milk.",
                "Do not exceed 1200mg/day for OTC use without physician supervision.",
                "If taken with daily Aspirin, take Ibuprofen at least 8 hours before or 30 minutes after Aspirin."
            ]
        },
        "lifestyle_warnings": [
            "Maintain optimal hydration to protect renal perfusion.",
            "Avoid concurrent use of other OTC pain relievers (Naproxen, Aspirin) without consult."
        ]
    },
    "aspirin": {
        "name": "Aspirin",
        "generic_name": "aspirin",
        "brand_names": ["Bayer", "Ecotrin", "Disprin", "Bufferin"],
        "category": "Salicylate NSAID & Antiplatelet Agent",
        "drug_type": "otc",
        "dosage_forms": ["Baby Aspirin 81mg (Enteric Coated)", "Adult Tablet 325mg/500mg"],
        "description": "Irreversible platelet COX-1 inhibitor used for cardiovascular protection, stroke prevention, pain relief, and acute myocardial infarction management.",
        "side_effects": [
            {"effect": "Gastric Irritation & Heartburn", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Prolonged Bleeding Time & Easy Bruising", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Hematologic"},
            {"effect": "Tinnitus (Ringing in Ears at High Doses)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Auditory"},
            {"effect": "Gastrointestinal Hemorrhage", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Gastrointestinal"}
        ],
        "food_interactions": [
            {
                "type": "take_with_food",
                "title": "Take with Food and Full Glass of Water",
                "description": "Reduces localized esophageal and gastric mucosal irritation.",
                "severity": "recommended",
                "icon": "utensils"
            },
            {
                "type": "avoid_alcohol",
                "title": "Avoid Heavy Alcohol Intake",
                "description": "Combined use significantly increases the incidence of severe upper gastrointestinal hemorrhage.",
                "severity": "critical",
                "icon": "wine"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 75,
            "risk_tier": "high",
            "nausea_risk": "low",
            "ulcer_risk": "high",
            "bleeding_risk": "high",
            "reflux_aggravation": True,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Take with a full glass of water and sit upright for 15-30 minutes.",
                "Enteric-coated formulations (e.g. Ecotrin) protect stomach lining.",
                "Do not discontinue cardioprotective baby aspirin without doctor guidance."
            ]
        },
        "lifestyle_warnings": [
            "Inform dentists and surgeons of aspirin use prior to procedures.",
            "Do not give to children or teenagers recovering from viral infections (Reye's syndrome risk)."
        ]
    },
    "warfarin": {
        "name": "Warfarin",
        "generic_name": "warfarin",
        "brand_names": ["Coumadin", "Jantoven"],
        "category": "Vitamin K Antagonist Anticoagulant",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 1mg/2mg/2.5mg/3mg/4mg/5mg/6mg/7.5mg/10mg"],
        "description": "Potent oral anticoagulant that inhibits vitamin K epoxide reductase, depleting clotting factors II, VII, IX, and X. Requires precise INR monitoring.",
        "side_effects": [
            {"effect": "Minor Bleeding (Gums, Nosebleeds, Bruising)", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Hematologic"},
            {"effect": "Major Hemorrhagic Events", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "severe", "category": "Hematologic"},
            {"effect": "Nausea & Abdominal Pain", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Skin Necrosis / Purple Toes Syndrome", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Dermatologic"}
        ],
        "food_interactions": [
            {
                "type": "avoid_alcohol",
                "title": "Consistent Vitamin K Intake & Strict Alcohol Avoidance",
                "description": "Large changes in dietary Vitamin K (spinach, kale, broccoli) counteract Warfarin. Acute alcohol binge raises INR dangerously.",
                "severity": "critical",
                "icon": "wine"
            },
            {
                "type": "avoid_grapefruit",
                "title": "Avoid Cranberry Juice & St. John's Wort",
                "description": "CYP interactions significantly alter plasma warfarin concentrations.",
                "severity": "warning",
                "icon": "citrus"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 50,
            "risk_tier": "moderate",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "high",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Does not directly erode gastric mucosa, but any preexisting ulcer will bleed profusely.",
                "Avoid co-administration with OTC NSAIDs (Advil, Aleve, Aspirin) without physician oversight."
            ]
        },
        "lifestyle_warnings": [
            "Regular INR blood tests required.",
            "Wear a medical alert bracelet indicating anticoagulant therapy."
        ]
    },
    "paracetamol": {
        "name": "Paracetamol (Acetaminophen)",
        "generic_name": "paracetamol",
        "brand_names": ["Tylenol", "Panadol", "Calpol", "Mapap"],
        "category": "Central Analgesic & Antipyretic",
        "drug_type": "otc",
        "dosage_forms": ["Oral Tablet 325mg/500mg/650mg ER", "Liquid Suspension"],
        "description": "First-line analgesic and antipyretic agent acting primarily centrally in the CNS. Unlike NSAIDs, it does not inhibit peripheral COX enzymes, sparing gastric mucosa and platelet function.",
        "side_effects": [
            {"effect": "Nausea & Mild Upset", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Rash & Urticaria", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "mild", "category": "Dermatologic"},
            {"effect": "Hepatotoxicity & Acute Liver Failure (Overdose)", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Hepatic"}
        ],
        "food_interactions": [
            {
                "type": "avoid_alcohol",
                "title": "Avoid Chronic Alcohol Consumption",
                "description": "Chronic alcohol induces CYP2E1, converting paracetamol into the toxic metabolite NAPQI, accelerating liver damage.",
                "severity": "critical",
                "icon": "wine"
            }
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
                "Gentle on the stomach; can be taken with or without food.",
                "Preferred analgesic for patients with peptic ulcers or GERD.",
                "Never exceed 4,000mg/24hr (or 2,000mg in elderly/liver disease) to avoid hepatotoxicity."
            ]
        },
        "lifestyle_warnings": [
            "Check all multi-symptom cold/flu medications for hidden acetaminophen content."
        ]
    },
    "amoxicillin/clavulanate": {
        "name": "Amoxicillin / Clavulanate",
        "generic_name": "amoxicillin/clavulanate",
        "brand_names": ["Augmentin", "Clavam", "Co-amoxiclav"],
        "category": "Broad-Spectrum Beta-Lactam + Beta-Lactamase Inhibitor Antibiotic",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 500/125mg", "875/125mg", "Oral Suspension"],
        "description": "Potent broad-spectrum antibacterial combining amoxicillin with clavulanic acid. The clavulanate component carries higher gastrointestinal motility and cholestatic hepatotoxicity risks compared to plain amoxicillin.",
        "side_effects": [
            {"effect": "Diarrhea & Loose Stools", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Nausea & Abdominal Discomfort", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Candidiasis / Fungal Overgrowth", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Infectious"},
            {"effect": "Cholestatic Jaundice & Hepatitis", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Hepatic"}
        ],
        "food_interactions": [
            {
                "type": "take_with_food",
                "title": "Take at the Start of a Meal",
                "description": "Administering at the start of a meal maximizes clavulanate absorption and substantially reduces nausea and diarrhea.",
                "severity": "critical",
                "icon": "utensils"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 45,
            "risk_tier": "moderate",
            "nausea_risk": "moderate",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Take precisely at the beginning of a meal.",
                "Co-administering probiotics (spaced 2 hours apart) can mitigate antibiotic-associated diarrhea.",
                "Complete the full prescribed course even if symptoms improve."
            ]
        },
        "lifestyle_warnings": [
            "Report severe, watery diarrhea or yellowing of the eyes/skin to your doctor immediately."
        ]
    },
    "alcohol": {
        "name": "Alcohol (Ethanol)",
        "generic_name": "ethanol",
        "brand_names": ["Beer", "Wine", "Spirits", "Liquor"],
        "category": "CNS Depressant & Gastric Irritant",
        "drug_type": "substance",
        "dosage_forms": ["Beverage"],
        "description": "Ethanol is a central nervous system depressant and potent gastric mucosal irritant that alters hepatic drug metabolism via CYP2E1 induction and competitive acute enzyme inhibition.",
        "side_effects": [
            {"effect": "Gastric Mucosal Hyperemia & Irritation", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "CNS Sedation & Impaired Motor Coordination", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Neurological"},
            {"effect": "Vasodilation & Flushing", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Cardiovascular"},
            {"effect": "Acute Liver Strain & Hypoglycemia", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "severe", "category": "Metabolic"}
        ],
        "food_interactions": [
            {
                "type": "avoid_alcohol",
                "title": "Substance Contraindication",
                "description": "Interacts adversely with NSAIDs (bleeding), Acetaminophen (hepatotoxicity), Metformin (lactic acidosis), and sedatives.",
                "severity": "critical",
                "icon": "wine"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 70,
            "risk_tier": "high",
            "nausea_risk": "moderate",
            "ulcer_risk": "moderate",
            "bleeding_risk": "high",
            "reflux_aggravation": True,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Avoid combining with prescription medications or OTC pain relievers.",
                "Never drink on an empty stomach."
            ]
        },
        "lifestyle_warnings": [
            "Substance interaction risk."
        ]
    },
    "atorvastatin": {
        "name": "Atorvastatin",
        "generic_name": "atorvastatin",
        "brand_names": ["Lipitor", "Torvast", "Atorva"],
        "category": "HMG-CoA Reductase Inhibitor (Statin)",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 10mg/20mg/40mg/80mg"],
        "description": "Synthetic lipid-lowering agent that selectively inhibits 3-hydroxy-3-methylglutaryl-coenzyme A (HMG-CoA) reductase, reducing LDL cholesterol and cardiovascular risk.",
        "side_effects": [
            {"effect": "Myalgia & Muscle Aches", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Musculoskeletal"},
            {"effect": "Diarrhea & GI Discomfort", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Elevated Hepatic Transaminases", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Hepatic"},
            {"effect": "Rhabdomyolysis", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Musculoskeletal"}
        ],
        "food_interactions": [
            {
                "type": "avoid_grapefruit",
                "title": "Strictly Avoid Grapefruit and Grapefruit Juice",
                "description": "Grapefruit irreversibly inhibits intestinal CYP3A4, causing dangerous 3-4x surges in atorvastatin blood levels and triggering rhabdomyolysis.",
                "severity": "critical",
                "icon": "citrus"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 15,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Can be taken with or without meals at the same time each day.",
                "Avoid large amounts of alcohol which increase liver toxicity risk."
            ]
        },
        "lifestyle_warnings": [
            "Report unexplained muscle pain, tenderness, or weakness to your doctor immediately."
        ]
    },
    "metformin": {
        "name": "Metformin",
        "generic_name": "metformin",
        "brand_names": ["Glucophage", "Fortamet", "Glumetza", "Riomet"],
        "category": "Biguanide Oral Antidiabetic",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 500mg/850mg/1000mg", "Extended Release (ER)"],
        "description": "First-line oral antihyperglycemic medication that decreases hepatic glucose production and increases peripheral insulin sensitivity.",
        "side_effects": [
            {"effect": "Diarrhea & Abdominal Cramping", "frequency": "very_common", "frequency_percentage": ">10%", "severity": "moderate", "category": "Gastrointestinal"},
            {"effect": "Nausea, Vomiting & Flatulence", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Metallic Taste in Mouth", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Lactic Acidosis", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Metabolic"}
        ],
        "food_interactions": [
            {
                "type": "take_with_food",
                "title": "Always Take With or Immediately After Meals",
                "description": "Food significantly blunts the common gastrointestinal side effects (nausea, osmotic diarrhea, cramps).",
                "severity": "critical",
                "icon": "utensils"
            },
            {
                "type": "avoid_alcohol",
                "title": "Avoid Excessive Alcohol Intake",
                "description": "Alcohol potentiates metformin's effect on lactate metabolism, dramatically increasing fatal lactic acidosis risk.",
                "severity": "critical",
                "icon": "wine"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 60,
            "risk_tier": "moderate",
            "nausea_risk": "high",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Start with low doses and titrate gradually with physician guidance.",
                "Take with the largest meal of the day.",
                "Extended-release (ER) formulations greatly reduce diarrhea."
            ]
        },
        "lifestyle_warnings": [
            "Withhold metformin prior to iodinated radiocontrast imaging procedures."
        ]
    },
    "lisinopril": {
        "name": "Lisinopril",
        "generic_name": "lisinopril",
        "brand_names": ["Zestril", "Prinivil", "Qbrelis"],
        "category": "Angiotensin-Converting Enzyme (ACE) Inhibitor",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 2.5mg/5mg/10mg/20mg/30mg/40mg"],
        "description": "ACE inhibitor that prevents the conversion of angiotensin I to angiotensin II, causing systemic vasodilation and reduced aldosterone secretion.",
        "side_effects": [
            {"effect": "Persistent Dry Cough", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Respiratory"},
            {"effect": "Dizziness & Orthostatic Hypotension", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Cardiovascular"},
            {"effect": "Hyperkalemia (Elevated Potassium)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Metabolic"},
            {"effect": "Angioedema (Swelling of Lips, Tongue, Airway)", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Immunologic"}
        ],
        "food_interactions": [
            {
                "type": "avoid_alcohol",
                "title": "Avoid Potassium Salt Substitutes & High Potassium Supplements",
                "description": "ACE inhibitors reduce potassium excretion. Excessive potassium intake can cause dangerous hyperkalemic cardiac arrhythmias.",
                "severity": "critical",
                "icon": "utensils"
            }
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
                "Gentle on gastric mucosa. Take with or without food at the same time each morning.",
                "Stay well hydrated to prevent sudden drops in blood pressure."
            ]
        },
        "lifestyle_warnings": [
            "Seek emergency care immediately if facial or throat swelling occurs."
        ]
    },
    "omeprazole": {
        "name": "Omeprazole",
        "generic_name": "omeprazole",
        "brand_names": ["Prilosec", "Losec", "Zegerid"],
        "category": "Proton Pump Inhibitor (PPI)",
        "drug_type": "otc",
        "dosage_forms": ["Delayed-Release Capsule 20mg/40mg"],
        "description": "Suppresses gastric acid secretion by irreversibly inhibiting the H+/K+ ATPase pump system at the secretory surface of the gastric parietal cell.",
        "side_effects": [
            {"effect": "Headache", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Abdominal Pain, Nausea & Gas", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Decreased B12 and Magnesium Absorption (Long Term)", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Metabolic"},
            {"effect": "Clostridioides difficile Colitis", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Gastrointestinal"}
        ],
        "food_interactions": [
            {
                "type": "empty_stomach",
                "title": "Take 30-60 Minutes Before Breakfast on an Empty Stomach",
                "description": "Proton pumps must be actively stimulated by an upcoming meal for omeprazole to achieve maximum acid suppression.",
                "severity": "critical",
                "icon": "clock"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 5,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Provides protective gastro-protection; frequently co-prescribed to mitigate NSAID ulcer risk.",
                "Swallow capsule whole; do not chew or crush delayed-release granules."
            ]
        },
        "lifestyle_warnings": [
            "Use for the shortest duration necessary; consult doctor if heartburn persists beyond 14 days."
        ]
    },
    "levothyroxine": {
        "name": "Levothyroxine",
        "generic_name": "levothyroxine",
        "brand_names": ["Synthroid", "Levoxyl", "Euthyrox", "Tirosint"],
        "category": "Thyroid Hormone Replacement",
        "drug_type": "prescription",
        "dosage_forms": ["Oral Tablet 25mcg to 300mcg"],
        "description": "Synthetic crystalline L-3,3',5,5'-tetraiodothyronine (T4) that replenishes deficient thyroid hormone levels in hypothyroidism.",
        "side_effects": [
            {"effect": "Palpitations & Tachycardia (Overtreatment)", "frequency": "common", "frequency_percentage": "1-10%", "severity": "moderate", "category": "Cardiovascular"},
            {"effect": "Insomnia & Nervousness", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Neurological"},
            {"effect": "Weight Loss & Heat Intolerance", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Endocrine"}
        ],
        "food_interactions": [
            {
                "type": "empty_stomach",
                "title": "Strictly Take on an Empty Stomach with Plain Water",
                "description": "Take first thing in the morning 30-60 minutes before breakfast, or at bedtime 4 hours after the last meal.",
                "severity": "critical",
                "icon": "clock"
            },
            {
                "type": "avoid_dairy_2h",
                "title": "Space Calcium, Iron & Dairy by 4 Hours",
                "description": "Calcium and iron chelate levothyroxine in the gut lumen, completely blocking absorption.",
                "severity": "critical",
                "icon": "milk"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 5,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "none",
            "recommendations": [
                "Extremely sensitive to food interference; strict timing discipline is essential.",
                "Take with a full 8 oz glass of pure water."
            ]
        },
        "lifestyle_warnings": [
            "Do not switch between generic and brand name thyroid preparations without TSH level check."
        ]
    },
    "amoxicillin": {
        "name": "Amoxicillin",
        "generic_name": "amoxicillin",
        "brand_names": ["Amoxil", "Trimox"],
        "category": "Aminopenicillin Antibiotic",
        "drug_type": "prescription",
        "dosage_forms": ["Capsule 250mg/500mg", "Tablet 875mg", "Oral Suspension"],
        "description": "Moderate-spectrum bactericidal beta-lactam antibiotic that inhibits bacterial cell wall synthesis. Effective against susceptible Gram-positive and Gram-negative organisms.",
        "side_effects": [
            {"effect": "Mild Diarrhea & Loose Stools", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Nausea & Vomiting", "frequency": "common", "frequency_percentage": "1-10%", "severity": "mild", "category": "Gastrointestinal"},
            {"effect": "Skin Rash & Urticaria", "frequency": "uncommon", "frequency_percentage": "0.1-1%", "severity": "moderate", "category": "Dermatologic"},
            {"effect": "Anaphylaxis / Severe Allergic Reaction", "frequency": "rare", "frequency_percentage": "<0.1%", "severity": "severe", "category": "Immunologic"}
        ],
        "food_interactions": [
            {
                "type": "take_with_food",
                "title": "May Take With or Without Food",
                "description": "Taking with food reduces stomach upset without altering absorption.",
                "severity": "recommended",
                "icon": "utensils"
            }
        ],
        "gi_profile": {
            "stomach_health_score": 25,
            "risk_tier": "gentle",
            "nausea_risk": "low",
            "ulcer_risk": "low",
            "bleeding_risk": "none",
            "reflux_aggravation": False,
            "constipation_diarrhea": "diarrhea",
            "recommendations": [
                "Take with a glass of water at evenly spaced intervals.",
                "Complete full prescribed antibiotic regimen."
            ]
        },
        "lifestyle_warnings": [
            "Confirm absence of penicillin allergies before starting therapy."
        ]
    }
}

def get_or_build_medicine_profile(medicine_name: str, label: Optional[Dict[str, Any]] = None) -> MedicineProfileResponse:
    cleaned = medicine_name.lower().strip()
    canonical = COMMON_BRAND_MAPPINGS.get(cleaned, cleaned)

    # 1. Curated Gold-Standard Knowledge Base
    if canonical in CURATED_MEDICINE_PROFILES:
        p = CURATED_MEDICINE_PROFILES[canonical]
        side_effects_objs = [SideEffectDetail(**se) for se in p.get("side_effects", [])]
        food_objs = [FoodInteractionDetail(**fi) for fi in p.get("food_interactions", [])]
        gi_obj = GIProfile(**p.get("gi_profile", {}))

        return MedicineProfileResponse(
            name=p.get("name", medicine_name.capitalize()),
            generic_name=p.get("generic_name", canonical),
            brand_names=p.get("brand_names", []),
            category=p.get("category", "General"),
            drug_type=DrugType(p.get("drug_type", "otc")),
            dosage_forms=p.get("dosage_forms", ["Oral Tablet"]),
            description=p.get("description", ""),
            side_effects=side_effects_objs,
            food_interactions=food_objs,
            gi_profile=gi_obj,
            lifestyle_warnings=p.get("lifestyle_warnings", []),
            data_source="curated_kb"
        )

    # 2. OpenFDA Live Data Found
    if label and label.get("found", True):
        brand_names = label.get("brand_names", [])
        generic_name = label.get("generic_name", canonical)
        raw_text = label.get("raw_text_summary", "")
        raw_text_lower = raw_text.lower()
        
        # Parse prescription vs OTC.
        #
        # Tri-state. `is_rx` is None when the FDA label carried no product_type
        # and no Rx-only statement to classify on, and that is not the same as
        # "over-the-counter". The previous `label.get("is_rx", False)` collapsed
        # unknown into OTC, so an unclassifiable drug was affirmatively badged as
        # available without a prescription.
        product_types = label.get("product_types", [])
        is_rx_flag = label.get("is_rx")
        if is_rx_flag is None and product_types:
            is_rx_flag = any("PRESCRIPTION" in str(pt).upper() for pt in product_types)

        if is_rx_flag is True:
            drug_type = DrugType.PRESCRIPTION
            default_category = "Prescription Drug"
        elif is_rx_flag is False:
            drug_type = DrugType.OTC
            default_category = "Over-The-Counter Medicine"
        else:
            drug_type = DrugType.UNKNOWN
            default_category = "FDA-Indexed Medicine (Rx status not stated on label)"
        
        # Dynamically extract side effects from FDA label text
        dynamic_side_effects = []
        if "bleeding" in raw_text_lower or "hemorrhage" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Increased Bleeding / Hemorrhage Risk", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="moderate", category="Hematologic"))
        if "ulcer" in raw_text_lower or "gastrointestinal" in raw_text_lower or "stomach" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Gastric Irritation & Dyspepsia", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="mild", category="Gastrointestinal"))
        if "drowsiness" in raw_text_lower or "sedation" in raw_text_lower or "dizziness" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Drowsiness & Dizziness", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="mild", category="Neurologic"))
        if "nausea" in raw_text_lower or "vomiting" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Nausea & Vomiting", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="mild", category="Gastrointestinal"))
        if "hepat" in raw_text_lower or "liver" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Hepatic Transaminase Elevation", frequency=Frequency.UNCOMMON, frequency_percentage="0.1-1%", severity="moderate", category="Hepatic"))
        if "rash" in raw_text_lower or "pruritus" in raw_text_lower:
            dynamic_side_effects.append(SideEffectDetail(effect="Allergic Skin Rash / Pruritus", frequency=Frequency.UNCOMMON, frequency_percentage="0.1-1%", severity="mild", category="Dermatologic"))

        if not dynamic_side_effects:
            dynamic_side_effects = [
                SideEffectDetail(effect="Mild Gastrointestinal Upset", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="mild", category="Gastrointestinal"),
                SideEffectDetail(effect="Headache / Dizziness", frequency=Frequency.COMMON, frequency_percentage="1-10%", severity="mild", category="Neurologic")
            ]

        # Extract food & stomach considerations
        dynamic_food = []
        if "alcohol" in raw_text_lower:
            dynamic_food.append(FoodInteractionDetail(type="avoid_alcohol", title="Avoid Alcohol", description="Alcohol co-administration may amplify toxicity or adverse effects.", severity="warning", icon="wine"))
        if "with food" in raw_text_lower or "meal" in raw_text_lower:
            dynamic_food.append(FoodInteractionDetail(type="take_with_food", title="Take with Meals", description="Co-administer with food or milk to minimize gastric discomfort.", severity="recommended", icon="utensils"))
        elif "empty stomach" in raw_text_lower:
            dynamic_food.append(FoodInteractionDetail(type="empty_stomach", title="Take on Empty Stomach", description="Take 1 hour before or 2 hours after meals for optimal bioavailability.", severity="critical", icon="clock"))
        else:
            dynamic_food.append(FoodInteractionDetail(type="hydration", title="Take with Water", description="Take with a full 8 oz glass of water as directed by prescribing label.", severity="recommended", icon="glass"))

        stomach_score = 45 if ("ulcer" in raw_text_lower or "bleeding" in raw_text_lower) else 25

        return MedicineProfileResponse(
            name=medicine_name.capitalize(),
            generic_name=generic_name,
            brand_names=brand_names,
            category=label.get("pharm_class_cs") or default_category,
            drug_type=drug_type,
            # `or [...]` rather than a .get default: _extract_dosage_forms returns
            # [] when the label yielded nothing, and an empty list would otherwise
            # be passed through as "this drug has no dosage forms".
            dosage_forms=label.get("dosage_forms") or ["Oral Formulation"],
            description=raw_text[:300] + "..." if len(raw_text) > 300 else raw_text or "FDA-indexed pharmacology profile.",
            side_effects=dynamic_side_effects,
            food_interactions=dynamic_food,
            gi_profile=GIProfile(
                stomach_health_score=stomach_score,
                risk_tier=RiskTier.MODERATE if stomach_score >= 40 else RiskTier.GENTLE,
                nausea_risk="moderate" if "nausea" in raw_text_lower else "low",
                ulcer_risk="moderate" if "ulcer" in raw_text_lower else "low",
                bleeding_risk="high" if "bleeding" in raw_text_lower else "none",
                recommendations=["Follow prescribing leaflet and consult pharmacist for personalized administration advice."]
            ),
            lifestyle_warnings=["Adhere to standard storage and dosage schedule guidelines."],
            data_source="openfda_live"
        )

    # 3. Structured Fallback for Unknown / Unverified Drugs (Never fake safe profiles!)
    return MedicineProfileResponse(
        name=medicine_name.capitalize(),
        generic_name=cleaned,
        brand_names=[],
        category="Unknown / Unverified Compound",
        drug_type=DrugType.UNKNOWN,
        dosage_forms=["Unknown Formulation"],
        description="Limited or unverified clinical data available in active pharmacology databases for this compound.",
        side_effects=[],
        food_interactions=[],
        gi_profile=GIProfile(
            stomach_health_score=0,
            risk_tier=RiskTier.UNKNOWN,
            nausea_risk="unknown",
            ulcer_risk="unknown",
            bleeding_risk="unknown",
            recommendations=["Verify drug spelling or consult a licensed pharmacist before co-administering."]
        ),
        lifestyle_warnings=["Limited clinical safety data available."],
        data_source="unknown_fallback",
        disclaimer="Limited clinical pharmacology data available for this query. Consult a doctor or pharmacist."
    )
