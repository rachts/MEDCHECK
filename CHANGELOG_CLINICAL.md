# MEDCHECK Clinical Knowledge Base Changelog

All clinical rule modifications, pharmacology profile updates, and evidence metadata annotations are documented in this file.

## [2026.08.25-1] - 2026-08-25

Audit remediation pass. Only the entries below changed what the application tells
a patient about their medicines; the rest of the pass was infrastructure and is
not logged here.

### Fixed
- **Fabricated "gentle" Profile on Fetch Failure**: `MedicineProfilePanel` substituted a hardcoded `{ risk_tier: "gentle", stomach_health_score: 25, side_effects: [], food_interactions: [] }` object under the real medicine's name whenever the profile request failed. A dropped request therefore rendered as a confident, verified-looking clinical all-clear. Failures are now reported as failures.
- **`unknown` Risk Tier Rendered as Safe**: the GI tier badge had no `unknown` branch, so an unverified compound — the one case where a caution signal matters most — fell through to the reassuring green `tag-success`. `unknown` now renders as a caution, and `data_source: "unknown_fallback"` surfaces its `disclaimer` in a warning banner instead of being discarded.
- **Missing Nausea / Ulcer / Bleeding Risk Fields**: these three were absent from the old client-side fallback object, and React renders `undefined` as nothing — so each label sat above empty space, which reads as "no risk". They now fall back to an explicit `unknown`.
- **Discarded Regimen-Specific GI Mitigations**: `composite_gi_recommendations` (dual-NSAID compounding, anticoagulant + NSAID bleeding hazard, alcohol, existing PPI credit) were computed by `gi_engine` and then dropped in favour of two static tips. They now lead the Stomach Guardian modal, with the anticoagulant + NSAID escalation styled distinctly from adherence advice.
- **Empty Per-Drug GI Breakdown**: the modal read `results.gi_contributors`, a field the payload never carries (`composite_gi_contributors`), so the breakdown always showed "No medications loaded in basket" against a fully populated basket and a computed score. The PPI protective credit also printed as `+-20 pts`.
- **Unqualified All-Clear**: `SafeState` presented "VERIFIED CLEAN PROFILE" identically whether or not `limited_data_warnings` was populated. A clean result built on a medicine with no usable FDA label means "nothing was found to compare", not "nothing exists"; the claim is now downgraded and the specific gaps listed.
- **Interaction Matching on Short Names**: the substring heuristic in `interaction_analyzer` could match a two- or three-character drug name inside an unrelated one. Matching is now bounded.
- **Overstated Coverage Claims**: the landing-page copy's "10,000+ Drugs" and "Zero Stored Data" were both false — the knowledge base holds 12 curated profiles, 54 brand mappings, 21 synonym sets, 17 interaction rules and 86 searchable names, and results are cached in SQLite under a TTL. Both badges now describe the real behaviour ("Curated core + OpenFDA labels", "Anonymous guest sessions") rather than asserting a catalogue size or a storage guarantee the system does not provide.

---

## [2026.08.24-1] - 2026-08-24

### Added
- **Restored Complete 17 Gold-Standard Rules**: Expanded deterministic clinical rules from 10 to 17 rules with full evidence citations and confidence metrics:
  - *Omeprazole + Clopidogrel* (CYP2C19 competitive inhibition reducing clopidogrel active metabolite).
  - *Metoprolol + Amlodipine* (Compounded negative chronotropy and peripheral vasodilation).
  - *Levothyroxine + Omeprazole* (Impaired levothyroxine gastric absorption due to elevated gastric pH).
  - *Paracetamol + Warfarin* (Sustained high-dose paracetamol enhancement of INR/hypoprothrombinemia).
  - *Lisinopril + Potassium Chloride* (Compounded hyperkalemia risk from aldosterone suppression).
  - *Ciprofloxacin + Theophylline* (CYP1A2 inhibition producing theophylline neuro/cardiotoxicity).
  - *Atorvastatin + Clarithromycin* (CYP3A4 inhibition increasing atorvastatin systemic AUC and rhabdomyolysis hazard).
- **Anticoagulant + NSAID Bleeding Penalty**: Added +30 pt GI compounding penalty for synergistic hemorrhagic hazards.
- **Multi-Drug Amplification**: Added detection for compounded hyperkalemia and hepatic strain across active regimens.
- **Dynamic 24-Hour Administration**: Added `patient_wake_time` offset to dynamically align meal/fasting dosing schedules.

---

## [2026.08.23-1] - 2026-08-23

### Added
- **Evidence Metadata**: All deterministic rules in `KNOWN_CLINICAL_RULES` now include `evidence_source`, `confidence` (`established`, `theoretical`, `case_report`), and `last_reviewed` timestamps.
- **Dedicated Profile**: `amoxicillin/clavulanate` (Augmentin) dedicated profile with distinct gastrointestinal motility and cholestatic jaundice clinical warnings.
- **Substance Classification**: Ethanol/Alcohol classified under dedicated `drug_type: "substance"` to distinguish lifestyle intoxicants from OTC analgesics.
- **Structured Fallback**: Unverified / unrecognized compounds return `data_source: "unknown_fallback"` with `risk_tier: "unknown"` and explicit pharmacist consultation disclaimers instead of speculative default safety scores.

### Modified
- **Brand Mapping**: Corrected `"augmentin"` to map directly to `"amoxicillin/clavulanate"` (previously mapped to plain `"amoxicillin"`).
- **Composite Stomach Guardian Scoring**: Refined multi-NSAID compounding formula (+25 penalty) and PPI mitigation credit (-20 protective credit).
- **Sentence-Boundary Truncation**: OpenFDA label parser now splits cleanly on sentence boundaries (`re.split(r'(?<=[.!?])\s+')`), preventing truncated words in clinical descriptions.

### Fixed
- Fixed potential integer overflow on extreme multi-drug regimens by capping composite GI score bounded in `[5, 100]`.
- Implemented SQLite / Supabase TTL expiration policy (30-day drug details, 90-day interaction pairs).
