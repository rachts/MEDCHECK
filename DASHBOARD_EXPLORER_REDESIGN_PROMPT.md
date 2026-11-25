# TASK: Redesign the Safety Dashboard and Drug Explorer to the Editorial Standard (matching the new homepage)

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`).

The landing page has just been rebuilt to an editorial design standard (see `LANDING_REDESIGN_PROMPT_V2.md` in the project root for the full standard). Now bring the two main app pages to the same standard so the product feels like one publication:

- Safety Dashboard: `frontend/src/pages/AppInterface.jsx` (route `/app`)
- Drug Explorer: `frontend/src/pages/DrugExplorer.jsx` (route `/explorer`)

## The standard (identical to the homepage)
- Palette: parchment `#f8f6f0` background, deeper parchments `#f0ede1` / `#ece7d5` for sheets and bands, ink `#1a1a18`, terracotta `#8b2500`, forest `#2d4a22`. No pure white surfaces. No other accent colours.
- Typography: Newsreader for display headings, IBM Plex Serif for body, IBM Plex Mono for labels, data, tags, and indicators (already loaded for the homepage; reuse them).
- `box-shadow: none` everywhere in scope. Depth from sharp editorial borders: 1px rules, full rectangular borders, double rules where the homepage uses them.
- `border-radius: 0` everywhere in scope, including chips, buttons, modals, inputs, and the network graph container.
- No backdrop-filter blur anywhere in scope; modal backdrops are flat ink at reduced opacity, modal sheets are solid parchment.
- No Lucide icons in scope: extend the bespoke geometric SVG suite created for the homepage (`frontend/src/pages/landing-icons.tsx`) with the additional geometric icons these pages need (search, basket, warning mark, clock, food, printer, download, close, plus, remove, arrow), and use only those.
- No emojis. No em dashes in any UI copy in scope; use semicolons, commas, or hyphens.
- No gradients, no glow, no dot grids, no bento grids, no 3-card rows; use editorial ledgers, ruled rows, docket tables, and columnar brief sheets.
- No shimmer or skeleton loaders: loading states become discrete IBM Plex Mono text indicators (for example `CHECKING THE LABELS`, `READING THE PROFILE`) or instant state updates. This applies to `LoadingState` and `SkeletonCard` usage on these pages.
- No hover scale transforms; hover is an instant underline or background tone shift.
- No coloured left accent stripes; risk markers use full borders or `border-top: 3px` risk borders.

## Severity is data, not decoration
Severity colours stay functional and map onto the mineral palette, consistently with the homepage: critical and high = deep crimson/terracotta, moderate and caution = deep mineral amber, low and safe = forest `#2d4a22`, informational = ink or olive. A severity must always be readable as a word as well as a colour (the pages already print severity labels; keep that). Do not let the editorial palette mute a critical warning into the background: critical items get the 3px top risk border and crimson mono severity tags.

## Scope
In scope for restyling (visual layer only):
- `frontend/src/pages/AppInterface.jsx`, `frontend/src/pages/DrugExplorer.jsx`
- The components these pages render: `MedicineBasket`, `MedicineChip`, `InteractionCard`, `InteractionNetworkGraph`, `MedicineProfilePanel`, `SideEffectRadar`, `FoodConflictTimeline`, `StomachGuardianModal`, `DoctorReportModal`, `SafeState`, `LoadingState`, `ErrorState`, `DemoModeToggle`
- Shared chrome: `Navbar`, `Footer`, `Disclaimer` (they frame every page; carry the standard to them so the frame matches the homepage everywhere)
- `frontend/src/pages/landing-icons.tsx` (extend it; do not create a second icon file)
- One scoped stylesheet for these pages if needed (for example `frontend/src/pages/app-editorial.css`), imported only by the two pages, plus any token additions strictly required. Do NOT rewrite the global Solhaus component classes in `index.css` in ways that change pages outside this scope; Auth, MedicineDetail, and NotFound keep their current inner design for now. If a component in scope is also rendered by MedicineDetail, its new styling carrying over is acceptable; do not fork components.

Out of scope: the landing page (just finished; do not touch it), the backend, the API layer, context, hooks, routing, and every other page's internals.

## Preserve behaviour exactly
This is a design migration, not a feature change. Everything must keep working, identically:
- Basket: add by search with typeahead, quick-add chips, remove, clear, brand-to-generic resolution, duplicate guard, personal notes per medicine.
- Analysis: Analyze flow, results, the stale-results flag after basket edits, the coverage indicator ("Covers X of Y"), honest error and paused states when the backend is unreachable, the safe state when no interactions are found.
- Interaction network graph and side-effect radar: same data and interactions, restyled flat (no glow, no shadows, square container).
- Stomach Guardian: score display, breakdown modal, same numbers.
- Food and Timing Schedule: wake-time picker and re-anchoring, grapefruit and dairy windows, all timeline rules.
- Doctor's Report: the modal, Copy Text, and Print Brief. The print path uses a shared ReportContent portal and a print stylesheet; restyle the on-screen modal only and keep the printed brief's structure and print CSS semantics intact. Do not regress print.
- Scenarios presets in the Navbar, Demo Mode toggle, account link: all keep working.
- Drug Explorer: search, filters, profile tabs (Overview, Side Effects, Food and Alcohol), links into the single-medicine pages.
- Accessibility: focus-visible states, real buttons, aria labels, keyboard dismissal of modals.

## Copy
Keep all existing copy and its meaning, with two mechanical changes only: remove em dashes (replace with semicolons or rephrase minimally), and remove any emoji. Do not rewrite clinical content, do not invent new claims, and keep the plain severity words.

## Done when
- `npm run build` and `npm run typecheck` in `frontend/` both pass.
- Grep audit over the in-scope files shows: no `box-shadow` other than `none`, no `border-radius` other than `0`, no `backdrop-filter`, no Lucide imports, no em dash characters in UI strings, no `#ffffff` / `#fff` backgrounds.
- You summarise which files changed and confirm each preserved behaviour above was left functionally untouched.
