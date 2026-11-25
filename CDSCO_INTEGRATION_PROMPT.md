# MEDCHECK CDSCO Integration — India Banned Medicines

## Context

MEDCHECK must know which medicines are banned in India, using India's official
regulator data, and must explain it in very simple English for Indian users.

A verified dataset is ALREADY on disk at `backend/data/india_banned_medicines.json`
(726 entries). Do NOT modify this file. Its shape:

```json
{
  "dataset": "Medicines banned or halted in India",
  "generated": "2026-11-25",
  "authority": "Central Drugs Standard Control Organisation (CDSCO) ...",
  "note": "Bans are notified by composition (generic names), never by brand name. ...",
  "count": 726,
  "entries": [
    {
      "id": "in-banned-1",
      "name": "Amidopyrine",
      "kind": "single | fdc",
      "notification": "GSR 578(E) 23.07.1983",
      "date": "1983-07-23",
      "status": "Prohibited",
      "source": "CDSCO consolidated list ...",
      "source_url": "https://cdsco.gov.in/opencms/opencms/en/Data-Bank",
      "ingredients": ["amidopyrine"]
    }
  ]
}
```

Status values in the data include exactly: "Prohibited" (647), strings starting
with "Under examination", strings containing "Quashed", one "Prohibition revoked
with conditions", one starting with "Suspension revoked", and 35 entries whose
status starts with "Unapproved FDC" (CDSCO April 2025 directive). Some entries
have an empty `ingredients` list (descriptive classes that cannot be matched
safely). Some single-drug entries are qualified bans (the official name carries
the scope, e.g. "Nimesulide formulations for human use in children below 12
years of age").

Before coding, read: `backend/services/knowledge_base.py` (especially
`normalize_drug_query` and how FDC ingredients are known), `backend/services/medicine_chat.py`,
`backend/main.py` (chat, check and profile endpoints), `backend/models.py`,
`frontend/src/lib/api.ts`, `frontend/src/pages/Assistant.jsx`,
`frontend/src/pages/AppInterface.jsx`, `frontend/src/pages/MedicineDetail.jsx`,
`frontend/src/components/MedicineProfilePanel.jsx`.

## 1. Backend service: `backend/services/india_banned.py`

Load the JSON once at import (path resolved relative to the backend directory).
Expose:

- `lookup_ban(ingredient_names: list[str]) -> Optional[BanMatch]` where
  ingredient_names are the normalised generic ingredients of ONE medicine or
  ONE combination product.
- `search_banned(query: str, limit: int = 20) -> list[dict]` — case-insensitive
  substring match over entry `name` and `ingredients`.
- `ban_stats() -> dict` — counts: total, prohibited, unapproved, under_examination,
  quashed_or_revoked.

Matching rules:

- Normalise every ingredient before comparing: lowercase, trim, collapse spaces,
  strip salt words (hydrochloride, hydrobromide, sodium, succinate, sulphate,
  sulfate, maleate, fumarate, phosphate, tartrate, hcl, hbr) and strength or
  form words. Reuse `normalize_drug_query` where it helps, but the comparison
  must work on the dataset's `ingredients` values as stored.
- Single entries (`ingredients` length 1): match when the medicine's single
  canonical ingredient equals the entry ingredient. If the entry's official
  `name` is longer than the plain drug name (a scope qualifier), set
  `qualified=True` and always return the full official name.
- FDC entries (`ingredients` length 2 or more): match ONLY when the set of the
  product's ingredients equals the entry's ingredient set exactly. Never match
  a basket of separate medicines against an FDC entry.
- Entries with empty `ingredients` never match in `lookup_ban` (search only).
- Return the entry's `status` verbatim. Never flatten a non-"Prohibited" status
  into "banned".

`BanMatch` carries: entry_name, kind, status, notification, date, source,
qualified, plus `heading` and `message` from the plain-language function below.

## 2. Plain-language status text (deterministic, in india_banned.py)

`plain_status(entry) -> (heading, message)` with EXACTLY these templates.
Simple English, short sentences, no em dashes, no emojis.

- status == "Prohibited", not qualified:
  heading: `BANNED IN INDIA`
  message: "This medicine is banned in India. The Government of India has stopped its manufacture and sale. Notification: {notification}. Please do not buy or use this medicine. If you are already taking it, please talk to your doctor before you stop, and ask for a safe alternative."
- status == "Prohibited", qualified:
  heading: `BANNED IN INDIA IN THIS CASE`
  message: "This medicine is banned in India in a specific case. The official entry says: {name}. Notification: {notification}. Please read the case carefully and talk to your doctor or pharmacist."
- status starts with "Unapproved FDC":
  heading: `STOPPED IN INDIA: NOT APPROVED`
  message: "This combination medicine was sold without approval from CDSCO, India's drug regulator. In April 2025, CDSCO ordered every state to stop its manufacture and sale. Please do not buy or use this combination. Ask your doctor for an approved alternative."
- status starts with "Under examination":
  heading: `UNDER GOVERNMENT EXAMINATION`
  message: "The Government of India questioned this combination in 2016. It is still under examination, so it is not on the final banned list. Please ask your doctor or pharmacist before using it."
- status contains "Quashed" or "revoked":
  heading: `BAN CANCELLED BY COURT`
  message: "This medicine was banned earlier, but the ban is not in force now. Official status: {status}. Please ask your doctor or pharmacist before using it."
- any other status:
  heading: `INDIA REGULATORY STATUS`
  message: "Official status recorded by CDSCO: {status}. Notification: {notification}. Please ask your doctor or pharmacist before using it."

## 3. API wiring

models.py — add:

```python
class IndiaBanInfo(BaseModel):
    matched: bool
    heading: str
    message: str
    entry_name: str
    status: str
    notification: Optional[str] = None
    date: Optional[str] = None
    source: str
    qualified: bool = False
```

- Add `india_ban: Optional[IndiaBanInfo] = None` to `ChatResponse`,
  `MedicineProfileResponse`.
- Add `india_ban_overview: bool = False` to `ChatResponse`.
- Check response: add top-level `india_ban_alerts: list[IndiaBanAlert]` where
  `IndiaBanAlert = {medicine: str, info: IndiaBanInfo}` (default empty list).

POST /api/chat:

- After resolving the medicine, compute ONE ingredient list for the ban check:
  for a found medicine, its canonical generic plus, if the medicine is itself a
  combination product, its FDC ingredients (use the same ingredient knowledge
  the therapeutic duplication engine uses); if the user typed a combination
  ("A + B"), the typed parts normalised; for an unknown single name, the
  normalised typed name.
- If `lookup_ban` matches, set `india_ban` on the response. The answer becomes:
  the ban `message` first; then, ONLY if a profile was found AND Groq is
  available, the AI summary appended after a blank line. If Groq is unavailable,
  the answer is the ban message alone. The AI must never soften or contradict
  the ban: when a ban is active, add the entry name, status and notification to
  the system prompt context and require the warning to be kept.
- Follow-up messages in a conversation whose medicine has an active ban keep
  `india_ban` on every response.
- General question: if the message contains "banned" or "ban list" and no
  specific medicine resolves, return a deterministic overview answer built from
  `ban_stats()`: simple English stating how many entries are on India's banned
  list in this app, that bans are by ingredient (composition) names and never
  by brand names, the first 8 "Prohibited" single-drug entry names as examples,
  and an invitation to type any medicine name to check it. For this response:
  found=false, ai_fallback=false, profile=null, india_ban_overview=true.

GET /api/medicine/{name}/profile: set `india_ban` from the profile medicine's
ingredient list (same rule as chat).

POST /api/check: for each basket medicine, resolve ITS OWN ingredient set
(single generic, or its FDC ingredients if it is a combination product) and run
`lookup_ban`. Collect matches into `india_ban_alerts`. Do NOT combine
ingredients across different basket items.

New endpoint: GET /api/india/banned?query=&limit=20 returns
`{total: int, results: [{name, kind, status, notification, date, ingredients}]}`.
Empty query returns the first `limit` Prohibited entries. Same auth as the other
read endpoints (guest token allowed).

## 4. Frontend

- `lib/api.ts`: add the `IndiaBanInfo` type; surface `india_ban` from chat and
  profile responses and `india_ban_alerts` from check responses; add
  `searchIndiaBanned(query)`.
- `Assistant.jsx`: when a thread entry has `india_ban` with matched=true, render
  at the very top of that entry, before any docket: a full-border critical
  notice in the editorial style (1px solid border in the critical colour,
  border-radius 0, no shadow): mono kicker `CDSCO · GOVERNMENT OF INDIA`, the
  heading as title, the message as plain text, and a mono footnote line
  `Official entry: {entry_name} · {notification} · Source: CDSCO Data Bank`.
  Overview responses render as normal prose. All existing rendering (profile
  docket, AI-fetched notice) stays unchanged.
- `AppInterface.jsx`: when `results.india_ban_alerts` is non-empty, show a
  critical banner above the results, one line per alert:
  `{medicine}: {heading}. Please do not use it. Talk to your doctor for a safe alternative.`
  with the official entry name in small mono text under the line. Same editorial
  critical styling.
- `MedicineDetail.jsx` and `MedicineProfilePanel.jsx`: when
  `profile.india_ban?.matched`, show the critical strip under the medicine
  title: heading, the message, and the official-entry footnote line.
- All new copy: simple English, no em dashes, no emojis. Ban and severity are
  always printed as words, never colour alone.

## 5. Tests: `backend/tests/test_india_banned.py`

- lookup ["phenacetin"] matches, status "Prohibited", qualified False.
- lookup ["amoxicillin", "serratiopeptidase"] matches the June 2026 FDC entry.
- lookup ["paracetamol"] is None; lookup ["amoxicillin"] is None.
- lookup ["nimesulide"] matches with qualified True and the official name
  mentioning children below 12 years.
- lookup for one entry whose status contains "Quashed" returns that status verbatim.
- API: POST /api/chat with message "Phenacetin" returns india_ban.matched true
  and an answer containing "banned in India", with no GROQ_API_KEY set.
- API: POST /api/chat with message "which medicines are banned in India"
  returns india_ban_overview true.
- API: POST /api/check with a basket containing a banned FDC product returns a
  non-empty india_ban_alerts; a basket of Paracetamol and Amoxicillin as
  separate medicines returns empty alerts.
- API: GET /api/india/banned?query=serratiopeptidase returns results including
  a 2026 entry.
- The full backend test suite passes, and the frontend typecheck and build pass.

## Hard rules

- Do NOT modify `backend/data/india_banned_medicines.json`.
- All changes are additive: existing behaviour for non-banned medicines is
  unchanged, and every new response field is optional.
- No new dependencies. No git push, no deploy.
- Follow the 30-point editorial design standard for all new UI: parchment and
  ink, no shadows, no rounded corners, no gradients, no blur, no Lucide icons
  on the redesigned pages.
