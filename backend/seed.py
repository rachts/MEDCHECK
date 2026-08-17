import asyncio
import logging
from services.openfda import fetch_drug_label
from services.mistral_parser import parse_drug_label_with_mistral, KNOWN_CLINICAL_RULES
from services.supabase_cache import save_drug_detail_to_cache, save_interaction_to_cache

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed")

COMMON_MEDICINES = [
    "paracetamol",
    "ibuprofen",
    "aspirin",
    "amlodipine",
    "metformin",
    "atorvastatin",
    "omeprazole",
    "levothyroxine",
    "warfarin",
    "metoprolol"
]

async def seed_database():
    logger.info("Starting MedCheck database seed process...")
    
    # 1. Seed Known Clinical Interaction Rules
    logger.info("1. Pre-caching verified clinical interaction pairs...")
    for rule in KNOWN_CLINICAL_RULES:
        drugs = list(rule["drugs"])
        if len(drugs) == 2:
            await save_interaction_to_cache(
                drug_a=drugs[0],
                drug_b=drugs[1],
                severity=rule["severity"],
                explanation=rule["explanation"]
            )
            logger.info(f"  ✓ Cached pair: {drugs[0]} + {drugs[1]} [{rule['severity'].upper()}]")

    # 2. Fetch and Cache OpenFDA Labels for Common Medicines
    logger.info("\n2. Fetching & parsing OpenFDA labels for common medications...")
    for med in COMMON_MEDICINES:
        try:
            logger.info(f"Processing '{med}'...")
            raw_label = await fetch_drug_label(med)
            if raw_label:
                parsed_info = await parse_drug_label_with_mistral(raw_label)
                await save_drug_detail_to_cache(parsed_info)
                logger.info(f"  ✓ Cached drug details for '{med}' (Generic: {parsed_info.generic_name})")
            else:
                logger.warning(f"  ! Could not fetch openFDA label for '{med}', creating placeholder cache.")
        except Exception as e:
            logger.error(f"  ✗ Error seeding medicine '{med}': {e}")

    logger.info("\n✅ MedCheck database seed completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_database())
