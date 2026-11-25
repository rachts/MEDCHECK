# MEDCHECK — Design Migration Prompt for Antigravity (DRAFT v1)

Copy everything inside the prompt block below into Antigravity, with the project
`/Users/macbookair/CODING/MEDCHECK-main` open and the user's `design.md`
(Solhaus style reference) in the project root as `design.md`.

---

```
You are migrating the visual design of MEDCHECK — and only the visual design.

PROJECT
- Path: /Users/macbookair/CODING/MEDCHECK-main
- Frontend: React 18.3 + Vite 5 + Tailwind CSS 3.4.3 (NOT Tailwind v4) + React Router 6 + lucide-react
- Backend: FastAPI — do not touch anything under backend/, supabase/, or any API contract, route, state, or data logic.
- Design source of truth: design.md in the project root (Solhaus — warm couture atelier, light theme).

GOAL
Replace the current "Clinical White" system (slate #F1F5F9 canvas, near-black #0F172A accent,
Cormorant Garamond + Inter + JetBrains Mono, 4–12px rounded cards, cool-grey shadows)
with the Solhaus visual language from design.md, adapted for a clinical safety product.
The result must not look like a generic AI-generated SaaS template.

TOKENS — implement exactly (translate design.md's Tailwind v4 @theme snippet into
Tailwind v3 form: extend tailwind.config.js + CSS custom properties in src/index.css)
- Canvas: cream #FAF8F5 | Alt band / card surface: warm cream #F4EEE6 | Muted inset: linen #F0EBE6
- Border / hairline: sand #E0D9D1 | Input border: putty #E7E0DA
- Body text: taupe #67574C | Headings / primary text: charcoal #2B2B2B (never pure black, never cool grey/blue)
- Single accent: rust #C06230 | Accent hover: deep rust #A04E22
- Dark bands: umber #864923 (hero), charcoal #2B2B2B (footer / closing band)
- Decorative only (placeholder gradients, never buttons/text/chrome): blush #DFB69F, terracotta #D17847, cocoa #7A4C2A
- Fonts: Fraunces (display, 300–400, italic 300 for emphasis words) for ALL headlines, logo, and large numbers;
  DM Sans (400–500) for ALL UI/body/labels. Load via Google Fonts in frontend/index.html,
  replacing Cormorant Garamond, Inter, and JetBrains Mono entirely.
- Type: headlines Fraunces 400, line-height 1.05–1.2, NO negative tracking.
  Small UI text uppercase: labels/buttons 0.2em tracking, eyebrows 0.3em, nav 0.025em.
  Body 16px DM Sans (14px small), replacing the current cramped 13px body.
- Radius: 0px everywhere — buttons, cards, inputs, images, modals, chips, badges.
  No pills, no 6px/12px rounding. (Exception in ADAPTATIONS below.)
- Shadows: warm-tinted only, sparingly — soft 0 10px 40px -15px rgba(122,76,42,0.15),
  warm 0 20px 60px -20px rgba(192,98,48,0.25). Elevation comes from colour bands + 1px hairlines, not shadow stacks.
- Layout: max-width 1400px, 24px gutters, airy section rhythm (96px mobile / 128px desktop on the Landing page).

HARD ADAPTATIONS — where design.md conflicts with a clinical safety product, these win:
1. SEVERITY COLOURS ARE FUNCTIONAL, NOT DECORATIVE. Keep the existing severity system exactly:
   high #DC2626, moderate #D97706, low #059669, info #0284C7, and their alert backgrounds.
   Rust is the brand accent for CTAs/eyebrows/active states only — never use rust to mean danger,
   and never recolour a severity badge, interaction card severity edge, or alert to rust/taupe.
   Error/destructive states keep crimson #C32222 / existing danger styling.
2. NO interior-design content patterns: no photography marquees, no arch (rounded-t-full) frames,
   no hand-drawn room illustrations, no ghost words, no service-ledger hover-wipe for clinical results.
   Translate the *language* (warm surfaces, hairlines, square geometry, serif display, rust thread),
   not Solhaus's literal components.
3. DENSITY: AppInterface, DrugExplorer, and result components are working clinical tools.
   Apply the new tokens, fonts, square corners, and hairlines there, but keep information density
   and scannability — do not apply Landing-page airy 128px section spacing inside the app tool.
4. PRINT: the Doctor's Report print stylesheet in src/index.css must still work — white background,
   no nav/buttons, cards with plain borders, page-break-inside avoid.
5. ACCESSIBILITY: keep prefers-reduced-motion handling, visible focus states (use a 2px rust focus ring),
   and existing touch-target sizes. Taupe #67574C on cream passes for body text — do not use lighter tones for body copy.

SCOPE — every file that carries design, and nothing else:
- frontend/index.html — font links (Fraunces + DM Sans), theme-color → #FAF8F5
- frontend/tailwind.config.js — replace colour/font/radius/shadow tokens with the ones above; keep content paths
- frontend/src/index.css — rewrite the design-system layer (variables, type classes, .card, .badge [severity colours unchanged], .tag, .alert-*, .chip, .btn-primary/.btn-secondary, .bottom-nav, .gi-score-bar) to the new tokens; delete JetBrains Mono / Cormorant references
- Pages: frontend/src/pages/Landing.jsx, AppInterface.jsx, DrugExplorer.jsx, Auth.jsx, NotFound.jsx
- Components: frontend/src/components/*.jsx — all 18 (Navbar, Footer, MedicineBasket, MedicineChip, MedicineProfilePanel,
  InteractionCard, InteractionNetworkGraph, SideEffectRadar, FoodConflictTimeline, StomachGuardianModal,
  DoctorReportModal, DemoModeToggle, SafeState, ErrorState, ErrorBoundary, LoadingState, SkeletonCard, Disclaimer)
- Pattern translations: primary CTA = rust slab (0 radius, DM Sans 14px uppercase 0.2em tracking, padding per design.md, hover #A04E22);
  section eyebrows = DM Sans 12px uppercase 0.3em rust with optional 40px rust hairline;
  Navbar = 80px, transparent over hero → cream/95 + blur + soft shadow after scroll, Fraunces wordmark with rust full stop;
  Footer = full-bleed charcoal band; Landing sections = alternating cream → warm cream bands separated by hairlines, not floating card grids.

DO NOT
- Change any JSX behaviour, hooks, context, routing, API calls, copy/text content, or component props.
- Rename components or files. Add new dependencies. Upgrade Tailwind or Vite.
- Remove severity, category-pill (Rx/OTC/supplement), or alert colour distinctions.
- Leave any old token behind: no #0F172A, #F1F5F9, slate colours, Cormorant, Inter, or JetBrains Mono anywhere in frontend/.

WORK IN THIS ORDER, AND REPORT AFTER EACH STEP
1. Tokens first: tailwind.config.js + index.css variables/fonts — then stop and summarise what changed.
2. Shared components: Navbar, Footer, buttons, cards, badges, chips, alerts, modals.
3. Pages, in order: Landing, Auth, AppInterface, DrugExplorer, NotFound.
4. Self-check: grep frontend/src and frontend/index.html for the banned old tokens above and list any remaining hits.

VERIFY BEFORE YOU SAY YOU ARE DONE
- cd frontend && npm run build  → must pass
- cd frontend && npm run typecheck  → must pass
- List every file changed, grouped by step 1/2/3.
```

---

## Why this draft adapts design.md instead of applying it literally (for Rachit)

- design.md is the Solhaus interior-atelier system (screenshots in your home folder match: solhaus.design).
  Its own "Similar Brands" note points to Aesop — warm apothecary editorial — which is why it *can* work
  for a consumer medicine product, but only as a visual language, not a literal transplant.
- Biggest conflict: Solhaus allows one accent only. MEDCHECK's red/amber/green/blue severity coding is
  safety information, not decoration — the prompt makes severity a protected exception.
- Tailwind mismatch caught: MEDCHECK runs Tailwind 3.4.3; design.md's Quick Start uses Tailwind v4
  `@theme` syntax, which would silently fail here. The prompt tells Antigravity to translate it to v3 config.
- Irrelevant Solhaus patterns (photo marquees, arch frames, room sketches, ghost words) are explicitly banned.
- Verification Muse will run afterwards: grep for old tokens, diff review per file, `npm run build`,
  `npm run typecheck`, visual check of all 5 pages, severity/print/reduced-motion spot checks.
