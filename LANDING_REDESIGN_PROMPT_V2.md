# TASK: Rebuild the MEDCHECK Landing Page to the Editorial Design Standard (Landing Page ONLY)

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`).

This task SUPERSEDES the earlier landing redesign task (`LANDING_REDESIGN_PROMPT.md` / `landing-design.html`). If you already changed `Landing.jsx`, `frontend/index.html`, `tailwind.config.js`, or added a landing stylesheet for that task, treat those changes as a draft to be replaced by this standard, not as a base to preserve.

## The standard
The landing page must contain NONE of the following prohibited patterns, and must follow the required standard on the right. This is a medical product, so where the standard names legal artefacts, use the medical equivalent named in brackets.

1. No neon gradients → subtle parchment tones: `#f8f6f0`, `#f0ede1`, `#ece7d5`.
2. No Lucide / Feather icons on the landing page → a bespoke geometric SVG icon suite in a new file `frontend/src/pages/landing-icons.tsx`, drawn as simple geometric inline-SVG React components (shield, medical cross, document, pill, clock, book, balance). The rest of the app keeps Lucide; only the landing stops using it.
3. No pure white (#ffffff / #fff) backgrounds anywhere on the page → archival warm paper `#f8f6f0`; card/sheet surfaces use the deeper parchments or `var(--bg-card)`-equivalent parchment tones, never white.
4. No rainbow accent palettes → curated palette only: terracotta `#8b2500`, forest `#2d4a22`, ink `#1a1a18`. Severity keeps its functional meaning inside this palette: critical = deep crimson/terracotta, caution = deep mineral amber, safe = forest.
5. No drop shadows → `box-shadow: none` everywhere on the landing; depth comes from sharp editorial borders (1px ink/parchment lines, full rectangular borders).
6. No 3-feature-cards-in-a-row → balanced 2-column or full-width editorial ledgers (ruled rows, numbered entries).
7. No emojis anywhere in UI or copy.
8. No liquid glass / backdrop-filter blur → solid, opaque paper surfaces; the header is solid parchment with a bottom border.
9. No em dashes in any landing copy → use semicolons, commas, or hyphens. (Check every string; the previous copy is full of em dashes.)
10. No Inter / Geist / Space Grotesk → Newsreader (display serif), IBM Plex Serif (body serif), IBM Plex Mono (labels, data, indicators). Load these three from Google Fonts in `frontend/index.html`; if the earlier draft added Inter Tight / Inter / JetBrains Mono links for the landing, remove them.
11. No coloured left accent stripes → full rectangular borders, or top risk borders (`border-top: 3px solid …`) where a risk marker is needed.
12. No testimonials, fake or otherwise → the testimonials section is DELETED. Social proof is replaced by verifiable substance: the worked clinical example below, with real severities and OpenFDA label citations.
13. No bento grids → clean columnar layouts: docket-style tables and brief-sheet panels.
14. No faux terminal / macOS window chrome → the agent/capabilities presentation uses authentic docket tables and citation cards: plain bordered sheets with mono labels, no window dots, no chat-bubble theatre.
15. No "It's not X, it's Y" marketing clichés → direct, precise explanations of what the checker does.
16. No checkmark bullet icons → clean numbered lists or typographic bullets (·, §, numerals).
17. No pricing tiers or pricing cards → one plain statement ledger: the engine is free; no card, no tiers, no upsell.
18. No placeholder or mock text → all copy is real: real feature descriptions, the real Warfarin + Aspirin + Ibuprofen worked example (critical bleeding synergy; Stomach Guardian high), real FAQ answers, the app's real medical disclaimer in full.
19. No rounded corners → `border-radius: 0` everywhere on the landing, chips and buttons included; chips become rectangular mono tags with full borders.
20. No purple/black SaaS palette → warm parchment `#f8f6f0` and deep carbon ink `#1a1a18`.
21. No shimmer / skeleton loaders → the scan's loading state is a discrete mono text indicator (for example `CHECKING THE LABELS` in IBM Plex Mono) or an instant state update.
22. No radial glow orbs or mesh gradients → flat, crisp paper surfaces; no gradients on the landing at all except none.
23. No background dot grids → clean, unblemished paper.
24. No sparkle / magic AI stars → emblems are the bespoke SVG suite: shield, cross, document, balance.
25. No animated bouncing arrows, no marquees, no floating collage → static, clear navigational links and tabs; the only motion allowed is a subtle fade on tab change, disabled under `prefers-reduced-motion`.
26. No placeholder legal/medical text → the footer carries the app's real, comprehensive medical disclaimer (the same substance as the existing Disclaimer component and footer fine print: informational only, not a substitute for clinical judgement, consult the prescribing physician).
27. No hover scale transforms → hover states are instant underline or background tone shifts only.
28. No basic pastel colours → deep mineral tones (crimson, amber, olive, ink).
29. No external analytics or telemetry scripts → add none; the page makes no third-party calls besides Google Fonts.
30. No unescaped HTML rendering → all copy rendered as React JSX text; no `dangerouslySetInnerHTML` anywhere in the landing code.

## Page structure (editorial, in this order)
1. Header: solid parchment, bottom hairline. Left: bespoke shield-cross emblem + "MEDCHECK" wordmark in Newsreader. Right: static text links (The Checker, The Example, Questions) anchoring to sections, and a plain bordered link "Open the Safety Dashboard" to `/app`.
2. Hero: two-column editorial layout. Left column: mono kicker "Evidence-cited medication safety", Newsreader headline (direct, no clichés, no em dashes; suggested: "Medication safety, checked against the label."), a precise two-sentence lede naming the four checks (interactions, side-effect compounding, food and timing, Stomach Guardian), then the scan box (see Functional wiring), then a mono hint line. Right column: a brief sheet titled "What the checker reads" — a ruled ledger listing, with numerals, the sources and steps (OpenFDA label monographs; curated interaction rules; brand alias resolution for Indian and international brands; severity ranking; 24-hour schedule). No collage, no floating cards.
3. The worked example, as a docket: a full-width bordered table "Case file: Warfarin, Aspirin, Ibuprofen" with rows for each pair, its real severity (Critical), mechanism in plain words, and a citation line naming the OpenFDA label basis; a final row for the Stomach Guardian outcome (High) with a `border-top: 3px` risk border on the table. A plain link under it: "Run this case in the dashboard" which loads the Sarah's Demo preset (`sarah-demo`) and navigates to `/app`, using the existing `loadPreset` pattern.
4. The checker, as a ledger: six numbered capabilities (Labels, Interactions, Severity, Stomach, Schedule, Report) in a 2-column editorial ledger or a tabbed docket with static tabs; each entry has a precise one or two sentence description with no clichés and no em dashes. If tabs are used, the panel is a plain bordered sheet, not a chat window.
5. Modes: Guardian and Co-pilot as two side-by-side bordered sheets (2 columns is allowed; not 3), each with a numbered list of how it works, involvement, and control. No pipeline chips with arrows; use numbered steps.
6. Free statement: a single centred ledger block: "Free. No account, no card, no advertising, no data selling." plus one sentence on the public-data basis (OpenFDA) and anonymous guest sessions, and a bordered link to `/app`.
7. Questions (FAQ): the six real questions from the current app copy (what it is, how it differs from a chatbot, whether it replaces a doctor, Indian brand names, data handling, cost), set as a ruled list with plus/minus text toggles or native details elements; answers in direct prose without em dashes.
8. Final block: an ink (`#1a1a18`) rectangular panel with parchment text: a direct headline, one sentence, and a parchment-bordered link "Check my medicines" to `/app`. Sharp corners, no shadow.
9. Footer: hairline top border; wordmark, static anchor links plus Dashboard and Drug Explorer links; the full medical disclaimer in small serif text.

## Functional wiring: the hero scan is REAL (unchanged from the superseded task)
- On submit, split input on commas, semicolons, or newlines. Resolve each name with the app's real search (`searchMedicines` in `src/lib/api.ts`), which handles brand aliases.
- Resolved medicines are added to the basket via `addMedicine` from `MedicineContext` under their canonical generic names and shown as rectangular mono tags. Unresolved names show as muted "? name" tags and are not added.
- With 2 or more resolved, run the app's real analysis call (the same one the Safety Dashboard uses) and present the result as a small docket table under the scan box: each pair with its real severity word coloured by the mineral severity palette, the count of critical and caution pairs, and the real Stomach Guardian score. If the analysis fails, show the resolved tags and a line saying the full check is ready in the dashboard; never invent numbers, scores, or severities. No hardcoded drug tables, no local score formulas.
- A bordered button "Open the full scan" navigates to `/app` with the basket loaded.

## Scope and preservation
- Only the landing page changes: `frontend/src/pages/Landing.jsx` (rewrite), the new `frontend/src/pages/landing-icons.tsx`, one landing-scoped stylesheet if needed (`frontend/src/pages/landing.css`, imported only by Landing.jsx), the font links in `frontend/index.html`, and font-family additions in `tailwind.config.js` (add Newsreader, IBM Plex Serif, IBM Plex Mono; change nothing else).
- The landing no longer uses the shared `Navbar`, `Footer`, or `Disclaimer` components (it has its own header, footer, and full disclaimer text). Do not modify those shared components or any other page; the rest of the app keeps its current design untouched.
- No new npm dependencies. No backend changes. Print styles untouched.
- Accessibility: semantic landmarks, real buttons, accessible label on the scan input, focus-visible outlines, readable contrast for muted text on parchment.
- When finished, `npm run build` and `npm run typecheck` in `frontend/` must both pass, and a repo grep for the landing files must show: no `box-shadow` other than `none`, no `border-radius` other than `0`, no `backdrop-filter`, no em dash characters in landing copy, no Lucide imports in Landing.jsx.
