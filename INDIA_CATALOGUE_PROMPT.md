# MEDCHECK — Indian Medicines Catalogue Integration

## Context

MEDCHECK's clinical database is small (curated profiles + OpenFDA). A user-supplied
Indian medicine catalogue has been prepared and already sits in the project at
`backend/data/india_medicines.sqlite` (do NOT modify this file, and do not modify
the source CSV in Downloads). It holds **222,664 Indian brand products** deduped
from 248,218 source rows. Schema (already built, use exactly this):

```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,              -- display name, e.g. 'telma 40 tablet'
    search_key TEXT NOT NULL UNIQUE, -- normalised: lowercase, non-alnum runs -> single space
    substitutes TEXT NOT NULL DEFAULT '[]',   -- JSON array of brand names, same composition
    side_effects TEXT NOT NULL DEFAULT '[]',  -- JSON array of plain-language effect names
    no_common_side_effects INTEGER NOT NULL DEFAULT 0,
    uses TEXT NOT NULL DEFAULT '[]',          -- JSON array of indication strings
    chemical_class TEXT,
    habit_forming INTEGER NOT NULL DEFAULT 0,
    therapeutic_class TEXT,
    action_class TEXT
);
CREATE INDEX idx_products_search_key ON products(search_key);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
```

The catalogue has **no composition/ingredient column, no interactions, no
frequencies, no severity grading**. It is reference data only. The honesty rules
below are the point of this task: catalogue data must never be dressed up as
clinical data.

## Task

### 1. New backend service `backend/services/india_catalogue.py`

- Resolve the DB path the same way `india_banned.py` resolves its JSON path
  (relative to the backend directory). If the file is missing, every function
  returns empty/None and logs a warning; never raise.
- Open a fresh `sqlite3` connection per call (the DB is ~101 MB; never load all
  rows into memory).
- `catalogue_search_key(name)`: lowercase, `re.sub(r"[^a-z0-9]+", " ", s)`,
  strip. Must match the prep normalisation exactly.
- `search_catalogue(query, limit=10) -> list[CatalogueProduct]`: normalise the
  query to a key; empty key returns []. Ranking: (a) exact `search_key` match,
  (b) prefix matches (`search_key = key` or starts with `key + ' '`), shortest
  name first, (c) substring matches (`key` occurs anywhere in `search_key`),
  shortest name first. No duplicates; respect `limit`.
- `match_product_for_chat(typed) -> Optional[CatalogueProduct]`: exact
  `search_key` match; otherwise, candidates whose `search_key` starts with
  `key + ' '` AND whose remaining suffix is exactly one form word from:
  tablet, tablets, capsule, capsules, syrup, injection, cream, gel, drops,
  suspension, ointment, lotion, powder, spray, solution, sachet, granules,
  mouthwash, soap, shampoo, oil, balm, paste, strip, strips, kit, pen,
  rotacaps, respules, inhaler, suppository, pessary, enema, vial, ampoule.
  Return the match only if exactly one such candidate exists; else None.
- `catalogue_stats() -> dict`: product count + meta table contents.
- Parse the JSON columns into lists; map `habit_forming`/`no_common_side_effects`
  ints to bools.

### 2. Models (`backend/models.py`)

Add:

```python
class CatalogueProduct(BaseModel):
    name: str
    substitutes: List[str] = []
    side_effects: List[str] = []
    no_common_side_effects: bool = False
    uses: List[str] = []
    chemical_class: Optional[str] = None
    habit_forming: bool = False
    therapeutic_class: Optional[str] = None
    action_class: Optional[str] = None

class CatalogueSearchResponse(BaseModel):
    total: int
    results: List[CatalogueProduct] = []
```

Add to `ChatResponse`: `catalogue_match: bool = False` and
`catalogue: Optional[CatalogueProduct] = None`.

### 3. Chat integration (`backend/services/medicine_chat.py` + `/api/chat` in `backend/main.py`)

Add the constant, exact text:

```python
CATALOGUE_DISCLAIMER = (
    "This is from the Indian medicines catalogue, not from the MEDCHECK clinical "
    "database. It has no interaction check and no stomach safety score. "
    "Kindly consult a pharmacist before use."
)
```

Add `build_catalogue_answer(product, question=None) -> str` in medicine_chat.py.
Deterministic, no AI call. Very simple English, short sentences, no em dashes.
Sections in this order:

- If `question` is not None, lead with: "The catalogue holds basic information
  only. It does not cover doses or interactions with other medicines. Here is
  everything it has for this medicine:"
- "What it is:" — the product name, plus its therapeutic class and action class
  when present, in one or two plain sentences.
- "What it is used for:" — the uses, joined as a readable list; if none, say the
  catalogue does not list uses for this medicine.
- "Common side effects:" — the side-effect list joined with commas; if
  `no_common_side_effects`, write "The catalogue says no common side effects
  are usually seen for this medicine."; if the list is empty otherwise, say the
  catalogue does not list side effects for this medicine.
- "Other brands with the same composition:" — the substitutes joined with
  commas, only when non-empty.
- If `habit_forming`: "Caution: this medicine can be habit forming. Take it
  only as your doctor says."
- End with exactly: "For your own treatment, please ask your doctor or pharmacist."

Wire into `/api/chat` in the branch where clinical resolution failed, in this
exact order (existing ban behaviour is unchanged and stays ahead):

1. Existing CDSCO ban logic runs exactly as today. If it matches, the response
   is exactly as today (no catalogue attachment in that sub-branch).
2. Else, `product = match_product_for_chat(medicine)`. If a product matches,
   also run the existing ban check on the product itself:
   `lookup_ban(resolve_ban_ingredients(product.name))` (reuse the existing
   helpers; do not re-implement normalisation). Then return a ChatResponse with
   `found=false`, `medicine` = the typed name, `profile=None`,
   `ai_fallback=false`, `ai_available=false`, `catalogue_match=true`,
   `catalogue=product`, `answer=build_catalogue_answer(product, question)`,
   `disclaimer=CATALOGUE_DISCLAIMER`, and `india_ban` set if that product ban
   check matched (else None).
3. Else, the existing AI-fallback / not-found behaviour, byte-identical to today.

Clinical resolution must always win: a medicine MEDCHECK knows clinically
(e.g. Dolo 650) returns exactly what it returns today. The ban-overview branch
("which medicines are banned in India") is unchanged.

### 4. New endpoint (`backend/main.py`)

`GET /api/india/catalogue/search?query=&limit=10` returning
`CatalogueSearchResponse` (`total` = number returned), with the same auth and
rate-limit pattern as `GET /api/india/banned`.

### 5. Frontend

- `frontend/src/lib/api.ts`: add `CatalogueProduct` and
  `CatalogueSearchResponse` types, `searchIndiaCatalogue(query, limit)` calling
  the new endpoint (same auth-header pattern as `searchIndiaBanned`), and extend
  the `ChatResponse` type with `catalogue_match` and `catalogue`.
- `frontend/src/pages/Assistant.jsx`: when a thread entry has
  `catalogue_match` true, render it as a catalogue entry:
  - At the very top, a full-border ink notice (editorial standard, no shadow,
    no rounded corners): mono kicker "INDIAN MEDICINES CATALOGUE · REFERENCE
    DATA" and the disclaimer text from the response.
  - If `india_ban` is also present, the existing IndiaBanNotice renders above
    this notice (ban first, as today).
  - Then the answer prose.
  - Then, if `catalogue.substitutes` is non-empty, a ruled list headed
    "OTHER BRANDS WITH THE SAME COMPOSITION" with the substitute names.
  - Then, if `catalogue.habit_forming`, the caution line from the answer is
    already included; do not duplicate it.
  - NO MedicineDocket, no Guardian score, no interactions section, no source
    tags on catalogue entries. Database and AI-fallback entries render exactly
    as before.
  - On mount, read the `medicine` query parameter (`useSearchParams`); if
    present and the thread is empty, submit it as the first message
    automatically (same code path as typing it and pressing send).
- Dashboard search typeahead (`frontend/src/pages/AppInterface.jsx`, the
  component rendering `searchMedicines` results): after the clinical results,
  when `searchIndiaCatalogue` returns results, render a separated group headed
  with the small mono label "FROM THE INDIAN MEDICINES CATALOGUE", up to 5
  rows showing the product name and its therapeutic class. Clicking a catalogue
  row navigates to `/assistant?medicine=<url-encoded name>`. Catalogue rows
  must NEVER add the medicine to the basket and must not trigger analysis.
  Clinical rows behave exactly as before. The landing page hero scan is out of
  scope.

### 6. Tests (`backend/tests/test_india_catalogue.py`, new)

Build a tiny fixture SQLite DB in `tmp_path` with the exact DDL above and a few
products (include: "telma 40 tablet" with substitutes/uses/side effects;
"telma 80 tablet"; "dolo 650 tablet"; "phenacetin tablet"; one habit-forming
syrup), and point the service at it (however the service resolves its path,
make it overridable for tests). Cover:

- `search_catalogue` ranking: exact beats prefix beats substring; limit
  respected; empty/blank query returns [].
- `match_product_for_chat`: "Telma 40" matches telma 40 tablet; "telma" alone
  returns None (ambiguous); exact full name matches; unknown returns None.
- Chat API: a medicine unknown to the clinical DB that matches the catalogue
  returns `catalogue_match=true`, the exact `CATALOGUE_DISCLAIMER`,
  `profile=None`, `ai_fallback=false`; a follow-up question keeps the
  catalogue path; "phenacetin tablet" returns `india_ban` present AND
  `catalogue_match=true`.
- Missing DB file: catalogue search endpoint returns total 0 and chat falls
  back to the previous not-found behaviour without a 500.
- Regression: chat for "Dolo 650" still returns the clinical profile
  (`found=true`), unchanged.

## Hard rules

- Do NOT modify `backend/data/india_medicines.sqlite`, the source CSV,
  `backend/data/india_banned_medicines.json`, or the CDSCO matcher.
- No new dependencies. Backend: stdlib `sqlite3`/`json` only.
- Never invent composition, interactions, GI scores, side-effect frequencies
  or severities for catalogue products. Catalogue side effects are shown only
  as the plain list the dataset gives, inside the labelled catalogue rendering.
- All existing behaviour for clinically known medicines, `/api/check`, the
  profile endpoint, and the CDSCO surfaces stays byte-identical.
- Editorial design standard for new UI: parchment/ink/terracotta/forest,
  Newsreader + IBM Plex, no shadows, no rounded corners, no gradients, no em
  dashes in copy, severity always as a word.
- No push, no deploy.
- Before reporting done: full backend test suite passes, `npm run typecheck`
  and `npm run build` pass. Fix any failures you introduce.
