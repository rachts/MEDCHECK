# TASK: Fix two diagnosed bugs: Print Brief blank first page, and the always-empty Side Effects tab

You are working in the MEDCHECK project (React 18 + Vite + Tailwind CSS v3 frontend in `frontend/`, FastAPI backend in `backend/`). Both bugs below have been diagnosed from the code by Muse; apply the specified fixes exactly, do not redesign anything, and do not change any other behaviour.

## Bug 1: Print Brief wastes page 1 (the brief prints on page 2)
Root cause, verified in the code:
- `DoctorReportModal` renders the printable report as `<div className="print-report">` portaled to `document.body`, outside `#root`. On screen it is hidden by `.print-report { display: none; }`; in print it becomes `display: block`.
- The `@media print` block in `frontend/src/index.css` hides `main, header, nav, .bottom-nav, .btn-sticky, button, .modal-backdrop`, but NOT `footer`.
- `Footer.jsx` renders a real `<footer>` element with `mt-auto` inside the page's full-height flex column shell. In print the shell still occupies a full page height, `mt-auto` pushes the footer to the bottom of page 1, and the portaled `.print-report` flows after the shell, so the brief starts on page 2. Page 1 prints only the browser header line and the site footer.

Fix, in the `@media print` block of `frontend/src/index.css` only:
- Add `footer` to the existing hide list.
- Add a rule hiding the entire app root in print: `#root { display: none !important; }`. This is safe because the printable report is portaled to `document.body`, outside `#root`; the on-screen modal instance lives inside `#root` and must stay hidden in print, as today.
- Keep `.print-report { display: block !important; }` and every other existing print rule unchanged.
Do not change DoctorReportModal.jsx, the portal, or ReportContent for this bug.

## Bug 2: The dashboard profile panel's Side Effects tab always shows (0) and lists nothing
Root cause, verified in the code:
- `frontend/src/components/MedicineProfilePanel.jsx` reads `profile.common_side_effects` and `profile.rare_severe_side_effects`.
- Those fields exist nowhere else in the codebase: the backend `MedicineProfileResponse` (backend/models.py) carries a single list, `side_effects`, of `SideEffectDetail` objects with fields `effect`, `frequency` (one of `very_common`, `common`, `uncommon`, `rare`), `frequency_percentage`, `severity` (`mild`, `moderate`, `severe`), `category`, `is_amplified`. `MedicineContext` stores the API profile unchanged. So both panel lists are always empty, for every medicine, even though the API returns real side-effect data (curated profiles carry full lists; Warfarin returns 4).

Fix, in `MedicineProfilePanel.jsx` only:
- Derive the two lists from `profile.side_effects` (defaulting to an empty array):
  - Common list: effects whose `frequency` is `very_common` or `common`.
  - Rare and severe list: effects whose `frequency` is `rare` OR whose `severity` is `severe`, excluding any already in the common list.
  - Any effect in neither list (for example `uncommon` and not severe) goes into the common list, so no returned effect is ever dropped from the tab.
- The tab label count becomes the total number of effects in `profile.side_effects`, so it can never show (0) while the tab lists effects.
- Keep the tab's existing layout, sections, styling, and show-more behaviour identical; this is a data-wiring fix only.
- Also grep the whole `frontend/src` for `common_side_effects` and `rare_severe_side_effects` and fix any other component that reads those phantom fields the same way (Muse's audit found only this file, but confirm it).

## Out of scope
No design changes, no backend changes, no API changes, no other files. Do not touch the landing page, dashboard layout, explorer, assistant, or auth code beyond the grep fix above if another reader of the phantom fields exists.

## Done when
- `npm run build` and `npm run typecheck` in `frontend/` both pass.
- You confirm in your summary: the print hide list now includes `footer` and `#root`; the panel derives its lists from `profile.side_effects`; and the grep for the phantom fields returns no remaining readers.
- Manual check you should perform if the dev servers are running: open the dashboard, analyse Warfarin + Aspirin, open the Doctor's Report and Print Brief, and confirm the print preview now starts the brief on page 1; open a medicine profile and confirm the Side Effects tab shows a non-zero count and lists effects for Warfarin and for Ibuprofen.
