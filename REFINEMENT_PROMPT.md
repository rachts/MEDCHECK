# MEDCHECK Refinement: Medicine Page, 404, Error Boundary — Editorial Redesign + Plain Language

## Context

MEDCHECK's Landing, Safety Dashboard, Drug Explorer, Assistant, and Auth pages
were redesigned to Rachit's 30-point editorial standard (parchment #f8f6f0,
ink #1a1a18, terracotta #8b2500, forest #2d4a22; Newsreader + IBM Plex Serif +
IBM Plex Mono; bespoke SVG icons; no shadows, no rounded corners, no blur, no
gradients; severity always printed as a word).

A full audit on 2026-11-25 proved that exactly three surfaces still use the
old Solhaus design (Fraunces + DM Sans, cream #FAF8F5, rust #C06230, Lucide
icons, soft shadows): `frontend/src/pages/MedicineDetail.jsx`,
`frontend/src/pages/NotFound.jsx`, and
`frontend/src/components/ErrorBoundary.jsx`. A grep across frontend/src
confirms nothing else uses the Solhaus fonts, component classes
(.card, .btn-primary, .btn-secondary, .tag, .alert-*), or cream/rust
variables, except `frontend/src/index.css` where they are defined.

This task restyles those three surfaces to the editorial standard, simplifies
the medicine page's own UI wording for ordinary Indian users, and then removes
the now-dead Solhaus layer behind grep proof.

## Design reference (follow exactly)

- Reuse the shared editorial system the dashboard, Assistant, and Auth
  already use: the `.ed-app` frame and classes in
  `frontend/src/pages/app-editorial.css`, and the bespoke icon set in
  `frontend/src/pages/landing-icons.tsx`. Extend landing-icons.tsx with any
  icons you need (sharp-cornered SVG paths in the same style). Do not invent
  a parallel styling system.
- Palette: parchment #f8f6f0 / #f0ede1 / #ece7d5, ink #1a1a18, terracotta
  #8b2500, forest #2d4a22. Severity uses the mineral palette already used on
  the redesigned pages and is ALWAYS printed as a word, never colour alone.
- Hard prohibitions (the audit greps for these): no box-shadow except none,
  no border-radius except 0, no backdrop blur, no gradients, no Lucide
  icons, no em dash characters in copy, no coloured left accent stripes
  (risk markers use a full border or a 3px border-top), no skeleton or
  shimmer loaders, no spinning-ring loaders, no hover scale.

## Task 1 — MedicineDetail.jsx: full editorial restyle + plain language

Visual layer and UI wording only. Freeze everything else: the
`getMedicineProfile(name)` call, all state and effects, the
`handleAddToBasket` behaviour (addMedicine with the profile name and drug
type, "added" state, navigate to /app after 400ms), the back button
(navigate(-1)), the Explorer link, the IndiaBanNotice placement (inside the
header block, under the title area, rendered when
`profile.india_ban?.matched`), the Disclaimer and Footer, and every profile
field read (name, drug_type, category, is_fdc, fdc_warning,
fdc_ingredients, generic_name, brand_names, gi_profile.*, food_interactions,
lifestyle_warnings, side_effects). Do not change any data, condition, or
fallback value, only how labels are worded and styled.

Restyle:
- Page shell in the .ed-app editorial frame (parchment canvas, ink text,
  IBM Plex Serif body), Navbar and Footer unchanged.
- Header becomes a ruled registry entry, not a card: mono kicker line with
  the drug type and category as plain words (e.g. "PRESCRIPTION ONLY ·
  VITAMIN K ANTAGONIST ANTICOAGULANT"), Newsreader medicine name as the
  heading, generic name and brand aliases as ruled rows, and a square
  ink-filled "ADD TO BASKET & CHECK" button (forest when in the added
  state, wording "ADDED TO BASKET"). No pale tag chips.
- The FDC notice becomes a full-border caution notice in the editorial
  style (border-top 3px deep amber is acceptable), keeping its text logic.
- The GI panel and the food panel become square bordered panels with ruled
  headings, matching the dashboard's profile panel treatment. The stomach
  stress score keeps its number and "/100", shown in Newsreader; the score
  bar is a square ink/mineral bar with no rounding; when the score is null
  show the words "Not available" instead of the current em dash character.
  Risk tier is printed as a word (e.g. "MODERATE TIER"). The three risk
  cells (nausea / ulcer / bleeding) stay, as ruled cells with word values.
- Food rules keep their severity printed as a word (CRITICAL / WARNING /
  INFO) with the mineral palette, as ruled entries. Replace the Lucide
  food icons with bespoke SVGs from landing-icons.tsx (wine glass, clock,
  utensils, alert) or with a mono text marker; no Tailwind palette colours
  (amber-600, blue-600, emerald-600) anywhere.
- Side effects become a ruled ledger grid like the Explorer's: category,
  effect name, severity as a word, frequency. No cards with shadows.
- Loading state: replace the spinning ring with the app's mono indicator
  pattern, the single line "READING THE LABEL" (IBM Plex Mono, letterspaced,
  ink). No animate-pulse skeleton.
- Error state: a full-border terracotta notice in the style of Auth's
  `.ed-notice-crit`, with the Retry button as a square bordered button.
  Keep the window.location.reload() behaviour.

Plain-language replacements (exact; these are the page's own UI strings,
not backend data — do not touch text that comes from the profile object,
such as food rule titles/descriptions, recommendations, lifestyle
warnings, side effect names, or the fdc_warning):
- "Retrieving clinical monograph..." → the loading indicator above.
- "Monograph Lookup Error" → "Could not load this medicine"
- "Active generic compound:" → "Main ingredient (generic name):"
- "Brand Aliases:" → "Also sold as:"
- "Fixed-Dose Combination Formulation" → "Combination medicine"
- Fallback FDC text "Contains multiple active pharmacological ingredients."
  → "This medicine has more than one active ingredient in one tablet."
- "Stomach Health & GI Risk" → "Stomach safety"
- "Mucosal Stress Score" → "Stomach stress score"
- "Nausea Risk" → "Feeling sick (nausea)"; "Ulcer Hazard" → "Ulcer risk";
  "Bleeding Risk" → "Bleeding risk"
- "Clinical GI Guidance:" → "How to protect your stomach:"
- "Dietary & Timing Rules" → "Food and timing rules"
- "Documented Adverse Reactions" → "Side effects"
- "FDA Label & Monograph Surveillance" → "From the official FDA label"
- Side-effects empty text → "No common side effects are listed for this
  medicine in its official label. The medicine's package leaflet has the
  full list."
- Food empty text → "No special food rules for this medicine. You can take
  it with water, unless your doctor has told you otherwise."
- "Ingredients analyzed:" → "Ingredients checked:"
- "Lifestyle Precautions:" → "Everyday cautions:"
- "Browse All Medicines →" → "Browse all medicines" (keep the arrow
  character out; use a bespoke arrow icon or none)
- Keep "Back", "Add to Basket & Check" (button wording above), "Retry",
  "Prescription Only", "Over The Counter", and the "N Rules" count format.

## Task 2 — NotFound.jsx: editorial restyle

Copy is already plain; keep every word and all three links (/, /app,
/explorer) and the requested-path display. Restyle into the editorial
system: parchment shell, mono terracotta "404" kicker, Newsreader heading,
the requested path in a bordered mono chip, and three square buttons
(primary ink-filled "BACK TO HOME" wide enough that its label never wraps,
two bordered secondaries). Replace the Lucide icons (Compass, Home, Search,
Activity) with bespoke SVGs from landing-icons.tsx or drop the icons and
keep text-only buttons. Remove font-fraunces, font-dm-sans, the cream/rust
variables, and the .btn-primary/.btn-secondary classes.

## Task 3 — ErrorBoundary.jsx: editorial restyle + plain language

Keep the component's logic byte-identical (state, getDerivedStateFromError,
componentDidCatch including the /api/client-error POST and its clamping,
handleReset). Restyle only the fallback UI, self-contained in this file
(it must not depend on page CSS): a square panel with a full terracotta
border on the parchment background, no shadow, NO coloured left accent
stripe, Newsreader heading, IBM Plex text. Replace the Lucide icons with
one inline sharp-cornered warning SVG defined in this file. Copy:
- "Clinical Interface Exception" → "Something went wrong"
- "The clinical visualization encountered an unexpected rendering error.
  Your data is preserved." → "This page hit an unexpected error. Your
  medicines and results are saved."
- "Reload Interface" → "Reload page"; "Return Home" → "Back to home"

## Task 4 — Gated Solhaus cleanup (only after Tasks 1–3 pass checks)

- `frontend/index.html`: change the theme-color meta from #FAF8F5 to
  #f8f6f0. Remove the Fraunces + DM Sans Google Fonts link ONLY if a grep
  over frontend/src shows zero remaining uses of `font-fraunces` and
  `font-dm-sans`; otherwise leave it and say so in your report.
- `frontend/src/index.css`: for each Solhaus-only component definition
  (.card, .card-surface, .card-elevated, .btn-primary, .btn-secondary,
  .btn-charcoal, .tag and its variants, .alert-success, .alert-warning,
  .alert-danger, .text-body, .metric, and the shadow-warm / shadow-soft
  utilities), remove the definition ONLY if a grep over all of frontend/src
  shows zero remaining usage of that exact class. When in doubt, leave it
  and list it in your report. NEVER touch: the @media print block, the
  Doctor's Report print path, any :root variable that is still referenced
  anywhere in src, base element styles, or the editorial CSS files
  (landing.css, app-editorial.css).

## Hard rules

- Frontend only. No backend changes, no API changes, no new dependencies.
- No behaviour, routing, or data changes anywhere; Tasks 1–3 are styling
  and the specified UI wording only.
- Do not push or deploy anything.

## Checks before reporting done

- `npm run typecheck` and `npm run build` pass in frontend/.
- Full backend suite still passes (`venv/bin/python -m pytest tests -q`
  in backend/) — it should be untouched, prove it.
- Grep audit over the three restyled files: zero matches for
  `fraunces`, `dm-sans`, `lucide`, `shadow-soft`, `shadow-warm`,
  `rounded-full`, `animate-spin`, `animate-pulse`, `amber-600`,
  `blue-600`, `emerald-`, and the em dash character.
- Report: files changed with a short diff summary, the check results, and
  the list of any index.css definitions you removed (with the zero-usage
  grep result for each) or deliberately left.
