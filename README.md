# MEDCHECK

MEDCHECK is an AI-powered medicine safety and clinical intelligence platform. Designed with institutional clinical authority, it evaluates multidimensional pharmacology across drug-drug interactions, side effect compounding, food administration timings, and gastrointestinal mucosal stress.

---

## 🎯 Features

- **Drug Interaction Matrix**: Pairwise pharmacokinetic and pharmacodynamic analysis with high-contrast, severity-coded clinical cards backed by **17 curated gold-standard interaction rules** and OpenFDA label cross-referencing.
- **Side Effect Radar**: Frequency-ranked adverse reaction profiles (`>10%`, `1-10%`, `0.1-1%`, `<0.1%`) with multi-drug compounding risk detection (Bleeding, Sedation, Hypotension, Hyperkalemia, Hepatic strain).
- **Food Conflict Timeline**: Dynamic 24-hour chronological daily dosing schedule surfacing meal buffers, dairy spacing, and grapefruit/alcohol contraindications with configurable patient wake times.
- **Stomach Guardian™ Score**: Composite gastrointestinal mucosal load metric (0–100) factoring in NSAID gastric load (+25 multi-NSAID), anticoagulant bleeding hazards (+30), and PPI protective mitigation (-20).
- **Contextual Medicine Profile**: 5-tab deep dive with prescribing indications, equivalent brand names, and personal administration notes.
- **Doctor's Safety Summary**: Instant clipboard export (Markdown) and printable clinical brief formatted for primary care provider visits.
- **Deterministic Rule Engine**: Zero-hallucination guardrail validating AI outputs against evidence-annotated pharmacology rules and OpenFDA drug labels.
- **Clinical Authentication**: Instant anonymous Guest sessions alongside registered Doctor/Pharmacist user accounts.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Lucide React, TypeScript definitions
- **Typography**: Cormorant Garamond (Headlines), Inter (Body & UI), JetBrains Mono (Metrics)
- **Backend**: FastAPI, Pydantic v2, SlowAPI Rate Limiter, AnyIO Async SQLite, HTTPX
- **Security & Auth**: JWT (HS256) + direct `bcrypt` hashing, delivered to browsers in an `httpOnly` `SameSite=Lax` session cookie (the `Authorization: Bearer` header is still accepted for non-browser callers)
- **Database & Cache**: Local SQLite in WAL mode with TTL expiration + optional Supabase PostgreSQL sync
- **Clinical Data**: OpenFDA Drug Label API + Curated Deterministic Pharmacology Rules (17 pairs)
- **AI Processing**: Mistral AI (Optional circuit-breaker fallback for unstructured FDA label extraction)
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
| `GET` | `/api/medicine/{name}/profile` | Retrieve comprehensive clinical profile for a medicine |
| `GET` | `/api/medicines/search?q={query}` | Search indexed medications and brand aliases |

### Telemetry & Health
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check endpoint reporting cache, auth, and AI status |
| `POST` | `/api/client-error` | Telemetry endpoint for logging frontend UI exceptions |

---

## 🧪 Testing

Run the full automated backend test suite (**45 tests** across auth, password policy, endpoint contracts, validation, circuit breakers, cache TTL, and clinical pharmacology) from the repository root:

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
