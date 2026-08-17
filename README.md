# MedCheck — AI-Powered Medicine Safety & Drug Interaction Assistant

MedCheck is a production-quality medicine safety assistant built on the **Botanical Intelligence** glassmorphic design system. It allows patients, caregivers, and clinicians to enter multiple medications into a **Medicine Basket** and analyze pairwise drug-drug interactions, contraindications, and clinical warnings in real time.

---

## 🌟 Key Features

- **Interactive Medicine Basket**: Add, remove, and manage prescriptions and over-the-counter medications with instant deduplication and keyboard shortcuts.
- **Pairwise Combinatorial Engine**: Evaluates all $\binom{N}{2}$ unique drug pairs (e.g. $A+B, A+C, B+C$) without duplicate checks.
- **Cache-First Pharmacology Pipeline**: Queries cached clinical interaction pairs before calling external services, guaranteeing sub-second response times.
- **Live OpenFDA & Clinical Parsing**: Fetches structured drug label warnings from `api.fda.gov` and uses Mistral AI for clinical extraction with deterministic rule fallbacks.
- **Clear Severity Visualizations**: Distinct, accessible color codes for **High Risk** (`#E07A5F`), **Moderate Risk** (`#E8C547`), and **Low Risk / Safe** (`#A8D5BA`).
- **One-Click Demo Mode**: Preload clinical test scenarios (e.g., Warfarin + Aspirin high risk, Aspirin + Ibuprofen moderate risk, Paracetamol + Amoxicillin safe) for instant evaluation.
- **Strict Medical Safety Guardrails**: Prominent, legally compliant disclaimers ensuring guidance is purely informational.

---

## 🏗️ Architecture & Tech Stack

```
MedCheck Full-Stack Architecture
┌────────────────────────────────────────────────────────┐
│               Frontend (React 18 + Vite)               │
│    Tailwind CSS • Botanical Intelligence Theme         │
│  MedicineBasket • InteractionCard • SafeState • Auth   │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP POST /api/check
┌──────────────────────────▼─────────────────────────────┐
│                 Backend (FastAPI)                      │
│     Pairwise Combination • Input Sanitization          │
└──────────────┬──────────────────────────┬──────────────┘
               │                          │
      ┌────────▼─────────┐       ┌────────▼─────────┐
      │  Supabase / DB   │       │  OpenFDA & AI    │
      │  Cached Pairs    │       │  api.fda.gov     │
      │  SQLite Fallback │       │  Mistral Parser  │
      └──────────────────┘       └──────────────────┘
```

- **Frontend**: React 18, Vite, React Router v6, Tailwind CSS, Lucide Icons, Google Fonts (`Playfair Display`, `DM Sans`).
- **Backend**: FastAPI, Uvicorn, Pydantic v2, HTTPX (async client), Python Dotenv.
- **Database & Cache**: Supabase PostgreSQL (with automatic zero-config SQLite local cache fallback).
- **Clinical Data**: OpenFDA Drug Label API & Mistral AI parser.

---

## 📁 Project Structure

```text
medcheck/
├── backend/
│   ├── main.py                  # FastAPI server & endpoints (/api/health, /api/check)
│   ├── models.py                # Pydantic schemas for requests & responses
│   ├── seed.py                  # Database seed script for top 10 medicines & pairs
│   ├── requirements.txt         # Python dependencies
│   ├── .env.example             # Example backend environment variables
│   └── services/
│       ├── openfda.py           # Async OpenFDA API client
│       ├── mistral_parser.py    # Mistral AI parser & clinical rule engine
│       └── supabase_cache.py    # Supabase PostgreSQL client + SQLite local fallback
│
├── frontend/
│   ├── index.html               # Main HTML entrypoint with typography & meta tags
│   ├── vite.config.js           # Vite dev and build configuration
│   ├── tailwind.config.js       # Botanical Intelligence theme tokens & glassmorphic styles
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # React router (/ , /app, /auth)
│       ├── index.css            # Custom glassmorphic utilities & animations
│       ├── context/
│       │   └── MedicineContext.jsx # Global medicine basket & check results state
│       ├── hooks/
│       │   ├── useMedicineBasket.js # Basket operations hook
│       │   └── useDrugCheck.js      # Drug check execution hook
│       ├── lib/
│       │   └── api.js               # API client with error normalization
│       ├── components/
│       │   ├── Navbar.jsx           # Glassmorphic header with navigation & demo mode
│       │   ├── MedicineBasket.jsx   # Core input form, add button & chips
│       │   ├── MedicineChip.jsx     # Tactile pill chips with remove action
│       │   ├── InteractionCard.jsx  # Severity-coded interaction result card
│       │   ├── SafeState.jsx        # Calm, reassuring verified profile state
│       │   ├── LoadingState.jsx     # Pulse scanner & skeleton placeholders
│       │   ├── ErrorState.jsx       # Graceful error handler & retry trigger
│       │   ├── DemoModeToggle.jsx   # Quick preset scenario loader
│       │   ├── Disclaimer.jsx       # Medical disclaimer banner
│       │   └── Footer.jsx           # Editorial glassmorphic footer
│       └── pages/
│           ├── Landing.jsx          # Hero section, 3-step workflow & trust signals
│           ├── AppInterface.jsx     # Central Medicine Basket & live results panel
│           └── Auth.jsx             # Non-blocking Sign In & Sign Up tabbed view
│
├── supabase/
│   └── schema.sql               # PostgreSQL schema (medicines, drug_details, interaction_pairs)
└── README.md
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

```env
# Optional: Mistral AI API Key for unstructured label parsing
MISTRAL_API_KEY=

# Optional: Supabase PostgreSQL credentials (uses local SQLite cache if omitted)
SUPABASE_URL=
SUPABASE_KEY=

# Server Port & CORS
PORT=8000
HOST=0.0.0.0
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

## 🚀 Quick Start Guide

### 1. Backend Setup

```bash
cd backend

# Create & activate Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Seed the database with common medicines & interaction pairs
python seed.py

# Start the FastAPI server
uvicorn main:app --reload --port 8000
```

The backend will be live at `http://localhost:8000`. Test health with:
```bash
curl http://localhost:8000/api/health
```

### 2. Frontend Setup

In a separate terminal:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔌 API Endpoints

### `GET /api/health`
Returns the operational health of the backend service.

**Response:**
```json
{
  "status": "ok",
  "service": "MedCheck API",
  "version": "1.0.0"
}
```

### `POST /api/check`
Analyzes interactions across all unique pairs of submitted medicines.

**Request:**
```json
{
  "medicines": ["warfarin", "aspirin"]
}
```

**Response (Interaction Detected):**
```json
{
  "medicines": ["warfarin", "aspirin"],
  "interactions": [
    {
      "drug_a": "warfarin",
      "drug_b": "aspirin",
      "severity": "high",
      "explanation": "Combining Warfarin (an anticoagulant) with Aspirin (an antiplatelet agent) significantly amplifies the risk of major internal and gastrointestinal bleeding. Co-administration requires strict medical supervision and INR monitoring."
    }
  ],
  "safe": false,
  "summary": "Identified 1 potential interaction.",
  "analyzed_pairs_count": 1
}
```

**Response (No Interaction Detected):**
```json
{
  "medicines": ["paracetamol", "amoxicillin"],
  "interactions": [],
  "safe": true,
  "summary": "No known interactions detected between the selected medicines in our database.",
  "analyzed_pairs_count": 1
}
```

---

## 🧪 Testing & Verification

1. **Backend Unit & API Tests:**
   ```bash
   cd backend
   venv/bin/python3 -m compileall .
   ```
2. **Frontend Production Build:**
   ```bash
   cd frontend
   npm run build
   ```

---

## ⚕️ Medical Disclaimer

> **IMPORTANT:** MedCheck provides informational guidance based on available clinical pharmacology and OpenFDA data. It is **not** a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider before starting, stopping, or altering any medication regimen.
