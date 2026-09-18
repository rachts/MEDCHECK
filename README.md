# MEDCHECK

> **Live Deployment**:
> - 🌐 **Web Application**: [https://medcheck-official.vercel.app](https://medcheck-official.vercel.app)
> - ⚡ **Clinical API**: [https://medcheck-api-fptv.onrender.com](https://medcheck-api-fptv.onrender.com)
> - 📖 **Interactive API Documentation**: [https://medcheck-api-fptv.onrender.com/docs](https://medcheck-api-fptv.onrender.com/docs)
> - 🩺 **API Health Endpoint**: [https://medcheck-api-fptv.onrender.com/api/health](https://medcheck-api-fptv.onrender.com/api/health)

MEDCHECK is a clinical safety intelligence platform designed to evaluate multidimensional pharmacology across drug-drug interactions, side effect compounding, food administration timings, and gastrointestinal mucosal stress. It combines a deterministic, evidence-cited rule engine with live OpenFDA label data and safe fallback modes.

---

## 🎯 Features

- **Drug Interaction Matrix**: Pairwise pharmacokinetic and pharmacodynamic analysis with high-contrast, severity-coded clinical cards backed by a **foundational set of 17 high-risk, evidence-cited interaction rules** (citing FDA Black Box, CHEST, and KDIGO guidelines) with live OpenFDA label cross-referencing.
- **Side Effect Radar**: Frequency-ranked adverse reaction profiles (`>10%`, `1-10%`, `0.1-1%`, `<0.1%`) with multi-drug compounding risk detection (Bleeding, Sedation, Hypotension, Hyperkalemia, Hepatic strain).
- **Food Conflict Timeline**: Dynamic 24-hour chronological daily dosing schedule surfacing meal buffers, dairy spacing, and grapefruit/alcohol contraindications with configurable patient wake times.
- **Stomach Guardian Heuristic Score**: Heuristic gastrointestinal mucosal stress metric (0–100) factoring in NSAID gastric load (+25 multi-NSAID penalty), anticoagulant bleeding hazards (+30 synergy), and PPI protective mitigation (-20 credit). *(Educational heuristic based on established pharmacological mechanisms, not a diagnostic device.)*
- **Contextual Medicine Profile**: 5-tab deep dive with prescribing indications, equivalent brand names, and personal administration notes.
- **Doctor's Safety Summary**: Instant clipboard export (Markdown) and printable clinical brief formatted for primary care provider visits.
- **Deterministic Rule Engine**: Evidence-cited deterministic evaluation for known high-risk medication pairs with defensive fallback handling.
- **Session Management**: Registered accounts & guest sessions.

---

## 🌍 Formulary & Brand Coverage

MEDCHECK is currently optimized for **generic active pharmaceutical ingredients** (e.g. Paracetamol, Warfarin, Aspirin, Ibuprofen, Atorvastatin, Metformin, Pantoprazole) and **80+ curated international & Indian brand aliases** (`Dolo 650`, `Crocin`, `Pan 40`, `Ecosprin`, `Combiflam`, `Azithral`, `Volini`, `Gemer`, `Shelcal`, `Meftal Spas`, etc.) with automated dosage suffix normalization (`Dolo 650mg` → `paracetamol`).

- **Deterministic Core**: Evaluates evidence-cited high-risk rules and curated drug profiles (no generative AI in the clinical decision path).
- **Live Dynamic Fallback**: Queries the US OpenFDA drug label database for generic monographs.
- **Safe Unknown Fallback**: Refuses to fake a safe profile for unverified compounds, returning an explicit cautionary banner and zero-score safety notice.
- **Roadmap**: Full integration with Indian national/state formularies (CDSCO/Jan Aushadhi) and multi-ingredient fixed-dose combinations (FDCs).

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Lucide React, TypeScript definitions
- **Typography**: Cormorant Garamond (Headlines), Inter (Body & UI), JetBrains Mono (Metrics)
- **Backend**: FastAPI, Pydantic v2, SlowAPI Rate Limiter, AnyIO Async SQLite, HTTPX
- **Security & Auth**: JWT (HS256) + direct `bcrypt` hashing, delivered to browsers in an `httpOnly` `SameSite=Lax` session cookie (the `Authorization: Bearer` header is still accepted for non-browser callers)
- **Database & Cache**: Local SQLite in WAL mode with TTL expiration + optional Supabase PostgreSQL sync
- **Clinical Data**: OpenFDA Drug Label API + Curated Deterministic Pharmacology Rules (17 foundational pairs)
- **Clinical Engine**: Deterministic clinical engine; core pharmacological rules and OpenFDA label parsing operate with no generative AI in the clinical decision path.
- **Containerization**: Multi-stage Docker & Docker Compose

---

## 📋 Prerequisites

- **Node.js**: 18.0+
- **Python**: 3.11+
- **Docker & Docker Compose**: (Optional — for containerized deployment)
- **Supabase Account**: (Optional — local SQLite cache operates out-of-the-box)

---

## 🚀 Getting Started

### 1. Backend Setup

```bash
python -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Run `uvicorn` from the **repository root**, not from `backend/`. The app is
imported as the `backend.main` module (see `backend/__init__.py`), so the repo
root has to be the working directory or the import fails with
`ModuleNotFoundError: No module named 'backend'`.

The API will be live at `http://127.0.0.1:8000` (Interactive OpenAPI Swagger docs at `http://127.0.0.1:8000/docs`).

With no `JWT_SECRET` set, the backend generates an ephemeral development key and
says so on startup: tokens are invalidated on every restart. Set `JWT_SECRET` in
`backend/.env` for a stable local session. In `ENV=production` or `staging` the
app refuses to start without one of at least 32 characters.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at `http://localhost:5173`.

### 3. Docker Compose Deployment

```bash
# Set your environment variables in .env (or copy .env.example)
cp .env.example .env

# Build and start services
docker-compose up --build
```

---

## 🔐 Environment Variables

Configure your `.env` file in the project root:

```bash
cp .env.example .env
```

| Variable | Required | Description |
| :--- | :--- | :--- |
| `JWT_SECRET` | Required in Prod | Minimum 32-character secret key for signing session tokens. Unset in development means an ephemeral key regenerated on every restart |
| `ENV` | Optional | `development` \| `staging` \| `production` (default: `development`). Anything but `development` enforces the `JWT_SECRET` requirement |
| `AUDIT_IP_SALT` | Optional | HMAC key used to pseudonymise client IPs in the audit log. Derived from `JWT_SECRET` when unset; set it explicitly to keep audit records correlatable across a secret rotation |
| `FORCE_HTTPS` | Optional | Redirect plaintext HTTP to HTTPS in-app (default: `false`). Leave `false` when a reverse proxy terminates TLS, or requests redirect in a loop |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | Registered-session lifetime (default: 7 days) |
| `GUEST_TOKEN_EXPIRE_MINUTES` | Optional | Anonymous-session lifetime (default: 120 minutes) |
| `MISTRAL_API_KEY` | Optional | Mistral AI API key for unstructured FDA drug label extraction |
| `SUPABASE_URL` | Optional | Supabase PostgreSQL project URL |
| `SUPABASE_KEY` | Optional | Supabase service or anon API key |
| `REDIS_URL` | Optional | Backing store for rate-limit counters. In-memory when unset, which means limits are per-process and reset on restart |
| `PORT` / `HOST` | Optional | Backend bind address (defaults: `8000` / `0.0.0.0`) |
| `ALLOWED_ORIGINS`| Optional | Comma-separated CORS origins for API requests |
| `VITE_API_URL` | Optional | API base URL for the frontend. **Inlined into the JavaScript bundle at build time, so it must never hold a secret** |

*Note: If no external keys are provided, MEDCHECK runs completely offline using its deterministic clinical knowledge base and local SQLite caching.*

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user account |
| `POST` | `/api/auth/login` | Log in with username and password |
| `POST` | `/api/auth/guest` | Generate an instant anonymous clinical guest token |
| `POST` | `/api/auth/logout` | Clear the `httpOnly` session cookie |

### Clinical Intelligence (Protected by Bearer Token)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/check` | Analyze multi-drug interactions, GI load, and side effects |
| `GET` | `/api/medicine/{name}/profile` | Retrieve curated clinical profile for a medicine |
| `GET` | `/api/medicines/search?q={query}` | Search indexed medications and brand aliases |

### Telemetry & Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint reporting database, cache, and clinical KB version |
| `POST` | `/api/client-error` | Telemetry endpoint for logging frontend UI exceptions |

---

## 🧪 Testing

Run the full automated backend test suite (**60 tests** across auth, password policy, endpoint contracts, validation, circuit breakers, cache TTL, and clinical pharmacology) from the repository root:

```bash
backend/venv/bin/pytest backend/tests/ -v
```

Validate the frontend production build:

```bash
cd frontend && npm run build
```

Type-check the TypeScript half of the frontend (`src/lib/api.ts`, `src/types/api.ts`).
Vite strips types without verifying them, so this is the only thing that catches a
type error in the API client:

```bash
cd frontend && npm run typecheck
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## ⚖️ Medical Disclaimer

MEDCHECK provides informational guidance synthesized from OpenFDA drug labeling and established clinical pharmacology literature. It is not a substitute for clinical judgment or individualized medical advice. Always consult a qualified healthcare provider before altering any medication regimen.
