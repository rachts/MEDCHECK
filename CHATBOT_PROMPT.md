# TASK: Add a medicine chatbot to MEDCHECK, powered by Groq and grounded in real profile data

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`).

Add a chatbot where a visitor types the name of a medicine they are taking and gets the full information about that medicine: a plain-language explanation written by Groq, plus the complete structured profile the app already holds. The AI must be grounded in the app's real data; it must never invent drug facts.

## Step 0: the Groq client (do this first if it is not already done)
If `backend/services/groq_client.py` does not exist yet, first carry out `GROQ_MIGRATION_PROMPT.md` in the project root in full (rename `services/mistral_client.py` to `services/groq_client.py`, `call_groq_api`, `GroqCircuitBreaker`, `GROQ_API_KEY` and `settings.GROQ_MODEL` defaulting to `llama-3.3-70b-versatile`, endpoint `https://api.groq.com/openai/v1/chat/completions`, same circuit-breaker and retry behaviour, tests updated, zero remaining "mistral" references). The chatbot below is the client's first production caller. Do not add the Groq SDK or any new dependency; the client uses httpx.

## Backend: POST /api/chat
Add the endpoint in `backend/main.py` with its request/response models in `backend/models.py`, following the existing patterns of `/api/check`:
- Auth: the same Bearer token dependency as `/api/check` (guest tokens from `/api/auth/guest` are fine). Apply the same rate limiting as `/api/check`.
- Request: `{ "medicine": string, "question": string | null }`. `question` is null for the first ask about a medicine ("tell me everything about X") and set for follow-ups about the same medicine.
- Flow:
  1. Resolve `medicine` through the existing search/canonicalisation path (the same one `/api/medicines/search` uses), so brand names resolve to canonical generics (Dolo 650 to Paracetamol, Crocin to Paracetamol, Ecosprin to Aspirin). If nothing resolves, return HTTP 200 with `found: false` and a plain message that the medicine was not found in the database; make NO Groq call and invent nothing.
  2. Build the profile with the existing `get_or_build_medicine_profile` (the same builder behind `GET /api/medicine/{name}/profile`).
  3. Compose a grounded context from that profile only: overview, uses, side effects, food and alcohol rules, precautions, boxed warning if present, and known interactions.
  4. Call `call_groq_api` with a system prompt that requires: answer only from the supplied medicine data; plain, everyday language a non-medical reader understands; structure the first answer as what it is, what it is used for, how it is usually taken (only as the label data states), common side effects, food and alcohol cautions, and serious warnings; for follow-ups, answer the question from the same data; if the data does not cover something, say plainly that the available label data does not cover it and suggest checking the official label or a pharmacist; never invent dosages, interactions, side effects, or facts; never present the answer as medical advice. Temperature stays low (the client's existing setting).
  5. Response: `{ "found": true, "medicine": canonical name, "profile": the full MedicineProfileResponse, "answer": string | null, "ai_available": boolean }`.
- Honest degradation: if `GROQ_API_KEY` is not configured or the Groq call returns None (outage, breaker open), still return the profile with `answer: null` and `ai_available: false`. The endpoint must never fabricate an answer and never fail just because the AI is down.
- Tests in `backend/tests/`: unknown medicine returns `found: false`; with no API key configured the endpoint returns the profile with `answer: null` and `ai_available: false`; with `call_groq_api` mocked, a known medicine returns its answer and profile; unauthenticated requests are rejected the same way `/api/check` rejects them. The full backend suite must pass.

## Frontend: the Assistant page
- New route `/assistant` in the router and a new page `frontend/src/pages/Assistant.jsx`; add an "Assistant" entry to the Navbar (it sits beside Explorer and Account). Add a `chatAboutMedicine` call to `frontend/src/lib/api.ts` using the existing token handling.
- Design: the same editorial standard as the new homepage, dashboard, and explorer (parchment `#f8f6f0`, ink `#1a1a18`, terracotta `#8b2500`, forest `#2d4a22`; Newsreader + IBM Plex Serif + IBM Plex Mono; `border-radius: 0`; no shadows; no blur; no gradients; bespoke SVG icons from `frontend/src/pages/landing-icons.tsx` only, no Lucide; no emojis; no em dashes in UI copy). Reuse `app-editorial.css` patterns where they fit.
- Layout: a masthead (mono kicker, Newsreader heading, one serif sentence explaining the tool), then the conversation as a ruled ledger thread:
  - Visitor messages: rectangular ink blocks with parchment text.
  - Assistant answers: bordered parchment sheets. The first answer for a medicine shows the Groq plain-language summary first, then the full structured profile as a docket with ruled sections (Overview; Uses; Side Effects; Food and Alcohol; Precautions and Warnings, including any boxed warning in the critical treatment; Known Interactions). If `ai_available` is false, show the docket alone with one honest mono line: `PLAIN-LANGUAGE SUMMARY UNAVAILABLE; SHOWING THE LABEL PROFILE`.
  - If `found` is false, the assistant sheet says the medicine was not found and suggests checking the spelling or trying the generic name; no invented content.
  - A context line above the input shows `ASKING ABOUT: <MEDICINE>` once a medicine is active, with a rectangular "New medicine" control that clears the context. Follow-up questions go with that medicine.
- Input row: square parchment input with a 1px ink border and an ink Ask button. Three rectangular example chips to start: `Dolo 650`, `Warfarin`, `Metformin`.
- Loading state: a discrete IBM Plex Mono indicator, `READING THE LABEL`; no spinners, shimmer, or skeleton screens.
- A disclaimer strip under the thread, always visible: the assistant explains label information for education only, is not medical advice, and questions about personal treatment belong to a doctor or pharmacist.
- Errors (network, backend down): a bordered notice in the thread with a Retry control, worded honestly.

## Out of scope
No streaming, no voice, no server-side chat history or persistence, no changes to existing endpoints' behaviour, no changes to the landing page, dashboard, explorer, or auth internals, no new dependencies anywhere.

## Done when
- `npm run build` and `npm run typecheck` in `frontend/` pass; the backend test suite passes including the new chat tests.
- A grep sweep shows zero remaining "mistral" references outside of git history, and the new frontend files pass the same prohibited-pattern audit as the other redesigned pages (no shadows other than none, no border-radius other than 0, no backdrop-filter, no Lucide, no em dashes in UI strings, no white backgrounds).
- You summarise: files changed, the endpoint contract, how grounding and the no-key fallback work, and the test results. Note clearly that live Groq answers require `GROQ_API_KEY` in `backend/.env`, which the project owner adds himself; do not ask for the key in chat and do not hardcode any key.
