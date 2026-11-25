# TASK: Redesign the Auth page to the Editorial Standard (matching the new homepage)

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`).

The landing page, Safety Dashboard, and Drug Explorer have been rebuilt to an editorial design standard (see `LANDING_REDESIGN_PROMPT_V2.md` and `DASHBOARD_EXPLORER_REDESIGN_PROMPT.md` in the project root). Now bring the last form page to the same standard:

- Auth page: `frontend/src/pages/Auth.jsx` (route `/auth`)

## The standard (identical to the homepage)
- Palette: parchment `#f8f6f0` background, deeper parchments `#f0ede1` / `#ece7d5` for sheets and bands, ink `#1a1a18`, terracotta `#8b2500`, forest `#2d4a22`. No pure white surfaces.
- Typography: Newsreader for display headings, IBM Plex Serif for body, IBM Plex Mono for labels, field names, and indicators (already loaded; reuse them).
- `box-shadow: none`; depth from sharp editorial borders: 1px rules, full rectangular borders, double rules where the homepage uses them.
- `border-radius: 0` everywhere on this page, including inputs, buttons, and the mode selector.
- No backdrop-filter blur, no gradients, no glow, no dot grids.
- No Lucide icons on this page: use the bespoke geometric SVG suite in `frontend/src/pages/landing-icons.tsx` (extend it only if a genuinely new geometric mark is needed).
- No emojis. No em dashes in any UI copy on this page; use semicolons, commas, or hyphens.
- No shimmer, skeleton, or spinning loaders: the submitting state becomes a discrete IBM Plex Mono text indicator (for example `SIGNING IN`) or an instant state update.
- No hover scale transforms; hover is an instant underline or background tone shift.
- No coloured left accent stripes; notices use full borders or a `border-top: 3px` rule.

## Page design direction
Present the page as a registry sheet of the same publication as the homepage:
- The shared Navbar and Footer (already restyled) frame the page; do not add a second header or footer.
- A centred single bordered sheet on parchment: a mono kicker (for example `MEDCHECK REGISTRY`), a Newsreader heading, and a short serif standfirst explaining, in plain words, what an account saves (medicine lists, notes, history) and that guest access works without one.
- The three modes (Guest Access, Sign In, Create Account) presented as a ruled index or ledger selector: three rectangular entries separated by rules, the active one marked by ink background or a filled square marker; not pill tabs, not rounded segmented controls.
- Forms as registry entries: mono uppercase field labels, square parchment inputs with 1px ink borders and a clear focus state, one full-width ink submit button with parchment text.
- The error message as a bordered notice sheet in terracotta with the error text in serif; never a floating toast.
- The signed-in state as a docket entry: "Signed in as" with the username, and Sign Out as a bordered rectangular button.
- A short mono footnote under the sheet pointing guests to continue without an account, and the medical disclaimer line consistent with the rest of the site.

## Preserve behaviour exactly
Visual layer only. Everything must keep working, identically:
- Guest access flow (name entry and continue), Sign In (username and password via `loginUser`), Create Account (via `registerUser`), all validation and the exact error messages from the API surfaced as today.
- Loading/submitting states (restyled as above), mode switching clearing errors as today, the signed-in panel and Sign Out (`logoutUser`), stored-user detection (`getStoredUser`), and every redirect/navigation the page performs today.
- No changes to `lib/api.ts`, context, hooks, routing, the backend, or any other page. Do not touch the landing page, dashboard, or explorer files.

## Copy
Keep all existing copy and its meaning; mechanically remove em dashes and any emoji only. Do not invent new claims about accounts, privacy, or data storage.

## Done when
- `npm run build` and `npm run typecheck` in `frontend/` both pass.
- Grep audit over `Auth.jsx` (and `landing-icons.tsx` if extended) shows: no `box-shadow` other than `none`, no `border-radius` other than `0`, no `backdrop-filter`, no Lucide imports, no em dash characters in UI strings, no `#ffffff` / `#fff` backgrounds, no spinner or animate-pulse loading classes.
- You summarise what changed and confirm each preserved behaviour above was left functionally untouched.
