# MEDCHECK CDSCO Follow-up — Profile-endpoint ban fallback for non-curated medicines

## Context

The CDSCO integration is built and independently verified (2026-11-25, ~04:20–05:30 IST):
backend tests 96 passed, frontend typecheck and build pass, matcher probed 16/16
correct against the real 726-entry dataset at `backend/data/india_banned_medicines.json`
(Do NOT modify this file).

One gap remains, found in that verification. The chatbot, the basket check
(`/api/check`) and curated medicine profiles all flag banned medicines correctly,
but the medicine profile page does not for medicines that are NOT in MEDCHECK's
own curated list:

- `POST /api/chat {"medicine": "Phenacetin"}` → india_ban "BANNED IN INDIA",
  notification GSR 578(E) 23.07.1983. Correct.
- `GET /api/medicine/Phenacetin/profile` → `india_ban: null`, so
  `/medicine/Phenacetin` shows no ban strip at all.

Cause (from the verification report): the profile endpoint in `backend/main.py`
only sets `india_ban` from the profile's resolved ingredients, and for a medicine
with no curated profile (unverified / OpenFDA-built) it resolves no ingredients,
so it never calls the ban matcher.

Before coding, read: `backend/main.py` (profile endpoint),
`backend/services/india_banned.py` (`lookup_ban`, `search_banned`, `ban_stats`),
`backend/services/knowledge_base.py` (`normalize_drug_query` — it already strips
trailing parentheticals such as " (Acetaminophen)" and collapses whitespace around
"/", reuse it, do not re-implement it), and `frontend/src/pages/MedicineDetail.jsx`
(how the ban strip renders when `india_ban` is present).

## The fix (backend only, unless the strip itself is missing)

1. In the profile endpoint, after the existing ingredient-based lookup, add a
   fallback: if the profile carries no resolved ingredients (or the ingredient
   lookup returned no match), run `lookup_ban` on the normalised requested name
   — the single name the visitor typed / the URL name, passed through
   `normalize_drug_query`. For a combination typed with "+" or "/", split it
   into its ingredient names first and look that combination up, exactly as the
   chat endpoint already does.
2. Return the match in the same `india_ban` shape the endpoint already returns
   for curated medicines (heading, official entry name, notification, date,
   status, source). Do not invent a new shape, and do not change the shape for
   curated profiles.
3. Preserve the exact-status honesty the CDSCO build already has: a qualified
   ban (e.g. Nimesulide, banned only for children below 12) keeps its qualified
   heading; a stayed, quashed or revoked ban keeps its exact official status
   wording and must never be flattened into a plain "BANNED IN INDIA".
4. No change to the dataset, the matcher, the chatbot, or `/api/check`.
   Frontend: no change expected — the strip already renders when `india_ban` is
   present. If, and only if, the strip does not appear on `/medicine/Phenacetin`
   once the API returns the match, fix the rendering in `MedicineDetail.jsx`
   in the same editorial style (terracotta-bordered notice, square corners,
   no shadow, severity as a word).

## Regression tests (add to the existing CDSCO test file, do not drop any)

- `GET /api/medicine/Phenacetin/profile` → india_ban present, heading
  "BANNED IN INDIA", notification GSR 578(E) 23.07.1983.
- `GET /api/medicine/Amoxicillin%20%2B%20Serratiopeptidase/profile` (or the
  equivalent combination name) → india_ban present, June 2026 FDC entry.
- `GET /api/medicine/Paracetamol/profile` → india_ban null (must not
  false-positive on a safe medicine).
- `GET /api/medicine/Gemer/profile` → india_ban still present with the exact
  April 2025 entry (no regression on curated FDCs).
- `GET /api/medicine/Nimesulide/profile` → qualified heading, children-below-12
  scope preserved, not a flat ban.
- `GET /api/medicine/Warfarin/profile` → india_ban null (no regression).

## Checks before reporting done

- Full backend suite passes (`venv/bin/python -m pytest tests -q`).
- `npm run typecheck` and `npm run build` pass.
- No other endpoint's behaviour changes; the chatbot and `/api/check` responses
  are byte-identical for the probe medicines above.

## Out of scope

Do not touch the CDSCO dataset, the Groq/chatbot AI paths, Auth, or the
production deploy. Do not add new UI beyond the existing ban strip. This is a
small, targeted fix: one fallback in one endpoint plus tests.
