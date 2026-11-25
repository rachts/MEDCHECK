# TASK: Rebuild the MEDCHECK Landing Page to a New Design (Landing Page ONLY)

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`).

## Source of truth for the design
The file `landing-design.html` in the project root is the approved design reference: a complete standalone HTML mock with all CSS, copy, and section structure. Rebuild the landing page to match it faithfully — layout, spacing, typography, colours, copy, and interactions — implemented properly in React/Tailwind inside the existing app.

## Scope — read carefully
- ONLY the landing page (route `/`, `frontend/src/pages/Landing.jsx`) changes, plus:
  - `frontend/index.html` — add the Google Fonts links for Inter Tight, Inter, and JetBrains Mono (the mock's fonts).
  - ONE new scoped stylesheet for the landing (e.g. `frontend/src/pages/landing.css`), imported only by Landing.jsx.
  - `frontend/tailwind.config.js` — you may ADD the three font families; do not change existing tokens.
- Do NOT modify any other page (AppInterface, DrugExplorer, Auth, MedicineDetail, NotFound), any shared component (Navbar, Footer, Disclaimer, modals, etc.), the context, hooks, API layer, or the backend. The rest of the app keeps its current Solhaus design untouched.
- The landing page does NOT use the shared `Navbar`/`Footer` components anymore — the design has its own header and footer, implemented inside Landing.jsx (or a Landing-only subcomponent in the same file/folder). Keep the existing medical disclaimer text in the new footer (the mock's footer fine print already contains it — use it verbatim).
- No new npm dependencies. Icons: use `lucide-react` (already installed) where the mock uses glyph symbols (star, check, x, arrow) if a glyph looks off; plain typographic arrows (→) in buttons are fine, as in the mock.

## Design tokens (landing-scoped — do not leak into the rest of the app)
- Paper background `#F5F2EB`, card `#FFFFFF`, ink `#181510`, ink-2 `#4A463E`, muted `#8A857A`
- Lines: `#E6E1D5` / `#D6D0C2`
- Accent green `#189A54`, critical red `#E5484D`, caution amber `#EFA400`
- Fonts: Inter Tight (display), Inter (body), JetBrains Mono (small uppercase labels/chips)
- Rounded corners ARE part of this design (10–16px radii, pill chips) — this overrides the app's square-corner style on the landing page only.
- Shadow: `0 1px 2px rgba(24,21,16,.05), 0 14px 34px -14px rgba(24,21,16,.16)`
- Content width 1180px, section padding as in the mock, responsive breakpoint at 920px (collage stacks, grids go single-column, header nav links hide).
- All animations from the mock (floating collage cards, marquees, blinking "now" dots, scroll reveal) must respect `prefers-reduced-motion`: disable float/marquee/reveal motion for users who request it.

## Sections to build (exactly as in the mock, same copy)
1. Sticky translucent header: logo mark + "medcheck", anchor nav (The agent / Modes / Pricing / FAQ), dark "Try medcheck →" button that focuses the hero scan input.
2. Hero: two-column grid. Left: badge ("Built on OpenFDA label data · live"), H1 "Medication safety, *finally solved.*" (second line in green), lede, the scan box (see Functional wiring below), hint line, quick links. Right: the floating collage of 5 cards (OpenFDA sync, Interaction alert, Drug library alias, Stomach Guardian gauge, Recommendation with Approve/Hold vote buttons) with the mock's positions/rotations/float animation; on mobile they stack statically.
3. Steps strip: "How medcheck works — 01 Meds in · 02 Graph built · 03 You approve · 04 Schedule out".
4. Manifesto marquee (infinite scroll, pauses on hover).
5. Statement block ("Polypharmacy now means five drugs…").
6. Agent section: 6 tabs (Labels, Interactions, Severity, Stomach, Schedule, Report) on the left with expanding descriptions; chat-style panel on the right whose content switches per tab, with the mock's cards, rows, and severity pills. Tab state in React; header of the panel shows the active tab name.
7. Modes section: Guardian vs Co-pilot cards with pipeline chips and the three-row lists.
8. Pricing section: "$0 forever · every feature" + "0% of anything · no ads · no data selling", with the mock's explanatory line and CTA.
9. Testimonials: two counter-scrolling marquee rows using the mock's quotes verbatim.
10. FAQ: 6 items using native `<details>`-style accordions (React state or details/summary — either is fine) with the mock's Q&A copy verbatim.
11. Final CTA: dark ink panel, green button that focuses the hero scan input.
12. Footer: logo + v2.0, anchor nav, and the medical disclaimer fine print verbatim from the mock.

Fix this typo from the mock while copying: "Empty-st morning dosing" → "Empty-stomach morning dosing".

## Functional wiring — the hero scan must be REAL, not a demo script
The mock contains a throwaway JS mini-scan with a hardcoded 5-drug table and an invented Guardian-score formula. Do NOT port that logic. This app recently removed fabricated scores on purpose; the landing must not reintroduce them. Instead:
- On submit, split the input on commas/semicolons/newlines. For each name, resolve it with the app's real search (`searchMedicines` from `src/lib/api.ts`), which handles brand aliases (Crocin → Paracetamol, etc.) against the real backend.
- Resolved medicines are added to the basket via `addMedicine` from `MedicineContext` (use the canonical generic name returned by search) and shown as chips with their generic names. Unresolved names are shown as muted "? name" chips and are NOT added.
- If 2+ medicines resolved, run the app's real analysis call (the same one the Safety Dashboard uses) and colour the chips + summary from the REAL response: per-medicine worst severity (critical red / caution amber / none green), counts of critical and caution pairs, and the real Stomach Guardian score. If the analysis call fails (e.g. backend unreachable), show neutral chips and a summary that says the full scan is one click away — never invent numbers.
- "Open the full scan →" navigates to `/app` with the basket already loaded (same pattern the existing preset buttons use: load basket state, then `navigate('/app')`).
- The collage cards, agent-tab panels, and testimonials are illustrative showcase content — keep the mock's content for those; the honesty rule applies to the interactive scan, which must only ever display real API output.

## Preserve / do not break
- All existing routes and behaviour of the rest of the app; the SCENARIOS presets and demo flows on other pages stay as they are.
- The Doctor's Report print stylesheet and all print behaviour (untouched — you are not editing those files).
- Accessibility: semantic landmarks, focus-visible states on interactive elements, buttons are real `<button>`s, the scan input has an accessible label, colour contrast of muted text on paper must stay readable.
- `npm run build` and `npm run typecheck` in `frontend/` must both pass when you are done.

## Deliverable
Rewrite `frontend/src/pages/Landing.jsx` (plus the small additions listed under Scope) so that `/` matches the reference design, with the scan wired to the real API as specified. Work through it section by section and finish with the build + typecheck passing.
