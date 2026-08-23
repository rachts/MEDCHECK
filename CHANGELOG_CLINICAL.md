# MEDCHECK Clinical Knowledge Base Changelog

All clinical rule modifications, pharmacology profile updates, and evidence metadata annotations are documented in this file.

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
