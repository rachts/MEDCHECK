# MEDCHECK bugfix: profile endpoint cannot resolve Explorer display names

## Bug (found by manual browser testing, 2026-11-25)

In the Drug Explorer, clicking DETAILS on **Paracetamol (Acetaminophen)** opens
`/medicine/Paracetamol%20(Acetaminophen)`, which renders a degraded skeleton
profile: "UNKNOWN / UNVERIFIED COMPOUND", GI tier UNKNOWN, mucosal stress score
blank, nausea risk "Unknown", "Limited clinical safety data available.", "No
common adverse reaction thresholds flagged", and guidance saying "Verify drug
spelling or consult a licensed pharmacist". Paracetamol IS a curated medicine
in the database (the Explorer itself lists it as GENTLE GI with real side
effects), so this page is wrong and undermines trust.

`/medicine/Warfarin` renders the full curated profile correctly. The failure is
specific to display names that differ from the curated keys.

## Root cause (confirmed in code)

`backend/services/knowledge_base.py`, `normalize_drug_query()` (used by
`get_or_build_medicine_profile` before the `CURATED_MEDICINE_PROFILES` lookup):

- It never strips a trailing parenthetical alternate name, so
  `"paracetamol (acetaminophen)"` is returned unchanged and misses the curated
  key `"paracetamol"`.
- It never normalises whitespace around `/`, so `"amoxicillin / clavulanate"`
  (the Explorer display name) misses the curated key `"amoxicillin/clavulanate"`.
- Its final `return cleaned` discards the normalised `base` / `sub_base` values
  it computed along the way.

The search endpoint and the chatbot resolve these names correctly through other
paths; only the profile path is affected.

## Fix (backend only, keep it minimal)

In `normalize_drug_query` in `backend/services/knowledge_base.py`:

1. Right after the initial lower/strip, normalise the string:
   - strip a trailing parenthetical group: `re.sub(r"\s*\([^)]*\)\s*$", "", s)`
   - collapse whitespace around slashes: `re.sub(r"\s*/\s*", "/", s)`
   - strip again.
2. Run the existing brand-mapping checks against the normalised string (exact,
   then dosage-stripped, then formulation-stripped, as today).
3. Return the best normalised value at the end (the formulation-stripped base
   when no mapping matched), not the raw input, so canonical generics typed
   with display formatting still hit the curated keys.

Do not change any other behaviour: brand mappings, dosage stripping, FDC
handling, the OpenFDA label path, and the unverified fallback for genuinely
unknown medicines all stay exactly as they are. A medicine that is truly not in
the database must still get the honest unverified profile.

## Tests

- Unit: `normalize_drug_query("Paracetamol (Acetaminophen)") == "paracetamol"`;
  `normalize_drug_query("Amoxicillin / Clavulanate") == "amoxicillin/clavulanate"`;
  existing documented examples unchanged (`Dolo 650` → paracetamol,
  `Pan 40` → pantoprazole, `Ecosprin 75` → aspirin, `Combiflam` → ibuprofen,
  `Azithral 500` → azithromycin).
- API: `GET /api/medicine/Paracetamol (Acetaminophen)/profile` returns the
  curated profile (generic_name paracetamol, a real stomach_health_score,
  non-empty side_effects); same for `Amoxicillin / Clavulanate`.
- Full backend test suite passes. No frontend changes. No new dependencies.
