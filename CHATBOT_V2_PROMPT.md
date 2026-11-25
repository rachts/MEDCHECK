# TASK: Chatbot v2: simpler answers for Indian users, plus an AI fallback for medicines not in the database

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`). The medicine chatbot from the previous task is live: `POST /api/chat` in `backend/main.py`, prompt and context logic in `backend/services/medicine_chat.py`, Groq via `backend/services/groq_client.py`, page at `frontend/src/pages/Assistant.jsx`. Make the three changes below. Keep everything else about the chatbot, the API contract, and the design exactly as it is.

## Change 1: Make every chatbot answer simpler, written for Indian users
Update `SYSTEM_PROMPT_INITIAL` and `SYSTEM_PROMPT_FOLLOWUP` in `backend/services/medicine_chat.py`. Keep ALL existing strict grounding rules word for word in effect (answer only from the supplied data, never invent dosages, interactions, side effects or facts, admit plainly when the data does not cover something, never present the answer as medical advice). Add these language rules to both prompts:

- Write in very simple English: short sentences, everyday words, the way you would explain a medicine to a family member at home. Avoid clinical jargon; when a medical term from the data is important, explain it in simple words in brackets the first time, for example "INR (a blood test that shows how quickly the blood clots)".
- Address the reader in India: refer to the medicine by the brand name the visitor typed as well as the generic name when both are known; use familiar everyday references for timing and food only to illustrate what the supplied data already says (for example, "with your morning meal"), and never add a food rule, dose, or fact that is not in the supplied data.
- Keep the same six plain-language headings in the initial summary. Keep answers complete but not longer than the data needs.
- End every answer with exactly this line: "For your own treatment, please ask your doctor or pharmacist."
- No em dashes; use commas, colons, or semicolons.

## Change 2: AI fallback when the medicine is NOT in the database
Today, when a medicine cannot be resolved or its profile is the unknown fallback, `/api/chat` returns `found: false` with `ai_available: false` and makes no AI call. Change that branch (both places in `backend/main.py` where the chat endpoint returns `found: false`) as follows:

- If Groq is available (API key configured and the call succeeds), ask Groq for a general overview of the medicine the visitor typed, using a new `SYSTEM_PROMPT_FALLBACK` in `backend/services/medicine_chat.py`:
  - Simple English for Indian users, same language rules as Change 1.
  - Structure: What it is / What it is used for / Common side effects / Important cautions, in that order, from general knowledge.
  - It must not give personal dosing instructions or tell the reader what dose to take; general label-style information only.
  - It must not claim to come from the MEDCHECK database or from an official label.
- Response contract: add `ai_fallback: bool = False` and `disclaimer: Optional[str] = None` to `ChatResponse` in `backend/models.py` (and the matching type in `frontend/src/types/api.ts`). On the fallback path return: `found: false`, `ai_fallback: true`, `ai_available: true`, `answer` set to the Groq text, `profile: null`, `medicine` set to the name the visitor typed, and `disclaimer` set to exactly: "This is AI-fetched data, not from the MEDCHECK database. Kindly consult a pharmacist before use."
- If Groq is not available (no key, circuit open, or the call fails), return exactly today's response (`found: false`, `ai_fallback: false`, `ai_available: false`, `answer: null`, same not-found message). Never let a fallback failure become a 500.

## Change 3: Show the fallback honestly in the Assistant page
In `frontend/src/pages/Assistant.jsx`, when an entry has `ai_fallback: true`:
- Render the answer in a sheet that is visibly different from a database answer: a bordered notice at the very top of the entry, in the existing editorial style, reading "AI-FETCHED INFORMATION" followed by the disclaimer text from the response ("This is AI-fetched data, not from the MEDCHECK database. Kindly consult a pharmacist before use.").
- Do NOT render the MedicineDocket, Stomach Guardian, known interactions, source tags (no "CURATED LABEL KB" or similar), or any profile section for a fallback entry. There is no database profile, so nothing may look like one.
- Follow-up questions on a fallback medicine keep working through the same fallback path and keep the same notice.
- Database answers (`found: true`) render exactly as today.

## Tests
Extend `backend/tests/test_chatbot.py` (keep all existing tests passing):
- Unknown medicine with Groq mocked to succeed: 200, `found` false, `ai_fallback` true, `answer` present, `disclaimer` equals the exact string above, `profile` null.
- Unknown medicine with no Groq key: today's behaviour (`ai_fallback` false, `answer` null).
- Unknown medicine with Groq mocked to fail: today's behaviour, no 500.
- A known medicine still returns `ai_fallback` false and its profile.
Run the full backend suite and keep it green.

## Out of scope
No design changes beyond the fallback notice, no new dependencies, no changes to `/api/check`, search, or any other endpoint. Do not change the six summary headings or the grounding rules for database answers.

## Done when
- `npm run build` and `npm run typecheck` in `frontend/` pass; the full backend test suite passes.
- Your summary confirms: both system prompts updated with the simple-language and India rules, the fallback branch and new response fields in place, the Assistant fallback rendering with the notice and no docket, and the new tests passing.
