# Contributing to MEDCHECK

Thank you for your interest in contributing to MEDCHECK! As an evidence-based medicine intelligence tool, code quality, clinical verification, and test coverage are paramount.

## Code Standards & Philosophy
1. **Clinical Accuracy & Safety**: All interaction logic and side effect mappings must be cross-verified with official OpenFDA drug labels or peer-reviewed pharmacology reference data.
2. **Deterministic Guardrails**: The deterministic rule engine (`backend/services/mistral_parser.py`) is the primary defense against non-deterministic AI behavior. All new clinical rules must have unit test coverage.
3. **Design System**: All frontend UI must adhere to the **Clinical White** design tokens defined in `frontend/tailwind.config.js` and `frontend/src/index.css`.
4. **Commit Conventions**: Use conventional commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).

---

## Development Setup

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
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
# Run backend pytest suite
backend/venv/bin/pytest backend/tests/ -v

# Run frontend build verification
cd frontend && npm run build
```

---

## Submitting Pull Requests
1. Fork the repository and create a feature branch (`git checkout -b feat/my-clinical-feature`).
2. Ensure all tests pass.
3. Commit your changes following conventional commits (`git commit -m "feat: add drug interaction rule"`).
4. Push to your branch and open a Pull Request.
