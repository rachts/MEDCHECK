# Contributing to MEDCHECK

Thank you for your interest in contributing to MEDCHECK! As an evidence-based medicine intelligence tool, code quality, clinical verification, and test coverage are paramount.

## Code Standards & Philosophy
1. **Clinical Accuracy & Safety**: All interaction logic and side effect mappings must be cross-verified with official OpenFDA drug labels or peer-reviewed pharmacology reference data.
2. **Deterministic Guardrails**: The curated rule table in `backend/services/clinical_rules.py`, applied by `backend/services/interaction_analyzer.py`, is the primary defense against non-deterministic AI behavior — the optional Mistral path in `backend/services/mistral_client.py` is validated against it, never trusted directly. All new clinical rules must have unit test coverage.
3. **Design System**: All frontend UI must adhere to the **Clinical White** design tokens defined in `frontend/tailwind.config.js` and `frontend/src/index.css`.
4. **Commit Conventions**: Use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

---

## Development Setup

### Backend (FastAPI)

Run from the **repository root** — the app is imported as the `backend.main`
module, so starting `uvicorn` from inside `backend/` fails with
`ModuleNotFoundError: No module named 'backend'`.

```bash
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

---

## Running Tests
Always run the test suite before submitting a pull request:

```bash
# Run backend pytest suite (45 tests) from the repository root
backend/venv/bin/pytest backend/tests/ -v

# Run frontend build verification
cd frontend && npm run build

# Type-check the TypeScript half of the frontend (Vite strips types
# without checking them, so the build alone will not catch this)
cd frontend && npm run typecheck
```

---

## Submitting Pull Requests
1. Fork the repository and create a feature branch (`git checkout -b feat/my-clinical-feature`).
2. Ensure all tests pass.
3. Commit your changes following conventional commits (`git commit -m "feat: add drug interaction rule"`).
4. Push to your branch and open a Pull Request.
