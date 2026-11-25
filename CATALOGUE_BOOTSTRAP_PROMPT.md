# MEDCHECK — Ship the Indian medicines catalogue to production (gzip bootstrap)

## Why
The catalogue database `backend/data/india_medicines.sqlite` is 105,811,968 bytes, over GitHub's 100 MB per-file limit, so it cannot be committed and the production catalogue is empty. A gzipped copy now sits next to it: `backend/data/india_medicines.sqlite.gz` (25,757,131 bytes), which CAN be committed. The backend just needs to unpack it on first use when the plain .sqlite is absent (which is exactly the production situation). Locally the .sqlite already exists, so nothing changes there.

## Change (backend/services/india_catalogue.py only, plus tests)
1. Add a private `_ensure_database()` step in `india_catalogue.py`:
   - It runs at most once per process (module-level flag guarded by a `threading.Lock`), lazily from the existing public entry points wherever the database existence is currently checked — NOT at import time. Importing the module must stay side-effect free.
   - If the .sqlite file already exists at the resolved DB path, do nothing.
   - Else, if a sibling file with the same path plus `.gz` (`india_medicines.sqlite.gz`) exists, decompress it with the stdlib `gzip` module into a temporary file in the SAME directory, then atomically rename it onto the .sqlite path. Log one info line that the catalogue was unpacked from the compressed copy.
   - On ANY failure (corrupt .gz, unwritable directory, missing .gz), log a warning and continue with the current graceful behaviour (empty results, no exception). Never raise from the catalogue service. Do not retry repeatedly within the process.
   - Derive the .gz path from the same resolved DB path the service already uses (if tests or config can point the service at a different sqlite path, the .gz sibling is that path + ".gz").
2. Everything else about the service stays byte-identical in behaviour: same search ranking, same chat matching, same responses.

## Tests (extend backend/tests/test_india_catalogue.py or a new test file)
- Fixture with ONLY a .gz present (a gzipped copy of the existing tiny fixture database): a catalogue search returns the fixture products, and the .sqlite file exists afterwards.
- Fixture with a corrupt .gz (random bytes): search returns empty results and no exception is raised.
- The existing fixture tests (plain .sqlite present) must pass unchanged.

## Hard rules
- Do NOT modify `backend/data/india_medicines.sqlite`, `backend/data/india_medicines.sqlite.gz`, the banned-medicines JSON, or any other service. No new dependencies (stdlib only). No frontend changes.
- Do not push or deploy anything.

## Checks before reporting done
- Full backend test suite passes (`cd backend && venv/bin/python -m pytest tests -q`).
- Report exactly which files you changed and the new test count.
