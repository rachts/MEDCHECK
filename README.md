# MEDCHECK

MEDCHECK is an AI-powered medicine safety and clinical intelligence platform. Designed with institutional clinical authority, it evaluates multidimensional pharmacology across drug-drug interactions, side effect compounding, food administration timings, and gastrointestinal mucosal stress.

---

## 🎯 Features

- **Drug Interaction Matrix**: Pairwise pharmacokinetic and pharmacodynamic analysis with high-contrast, severity-coded clinical cards.
- **Side Effect Radar**: Frequency-ranked adverse reaction profiles (`>10%`, `1-10%`, `0.1-1%`, `<0.1%`) with multi-drug compounding risk detection.
- **Food Conflict Timeline**: 24-hour chronological daily dosing schedule surfacing meal buffers, dairy spacing, and grapefruit/alcohol contraindications.
- **Stomach Guardian™ Score**: Composite gastrointestinal mucosal load metric (0–100) factoring in COX-1 inhibition and PPI protective mitigation.
- **Contextual Medicine Profile**: 5-tab deep dive with prescribing indications, equivalent brand names, and personal administration notes.
- **Doctor's Safety Summary**: Instant clipboard export (Markdown) and printable clinical brief formatted for primary care provider visits.
- **Deterministic Rule Engine**: Zero-hallucination guardrail validating AI outputs against curated pharmacology rules and OpenFDA drug labels.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Lucide React
- **Typography**: Cormorant Garamond (Headlines), Inter (Body & UI), JetBrains Mono (Metrics)
- **Backend**: FastAPI, Pydantic v2, HTTPX, Python-dotenv
- **Database & Cache**: Supabase PostgreSQL + SQLite local fallback
- **Clinical Data**: OpenFDA Drug Label API + Curated Deterministic Pharmacology Rules
- **AI Processing**: Mistral AI (Optional for unstructured FDA label extraction)

---

## 📋 Prerequisites

- **Node.js**: 18.0+
- **Python**: 3.11+
- **Supabase Account**: (Optional — local SQLite cache operates out-of-the-box)

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The API will be live at `http://127.0.0.1:8000` (Interactive OpenAPI Swagger docs at `http://127.0.0.1:8000/docs`).

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env` in the project root or `backend/` and configure your API keys:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| :--- | :--- | :--- |
| `MISTRAL_API_KEY` | Optional | Mistral AI API key for unstructured FDA drug label analysis |
| `SUPABASE_URL` | Optional | Supabase PostgreSQL project URL |
| `SUPABASE_KEY` | Optional | Supabase service or anon API key |
| `PORT` | Optional | Backend port (default: `8000`) |
| `ALLOWED_ORIGINS`| Optional | Allowed CORS origins for API requests |

*Note: If no external keys are provided, MEDCHECK runs completely offline using its deterministic clinical knowledge base and local SQLite caching.*

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/check` | Analyze multi-drug interactions, GI load, and side effects |
| `GET` | `/api/medicine/{name}/profile` | Retrieve comprehensive clinical profile for a medicine |
| `GET` | `/api/medicines/search?q={query}` | Search indexed medications and brand aliases |
| `GET` | `/api/health` | Health check endpoint reporting cache and AI status |

---

## 🧪 Testing

Run the automated backend pytest suite (18 clinical & API tests):

```bash
backend/venv/bin/pytest backend/tests/ -v
```

Validate the frontend production build:

```bash
cd frontend && npm run build
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚖️ Medical Disclaimer

MEDCHECK provides informational guidance synthesized from OpenFDA drug labeling and established clinical pharmacology literature. It is not a substitute for clinical judgment or individualized medical advice. Always consult a qualified healthcare provider before altering any medication regimen.
