# Solhaus — Style Reference
> warm couture atelier

**Theme:** light

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Solhaus's design system is a sunlit atelier built on warm cream surfaces (#faf8f5) with charcoal type and one burnt-rust accent (#c06230) that functions as a thread of stitching — it underlines, numbers, wipes, and punctuates, but never floods. The interface treats warmth as a substrate rather than a theme: display type is a high-contrast serif (Fraunces) set enormous and tight, with italic light-weight emphasis words carrying the emotional register, while UI text is a quiet sans (DM Sans) in uppercase with couture-wide tracking (0.2–0.3em). Corners are square — 0px is the default radius on every button, card, input, and image — and the only curve in the system is the architectural arch (rounded-t-full), borrowed from doorways and windows. Elevation comes from full-bleed color bands (cream → warm cream → umber → rust → charcoal) and hairline rules, with soft warm-tinted shadows reserved for photographs and the form card. Hand-drawn SVG line illustrations (arches, pendant lamps, armchairs) draw themselves on scroll, and photography runs in slow marquee ribbons — the product is the texture, the chrome is the tailoring.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Cream | `#faf8f5` | `--color-cream` | Page canvas, default section background — the warm everything sits on |
| Warm Cream | `#f4eee6` | `--color-cream-warm` | Alternating section bands, form card surfaces — one step deeper than canvas |
| Linen | `#f0ebe6` | `--color-muted` | Muted fills, quiet inset surfaces |
| Sand | `#e0d9d1` | `--color-border` | Hairline borders, dividers, input outlines — low-contrast warm structural edges |
| Putty | `#e7e0da` | `--color-input` | Default input border tone (overridden to Sand on the contact form) |
| Taupe | `#67574c` | `--color-taupe` | Body copy, descriptions, secondary metadata — warm grey-brown, never cool grey |
| Charcoal | `#2b2b2b` | `--color-charcoal` | Headings, nav links, footer canvas, closing CTA fill |
| Rust | `#c06230` | `--color-rust` | The single accent — primary buttons, eyebrows, active nav, numbers, underlines, hover wipes, philosophy band |
| Deep Rust | `#a04e22` | `--color-rust-deep` | Primary button hover state only |
| Umber | `#864923` | `--color-brown` | Hero canvas, page-hero bands — the dark warm substrate for cream type |
| Deep Umber | `#864923` | `--color-brown-deep` | Closing statement band, nav logo color (same resolved value as Umber, kept as a separate semantic slot) |
| Blush | `#dfb69f` | `--color-blush` | Gradient midpoint — warm placeholder washes, decorative only |
| Terracotta | `#d17847` | `--color-terracotta` | Gradient endpoint — warm placeholder washes, decorative only |
| Cocoa | `#7a4c2a` | `--color-cocoa` | Gradient endpoint, shadow tint source — decorative only |
| Crimson | `#c32222` | `--color-destructive` | Destructive/error states only — never decorative |

### Gradient Tokens

| Name | Value | Token |
|------|-------|-------|
| warm | `linear-gradient(135deg, #f4eee6 0%, #dfb69f 50%, #d17847 100%)` | `--gradient-warm` |
| rust | `linear-gradient(135deg, #c06230 0%, #7a4c2a 100%)` | `--gradient-rust` |
| cream | `linear-gradient(180deg, #faf8f5 0%, #f4eee6 100%)` | `--gradient-cream` |
| placeholder | `linear-gradient(135deg, #f0e6db 0%, #e0bfae 60%, #bd9475 100%)` | `--gradient-placeholder` |

Gradients appear only on placeholder project cards and the closing CTA band — never on buttons, never on text.

## Tokens — Typography

### Fraunces — Display serif — headlines, hero type, logo, service numbers, pull quotes, italic emphasis · `--font-fraunces`
- **Substitute:** "Fraunces" via Google Fonts (variable, opsz 9–144), or Cormorant Garamond / Playfair Display as fallback
- **Weights:** 300 (italic emphasis), 400 (default), 500, 600, 700 loaded — usage sits at 300–400
- **Styles:** roman + italic; italic is a first-class voice, not an afterthought
- **Sizes:** 20, 24, 30, 36, 48, 60, 72, 96, 144, 256
- **Line height:** 1.0–1.25 (hero 1.05, section heads 1.1, quotes 1.2)
- **Letter spacing:** default to slight positive (`tracking-wide` 0.025em on logo); no negative tracking
- **Role:** Every headline, the wordmark, ledger numbers (01–05), blockquotes, italic asides, and the giant ghost word ("atelier")

### DM Sans — UI and body sans — nav, buttons, labels, eyebrows, paragraphs, captions · `--font-dm-sans`
- **Substitute:** "DM Sans" via Google Fonts, or system-ui as fallback
- **Weights:** 300, 400, 500, 600 — usage sits at 400–500
- **Sizes:** 10, 12, 14, 16, 18
- **Line height:** 1.25–1.625
- **Letter spacing:** 0.2em on buttons/labels, 0.3em on eyebrows, 0.025em on nav — always uppercase at small sizes
- **Role:** All functional text. Never used for headlines except the italic marquee overlay quotes

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| micro | DM Sans | 500 | 10px | 1.5 | 0.3em (uppercase) | `--text-micro` |
| label | DM Sans | 400–500 | 12px | 1.33 | 0.2–0.3em (uppercase) | `--text-label` |
| body-sm | DM Sans | 400 | 14px | 1.43 | 0.025em | `--text-body-sm` |
| body | DM Sans | 400 | 16px | 1.5 | 0 | `--text-body` |
| body-lg | DM Sans | 400 | 18px | 1.625 | 0 | `--text-body-lg` |
| subheading | Fraunces | 400 | 24px | 1.33 | 0 | `--text-subheading` |
| heading-sm | Fraunces | 400 | 30px | 1.2 | 0 | `--text-heading-sm` |
| heading | Fraunces | 400 | 36px | 1.1 | 0 | `--text-heading` |
| heading-lg | Fraunces | 400 | 48px | 1.1 | 0 | `--text-heading-lg` |
| display | Fraunces | 400 | 60px | 1.05 | 0 | `--text-display` |
| display-lg | Fraunces | 400 | 72px | 1.05 | 0 | `--text-display-lg` |
| display-xl | Fraunces | 400 | 96px | 1.05 | 0 | `--text-display-xl` |
| ghost | Fraunces italic | 400 | 144–256px | 1 | 0 | `--text-ghost` |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** airy

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | `--spacing-4` |
| 8 | 8px | `--spacing-8` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 20 | 20px | `--spacing-20` |
| 24 | 24px | `--spacing-24` |
| 32 | 32px | `--spacing-32` |
| 40 | 40px | `--spacing-40` |
| 48 | 48px | `--spacing-48` |
| 56 | 56px | `--spacing-56` |
| 64 | 64px | `--spacing-64` |
| 80 | 80px | `--spacing-80` |
| 96 | 96px | `--spacing-96` |
| 112 | 112px | `--spacing-112` |
| 128 | 128px | `--spacing-128` |
| 144 | 144px | `--spacing-144` |
| 160 | 160px | `--spacing-160` |
| 176 | 176px | `--spacing-176` |

### Border Radius

| Element | Value |
|---------|-------|
| buttons | 0px |
| cards | 0px |
| inputs | 0px |
| images | 0px |
| arch frames (top corners only) | 9999px 9999px 0 0 |
| base fallback (unused) | 4px |

### Shadows

| Name | Value | Token |
|------|-------|-------|
| soft | `0 10px 40px -15px rgba(122, 76, 42, 0.15)` | `--shadow-soft` |
| warm | `0 20px 60px -20px rgba(192, 98, 48, 0.25)` | `--shadow-warm` |
| overlay-text | `0 2px 12px rgba(0, 0, 0, 0.55)` (drop-shadow on marquee quotes) | `--shadow-overlay-text` |

### Layout

- **Page max-width:** 1400px (container), 24px side padding
- **Content measures:** 672px (forms), 768px (CTA), 896px (studio), 1024px (quotes/hero)
- **Section gap:** 96px mobile → 128px desktop (statement bands 112→160px, 128→176px)
- **Form card padding:** 32px → 48px
- **Element gap:** 16–24px (grids), 40px (nav links), 56px (12-col split)

## Components

### Primary Action Button (Rust Slab)
**Role:** High-emphasis CTA — the one filled chromatic element per view

Background #c06230, text #faf8f5, border-radius 0, padding 24px 40px, DM Sans 14px / weight 500, uppercase, letter-spacing 0.2em, shadow-warm. Hover: background #a04e22. Trailing arrow icon 16px, 8px left margin. A slab, not a pill — the square corner is the signature.

### Closing Action Button (Charcoal Slab)
**Role:** Final-page CTA variant

Background #2b2b2b, text #faf8f5, border-radius 0, padding 24px 40px, DM Sans 14px uppercase, letter-spacing 0.2em. Hover: background #c06230 — the neutral slab warms into the accent.

### Nav Top Bar
**Role:** Fixed header, transparent-to-cream on scroll

Fixed top, height 80px, container flex justify-between. Transparent over the hero; after 20px scroll: background rgba(250,248,245,0.95), backdrop-blur-sm, shadow-soft. Logo left: Fraunces 24px, tracking 0.025em, #864923, "Solhaus" + rust period. Links right: DM Sans 14px uppercase, tracking 0.025em, 40px gaps, #2b2b2b; active and hover #c06230. Mobile: hamburger (24px line icon), dropdown panel bg-cream with border-t border-sand, 16px uppercase links.

### Underline Text Link
**Role:** Secondary editorial CTA ("Meet the Founder")

Inline-flex, gap 8px, DM Sans 14px uppercase, tracking 0.1em, color #2b2b2b, border-bottom 1px #c06230, padding-bottom 4px. Hover: text #c06230. The rust underline is the button.

### Eyebrow Label
**Role:** Section kicker above every headline

DM Sans 12px, uppercase, letter-spacing 0.3em, color #c06230, margin-bottom 16–24px. Optional leading hairline: 1px × 40px rust rule with 12px gap. On dark bands: rgba(250,248,245,0.7).

### Service Row (Numbered Ledger)
**Role:** The five services as an editorial index, not cards

List with border-top and border-bottom 1px rgba(43,43,43,0.2). Row: grid [auto 1fr auto], gap 24→40px, padding 32→40px vertical. Number: Fraunces italic 30→48px, #c06230, "01"–"05". Title: Fraunces 24→36px #2b2b2b. Description: DM Sans 16px #67574c, max-width 448px. Hover: a full-row rust wipe (scaleX 0→1, origin-left, 700ms ease-out) flips all text to cream and nudges the title 8px right.

### Arch Icon Frame
**Role:** Service icon container — the architectural curve

56×80px (64×96px desktop), border-radius 9999px 9999px 0 0 (a doorway arch), border 1px rgba(192,98,48,0.4), centered 36px hand-drawn line icon at strokeWidth 1.2. On row hover: border and icon go cream.

### Marquee Portfolio Strip
**Role:** Project photography as slow-moving ribbon

Full-width overflow-hidden row, images 256→384px wide at aspect-ratio 3/4, object-cover, square corners, 16→24px gaps, duplicated array, translateX −50% over 32s linear infinite, pause on hover. Centered overlay quote: DM Sans italic 30→48px, #faf8f5, tracking 0.025em, drop-shadow 0 2px 12px rgba(0,0,0,0.55). Rows separated by 40→56px.

### Placeholder Project Card
**Role:** "Project coming soon" tile until photography exists

Warm gradient fill (one of six 135–180deg cream→blush→terracotta→cocoa recipes), radial highlight overlay at 30% opacity with mix-blend-overlay, aspect 3/4 or 1/1, square corners. Centered: 40px × 1px cream/70 hairline above a Fraunces italic 16–18px cream label. Hover: charcoal/10 veil.

### Philosophy Quote Band
**Role:** Full-bleed rust statement section

Background #c06230, padding 112→160px vertical, container max-width 1024px centered. Eyebrow cream/70. Blockquote: Fraunces 30→48→60px, #faf8f5, line-height 1.2, text-balance, italic quote marks and italic second line.

### Form Card + Text Input
**Role:** Contact enquiry surface

Card: background #f4eee6, padding 32→48px, 24px vertical field rhythm, shadow-soft, square corners. Labels: DM Sans 12px uppercase, tracking 0.2em, #2b2b2b, rust asterisk for required. Inputs: height 40px, background #faf8f5, border 1px #e0d9d1, border-radius 0, padding 8px 12px, DM Sans 14–16px; focus: 2px rust ring. Submit: full-width Rust Slab.

### Style Quiz Option Card
**Role:** Selectable image tile in the questionnaire

Grid 2→4 columns, 16px gap. Tile: border 2px transparent, square corners; hover border rgba(192,98,48,0.4); selected border #c06230 + shadow-warm. Image aspect 4/3 over #f4eee6. Caption bar: bg-cream, padding 10px 12px, DM Sans 12–14px weight 500 #2b2b2b; selected rank badge 10px uppercase tracking 0.05em rust with 12px check ("1st", "2nd").

### Logo Mark
**Role:** Brand identification

"Solhaus" in Fraunces 24px (nav) / 30px (footer), tracking 0.025em, followed by a rust period — the full stop is the logo's only ornament. Nav color #864923; footer color #faf8f5.

### Footer
**Role:** Charcoal closing band

Background #2b2b2b, text rgba(250,248,245,0.8), margin-top 96px. Container 64px vertical, 3-column grid, 40px gap. Column heads: 12px uppercase tracking 0.1em cream/50. Links: 14px, hover rust. Tagline: Fraunces italic 18px cream/70. Bottom bar: border-top 1px cream/10, 12px cream/50, copyright left, Fraunces italic sign-off right ("Soul in form, home in function.").

### Scroll Cue
**Role:** Hero bottom indicator

10px DM Sans uppercase, tracking 0.3em, cream/60, above a 1px × 40px cream/60 vertical line that scales Y 0→1→0 on a 2s loop.

## Do's and Don'ts

### Do
- Use Fraunces for every headline and DM Sans for every label — the serif/sans division is absolute
- Set emphasis words in Fraunces italic weight 300 ("like *Couture*", "for *considered* homes") — italic is the emotional voice
- Use #c06230 as the only accent — buttons, eyebrows, numbers, underlines, active states, hover wipes
- Keep every corner square (0px) — buttons, cards, inputs, photos; the arch (rounded-t-full) is the single sanctioned curve
- Set small text uppercase with 0.2em (buttons/labels) or 0.3em (eyebrows) tracking — couture spacing is non-negotiable
- Use full-bleed color bands for rhythm: cream → warm cream → umber hero → rust quote → charcoal footer
- Draw ornaments as hand-drawn SVG strokes (1–3px, round caps) that animate on with stroke-dashoffset — underlines, arches, pendant lamps
- Keep section padding at 96px mobile / 128px desktop and let single focal points breathe
- Tint shadows warm (cocoa/rust at 15–25% alpha) and reserve them for photos, the form card, and the scrolled header

### Don't
- Do not round buttons, cards, or inputs — no 6px, no 12px, no pills; squareness is the brand
- Do not use cool greys, blues, or pure black — the neutral scale is warm (cream/sand/taupe/charcoal #2b2b2b)
- Do not set headlines in DM Sans or bold weights — display weight stays at 300–400 serif
- Do not add a second accent color — terracotta/blush/cocoa exist only inside placeholder gradients
- Do not put gradients on buttons, text, or chrome — gradients live on placeholder tiles and the cream CTA band only
- Do not use card grids for services — the numbered ledger row with hover wipe is the pattern
- Do not use stock photography or abstract illustration — imagery is real project photography (3/4 portrait) plus line-drawn architectural SVGs
- Do not use negative letter-spacing on display type — Fraunces runs at default or slightly positive tracking
- Do not stack heavy shadows — elevation is color bands and hairlines first

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Cream | `#faf8f5` | Page canvas — default section background |
| 1 | Warm Cream | `#f4eee6` | Alternating bands, form cards, quiz caption bars |
| 2 | Linen | `#f0ebe6` | Muted inset fills |
| 3 | Umber | `#864923` | Hero and page-hero bands — dark warm substrate |
| 4 | Rust | `#c06230` | Philosophy statement band, hover wipes |
| 5 | Charcoal | `#2b2b2b` | Footer, closing CTA fill |

## Elevation

Elevation in Solhaus's system is achieved through full-bleed background-color progression (cream → warm cream → umber → rust → charcoal) and 1px warm hairlines (sand, charcoal/20, cream/10), not shadow stacks. Only three elements earn a real shadow: the founder/project photography (shadow-warm, rust-tinted 25%), the form card and scrolled header (shadow-soft, cocoa-tinted 15%), and selected quiz tiles (shadow-warm). The marquee overlay quote uses a tight dark drop-shadow purely for legibility over photography. Decorative depth comes from the offset rust/20 square behind the founder portrait and the 6%-opacity ghost word — flat color at low alpha, never blur.

## Imagery

Solhaus's visual language is photography-plus-line-work: real interior project photos (bedrooms, cabinetry, curtains, exhibition, workspace) cropped to 3/4 portrait, square-cornered, running in duplicated 32s marquee ribbons with an italic quote overlaid. The hero contains no photograph at all — it is a line-drawn room (floor plane in perspective, double arch window, swinging pendant lamp, armchair, ceiling arch) stroked in cream/20 at 1.2px that draws itself in staggered sequence. Service icons are bespoke 32×32 hand-drawn line glyphs (arch door, pendant, lounge chair, floor plan, storefront) at strokeWidth 1.2–1.5. The founder portrait is 4/5 with a flat offset color block. Placeholder tiles are warm gradient washes with a radial light bloom. Every visual is either a real space or a sketch of one.

## Layout

Layout is container-contained at 1400px with 24px gutters, but sections are full-bleed color bands edge to edge. The hero is a centered min-h-screen umber band with oversized serif (48→96px), word-by-word reveal, and a single rust slab CTA. The services section is a 12-column split: sticky 4-column left rail (eyebrow, headline, arch illustration, italic aside) against an 8-column numbered ledger. Portfolio is stacked full-width marquee ribbons, not a grid. Statement sections (philosophy, about closer) are centered single-column quotes on rust/umber at 112–176px padding. The founder section is a 2-column text/photo split with 48–80px gaps; values are a 3-column text-only row (icon, serif title, paragraph — no cards). Navigation is a fixed 80px top bar, transparent over the hero, cream/95 + blur after 20px of scroll. The footer is a 3-column charcoal band. Vertical rhythm: 96px mobile, 128px desktop, never denser.

## Agent Prompt Guide

**Quick Color Reference:**
- text (primary heading): #2b2b2b
- text (body): #67574c
- text (on dark bands): #faf8f5
- background (canvas): #faf8f5
- background (alt band): #f4eee6
- background (hero band): #864923
- border (hairline): #e0d9d1
- accent (CTA / eyebrows / numbers): #c06230
- primary action hover: #a04e22

**3-5 Example Component Prompts:**

1. **Hero band:** Full-bleed #864923, min-height 100vh, centered. Line-drawn room SVG behind at cream/20, strokeWidth 1.2. Eyebrow "SOLHAUS · DELHI NCR" DM Sans 12px uppercase tracking 0.3em cream/60. Headline Fraunces 96px cream, line-height 1.05, second line italic weight 300 with a hand-drawn rust underline SVG (strokeWidth 3) that draws on. Subtext DM Sans 18px cream/85. One rust slab button: 0 radius, 24px/40px padding, 14px uppercase tracking 0.2em, shadow-warm.

2. **Service ledger row:** Border-top/bottom 1px rgba(43,43,43,0.2). Grid: italic Fraunces 48px rust number "01" / Fraunces 36px charcoal title + 16px taupe description / 64×96px arch frame (border-radius 9999px 9999px 0 0, 1px rust/40 border) holding a 36px line icon. Hover: rust background wipes left-to-right over 700ms, all text flips to cream, title shifts 8px right.

3. **Rust slab CTA:** Background #c06230, text #faf8f5, border-radius 0, padding 24px 40px, DM Sans 14px weight 500 uppercase letter-spacing 0.2em, box-shadow 0 20px 60px -20px rgba(192,98,48,0.25), trailing 16px arrow. Hover #a04e22. One per view.

4. **Marquee portfolio ribbon:** Overflow-hidden full-width row of 3/4 portrait photos, 384px wide, square corners, 24px gaps, duplicated set, translateX(-50%) 32s linear infinite, pause on hover. Centered overlay: DM Sans italic 48px cream, drop-shadow 0 2px 12px rgba(0,0,0,0.55).

5. **Contact form card:** Background #f4eee6, padding 48px, square corners, shadow-soft. Labels DM Sans 12px uppercase tracking 0.2em charcoal with rust asterisk. Inputs 40px tall, bg #faf8f5, 1px #e0d9d1 border, 0 radius, focus 2px rust ring. Full-width rust slab submit.

## Type Scale Detail

Hero: 48px → 60px (sm) → 96px (md) / Fraunces 400 / lh 1.05 / italic 300 emphasis
Page hero (About): 48 → 96 / Fraunces 400 / lh 1.0
Page hero (Contact): 48 → 72 / Fraunces 400 / lh 1.05
Section heading: 36 → 48 / Fraunces 400 / lh 1.1
Studio heading: 30 → 48 / Fraunces 400 / lh 1.25
Quote band: 30 → 48 → 60 / Fraunces 400 / lh 1.2
Statement band: 36 → 60 → 72 / Fraunces 400 / lh 1.15
CTA heading: 36 → 60 / Fraunces 400 / lh 1.05
Service number: 30 → 48 / Fraunces italic 400
Service title: 24 → 36 / Fraunces 400
Value title / logo (footer): 24–30 / Fraunces 400
Ghost word: 144 → 256 / Fraunces italic / rust at 6% alpha
Body large: 18px / DM Sans 400 / lh 1.625
Body: 16px / DM Sans 400 / lh 1.5
Nav / button: 14px / DM Sans 400–500 / uppercase / ls 0.025–0.2em
Eyebrow: 12px / DM Sans 400–500 / uppercase / ls 0.3em
Label: 12px / DM Sans 400 / uppercase / ls 0.2em
Micro: 10px / DM Sans 500 / uppercase / ls 0.3em

## Motion

| Name | Value | Role |
|------|-------|------|
| transition-smooth | `all 0.4s cubic-bezier(0.4, 0, 0.2, 1)` | Default hover/state transition |
| word-up | `0.9s cubic-bezier(0.2, 0.7, 0.2, 1)`, translateY 0.4em → 0, stagger 0.18s | Hero word-by-word reveal |
| reveal (rv) | `0.8s`, translateY 1.1rem → 0, delays 0.12/0.24/0.36/0.5s, IntersectionObserver threshold 0.2 | Scroll-triggered section reveals |
| line-draw | `3s ease-out` stroke-dashoffset 1 → 0, then 6s breathe (opacity 1 → 0.55) | SVG illustrations drawing on |
| marquee | `translateX(-50%) 32s linear infinite`, pause on hover | Portfolio ribbons |
| pendant-swing | `rotate ±2.5deg, 6s ease-in-out infinite` | Hanging lamp in line illustrations |
| glow-breathe | `opacity 0.45 → 0.15, 4s infinite` | Lamp glow |
| ghost-drift | `translateX 0 → -2rem, 20s infinite` | Giant background word |
| scroll-line | `scaleY 0 → 1 → 0, 2s infinite` | Hero scroll cue |
| row-wipe | `scaleX 0 → 1, 700ms ease-out, origin-left` | Service row rust hover fill |

All motion is disabled under `prefers-reduced-motion` (elements render in final state).

### Keyframes (exact source values)

```css
@keyframes marquee {
  0% { transform: translate(0); }
  100% { transform: translate(-50%); }
}
@keyframes line-draw {
  to { stroke-dashoffset: 0; }
}
@keyframes line-breathe {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
@keyframes word-up {
  to { opacity: 1; transform: translateY(0); }
}
@keyframes scroll-line {
  0% { transform: scaleY(0); }
  50% { transform: scaleY(1); }
  100% { transform: scaleY(0); transform-origin: bottom; }
}
@keyframes pendant-swing {
  0%, 100% { transform: rotate(2.5deg); }
  50% { transform: rotate(-2.5deg); }
}
@keyframes glow-breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.15; }
}
@keyframes ghost-drift {
  0%, 100% { transform: translate(0); }
  50% { transform: translate(-2rem); }
}
```

### Animation utility classes

```css
/* Hero entrance — set animation-delay inline per element */
.hero-fade { opacity: 0; animation: word-up 0.9s ease-out forwards; }
.word-up {
  display: inline-block; opacity: 0; transform: translateY(0.4em);
  animation: word-up 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) forwards;
}

/* Portfolio ribbons — duplicate the image array so -50% loops seamlessly */
.animate-marquee { animation: marquee 32s linear infinite; }
.animate-marquee:hover { animation-play-state: paused; }

/* Hero scroll cue */
.scroll-line { animation: scroll-line 2s ease-in-out infinite; transform-origin: top; }

/* Self-drawing SVG strokes — requires pathLength="1" on every path */
.line-draw {
  stroke-dasharray: 1; stroke-dashoffset: 1;
  animation: line-draw 3s ease-out forwards, line-breathe 6s ease-in-out 3s infinite;
}
.reveal-path { stroke-dasharray: 1; stroke-dashoffset: 1; opacity: 0; }
.in-view .reveal-path {
  opacity: 1;
  animation: line-draw 1.4s ease-out forwards, line-breathe 5s ease-in-out 1.6s infinite;
}

/* Scroll reveals — .in-view is added to the section by IntersectionObserver */
.rv {
  opacity: 0; transform: translateY(1.1rem);
  transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
  will-change: opacity, transform;
}
.in-view .rv { opacity: 1; transform: none; }
.rv-1 { transition-delay: 0.12s; }
.rv-2 { transition-delay: 0.24s; }
.rv-3 { transition-delay: 0.36s; }
.rv-4 { transition-delay: 0.5s; }

/* Illustration life */
.pendant {
  transform-box: view-box; transform-origin: 60px 12px;
  animation: pendant-swing 6s ease-in-out 2.4s infinite;
}
.pendant-glow { opacity: 0; animation: glow-breathe 4s ease-in-out 2.4s infinite; }
.ghost-drift { animation: ghost-drift 20s ease-in-out infinite; }

/* Default state transition */
.transition-smooth { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
```

### Stagger map (inline animation-delay values from the source)

| Element | Delays |
|---------|--------|
| Hero words "Interiors / dressed / like / Couture" | 0.30s / 0.48s / 0.66s / 0.84s |
| Hero underline under "Couture" | 1.5s delay; durations 1.2s draw + 6s breathe |
| Hero subtext / CTA / scroll cue | 1.6s / 1.9s / 2.4s |
| Hero room-sketch paths | 0 → 1.6s (floor first, arch, lamp, chair, ceiling) |
| Services arch illustration paths | 0.2s / 0.7s / 1.1s |
| Underline under "considered" | 1s delay; durations 1.1s draw + 5s breathe |
| Service ledger rows (transition-delay) | 0.15s + index × 0.1s |

### Scroll trigger (one observer per section, fires once)

```js
const section = document.querySelector("[data-reveal]");
const observer = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    section.classList.add("in-view");
    observer.disconnect();
  }
}, { threshold: 0.2 });
observer.observe(section);
```

### Reduced motion (exact source override)

```css
@media (prefers-reduced-motion: reduce) {
  .line-draw, .word-up, .hero-fade, .scroll-line {
    animation: none !important; opacity: 1 !important;
    transform: none !important; stroke-dashoffset: 0 !important;
  }
  .rv { opacity: 1 !important; transform: none !important; transition: none !important; }
  .reveal-path { animation: none !important; stroke-dashoffset: 0 !important; opacity: 1 !important; }
  .pendant, .pendant-glow, .ghost-drift { animation: none !important; }
  .in-view .pendant-glow { opacity: 0.4; }
}
```

## Similar Brands

- **Aesop** — Same warm-neutral apothecary palette, serif-led editorial type, square geometry, and restraint: one accent, generous whitespace, product-as-content
- **Soho Home** — Warm cream/umber/rust interior palette, high-contrast serif display with italic emphasis, full-bleed photography bands and editorial pacing
- **Studio McGee** — Interior-studio storytelling with serif headlines, warm neutrals, founder-forward narrative, and portfolio photography as the hero texture
- **Amber Interiors** — Earthy terracotta-and-cream palette, couture-wide uppercase labels, and slow, considered section rhythm
- **The Future Perfect** — Gallery-like restraint: square-cornered imagery, ledger-style listings, and type doing the work that chrome usually does

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-cream: #faf8f5;
  --color-cream-warm: #f4eee6;
  --color-muted: #f0ebe6;
  --color-border: #e0d9d1;
  --color-input: #e7e0da;
  --color-taupe: #67574c;
  --color-charcoal: #2b2b2b;
  --color-rust: #c06230;
  --color-rust-deep: #a04e22;
  --color-brown: #864923;
  --color-brown-deep: #864923;
  --color-blush: #dfb69f;
  --color-terracotta: #d17847;
  --color-cocoa: #7a4c2a;
  --color-destructive: #c32222;

  /* Gradients */
  --gradient-warm: linear-gradient(135deg, #f4eee6 0%, #dfb69f 50%, #d17847 100%);
  --gradient-rust: linear-gradient(135deg, #c06230 0%, #7a4c2a 100%);
  --gradient-cream: linear-gradient(180deg, #faf8f5 0%, #f4eee6 100%);
  --gradient-placeholder: linear-gradient(135deg, #f0e6db 0%, #e0bfae 60%, #bd9475 100%);

  /* Typography — Font Families */
  --font-fraunces: 'Fraunces', 'Cormorant Garamond', Georgia, serif;
  --font-dm-sans: 'DM Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* Typography — Scale */
  --text-micro: 10px;
  --text-label: 12px;
  --text-body-sm: 14px;
  --text-body: 16px;
  --text-body-lg: 18px;
  --text-subheading: 24px;
  --text-heading-sm: 30px;
  --text-heading: 36px;
  --text-heading-lg: 48px;
  --text-display: 60px;
  --text-display-lg: 72px;
  --text-display-xl: 96px;
  --text-ghost: 256px;

  /* Typography — Tracking */
  --tracking-label: 0.2em;
  --tracking-eyebrow: 0.3em;
  --tracking-nav: 0.025em;

  /* Spacing */
  --spacing-unit: 4px;
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;
  --spacing-128: 128px;
  --spacing-144: 144px;
  --spacing-160: 160px;
  --spacing-176: 176px;

  /* Layout */
  --page-max-width: 1400px;
  --container-padding: 24px;
  --section-gap: 96px;
  --section-gap-md: 128px;
  --form-padding: 48px;

  /* Border Radius */
  --radius-none: 0px;
  --radius-base: 4px;      /* fallback only — unused visually */
  --radius-arch: 9999px 9999px 0 0;

  /* Shadows */
  --shadow-soft: 0 10px 40px -15px rgba(122, 76, 42, 0.15);
  --shadow-warm: 0 20px 60px -20px rgba(192, 98, 48, 0.25);
  --shadow-overlay-text: 0 2px 12px rgba(0, 0, 0, 0.55);

  /* Motion */
  --transition-smooth: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  --ease-reveal: cubic-bezier(0.2, 0.7, 0.2, 1);

  /* Surfaces */
  --surface-cream: #faf8f5;
  --surface-cream-warm: #f4eee6;
  --surface-linen: #f0ebe6;
  --surface-umber: #864923;
  --surface-rust: #c06230;
  --surface-charcoal: #2b2b2b;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-cream: #faf8f5;
  --color-cream-warm: #f4eee6;
  --color-muted: #f0ebe6;
  --color-border: #e0d9d1;
  --color-input: #e7e0da;
  --color-taupe: #67574c;
  --color-charcoal: #2b2b2b;
  --color-rust: #c06230;
  --color-rust-deep: #a04e22;
  --color-brown: #864923;
  --color-brown-deep: #864923;
  --color-blush: #dfb69f;
  --color-terracotta: #d17847;
  --color-cocoa: #7a4c2a;
  --color-destructive: #c32222;

  /* Typography */
  --font-fraunces: 'Fraunces', 'Cormorant Garamond', Georgia, serif;
  --font-dm-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;

  /* Typography — Scale */
  --text-micro: 10px;
  --text-label: 12px;
  --text-body-sm: 14px;
  --text-body: 16px;
  --text-body-lg: 18px;
  --text-subheading: 24px;
  --text-heading-sm: 30px;
  --text-heading: 36px;
  --text-heading-lg: 48px;
  --text-display: 60px;
  --text-display-lg: 72px;
  --text-display-xl: 96px;

  /* Tracking */
  --tracking-label: 0.2em;
  --tracking-eyebrow: 0.3em;

  /* Spacing */
  --spacing-4: 4px;
  --spacing-8: 8px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-20: 20px;
  --spacing-24: 24px;
  --spacing-32: 32px;
  --spacing-40: 40px;
  --spacing-48: 48px;
  --spacing-56: 56px;
  --spacing-64: 64px;
  --spacing-80: 80px;
  --spacing-96: 96px;
  --spacing-112: 112px;
  --spacing-128: 128px;
  --spacing-144: 144px;
  --spacing-160: 160px;
  --spacing-176: 176px;

  /* Border Radius */
  --radius-none: 0px;
  --radius-base: 4px;
  --radius-arch: 9999px;

  /* Shadows */
  --shadow-soft: 0 10px 40px -15px rgba(122, 76, 42, 0.15);
  --shadow-warm: 0 20px 60px -20px rgba(192, 98, 48, 0.25);

  /* Breakpoint */
  --breakpoint-2xl: 1400px;
}
```

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
```

### Design Tokens (JSON)

```json
{
  "color": {
    "cream": { "$value": "#faf8f5", "$type": "color", "$description": "Cream — Page canvas, default section background" },
    "cream-warm": { "$value": "#f4eee6", "$type": "color", "$description": "Warm Cream — Alternating bands, form card surfaces" },
    "muted": { "$value": "#f0ebe6", "$type": "color", "$description": "Linen — Muted fills, quiet inset surfaces" },
    "border": { "$value": "#e0d9d1", "$type": "color", "$description": "Sand — Hairline borders, dividers, input outlines" },
    "input": { "$value": "#e7e0da", "$type": "color", "$description": "Putty — Default input border tone" },
    "taupe": { "$value": "#67574c", "$type": "color", "$description": "Taupe — Body copy, descriptions, secondary metadata" },
    "charcoal": { "$value": "#2b2b2b", "$type": "color", "$description": "Charcoal — Headings, nav links, footer canvas, closing CTA" },
    "rust": { "$value": "#c06230", "$type": "color", "$description": "Rust — The single accent: CTAs, eyebrows, numbers, underlines, hover wipes, philosophy band" },
    "rust-deep": { "$value": "#a04e22", "$type": "color", "$description": "Deep Rust — Primary button hover state only" },
    "brown": { "$value": "#864923", "$type": "color", "$description": "Umber — Hero canvas, dark warm band substrate" },
    "brown-deep": { "$value": "#864923", "$type": "color", "$description": "Deep Umber — Closing statement band, nav logo color" },
    "blush": { "$value": "#dfb69f", "$type": "color", "$description": "Blush — Gradient midpoint, decorative only" },
    "terracotta": { "$value": "#d17847", "$type": "color", "$description": "Terracotta — Gradient endpoint, decorative only" },
    "cocoa": { "$value": "#7a4c2a", "$type": "color", "$description": "Cocoa — Gradient endpoint, shadow tint source" },
    "destructive": { "$value": "#c32222", "$type": "color", "$description": "Crimson — Error states only" }
  },
  "font": {
    "fraunces": { "$value": "Fraunces", "$type": "fontFamily", "$description": "Display serif — headlines, logo, numbers, quotes, italic emphasis" },
    "dm-sans": { "$value": "DM Sans", "$type": "fontFamily", "$description": "UI sans — nav, buttons, labels, eyebrows, body copy" }
  },
  "typography": {
    "micro": { "$value": { "fontFamily": "DM Sans", "fontSize": "10px", "fontWeight": 500, "lineHeight": 1.5, "letterSpacing": "0.3em" }, "$type": "typography", "$description": "Scroll cue, rank badges — uppercase" },
    "label": { "$value": { "fontFamily": "DM Sans", "fontSize": "12px", "fontWeight": 400, "lineHeight": 1.33, "letterSpacing": "0.2em" }, "$type": "typography", "$description": "Form labels, footer column heads — uppercase" },
    "eyebrow": { "$value": { "fontFamily": "DM Sans", "fontSize": "12px", "fontWeight": 400, "lineHeight": 1.33, "letterSpacing": "0.3em" }, "$type": "typography", "$description": "Section kickers — uppercase, rust" },
    "body-sm": { "$value": { "fontFamily": "DM Sans", "fontSize": "14px", "fontWeight": 400, "lineHeight": 1.43, "letterSpacing": "0.025em" }, "$type": "typography", "$description": "Nav links, footer links" },
    "button": { "$value": { "fontFamily": "DM Sans", "fontSize": "14px", "fontWeight": 500, "lineHeight": 1.43, "letterSpacing": "0.2em" }, "$type": "typography", "$description": "CTA labels — uppercase" },
    "body": { "$value": { "fontFamily": "DM Sans", "fontSize": "16px", "fontWeight": 400, "lineHeight": 1.5, "letterSpacing": "0em" }, "$type": "typography", "$description": "Default body, service descriptions" },
    "body-lg": { "$value": { "fontFamily": "DM Sans", "fontSize": "18px", "fontWeight": 400, "lineHeight": 1.625, "letterSpacing": "0em" }, "$type": "typography", "$description": "Lead paragraphs" },
    "subheading": { "$value": { "fontFamily": "Fraunces", "fontSize": "24px", "fontWeight": 400, "lineHeight": 1.33, "letterSpacing": "0em" }, "$type": "typography", "$description": "Value titles, nav logo, service titles (mobile)" },
    "heading-sm": { "$value": { "fontFamily": "Fraunces", "fontSize": "30px", "fontWeight": 400, "lineHeight": 1.2, "letterSpacing": "0em" }, "$type": "typography", "$description": "Footer logo, studio heading (mobile), quote (mobile)" },
    "heading": { "$value": { "fontFamily": "Fraunces", "fontSize": "36px", "fontWeight": 400, "lineHeight": 1.1, "letterSpacing": "0em" }, "$type": "typography", "$description": "Section headings (mobile), service titles (desktop)" },
    "heading-lg": { "$value": { "fontFamily": "Fraunces", "fontSize": "48px", "fontWeight": 400, "lineHeight": 1.1, "letterSpacing": "0em" }, "$type": "typography", "$description": "Section headings (desktop), hero (mobile)" },
    "display": { "$value": { "fontFamily": "Fraunces", "fontSize": "60px", "fontWeight": 400, "lineHeight": 1.05, "letterSpacing": "0em" }, "$type": "typography", "$description": "Quote band (lg), CTA heading (md)" },
    "display-lg": { "$value": { "fontFamily": "Fraunces", "fontSize": "72px", "fontWeight": 400, "lineHeight": 1.05, "letterSpacing": "0em" }, "$type": "typography", "$description": "Contact hero (md), statement band (lg)" },
    "display-xl": { "$value": { "fontFamily": "Fraunces", "fontSize": "96px", "fontWeight": 400, "lineHeight": 1.05, "letterSpacing": "0em" }, "$type": "typography", "$description": "Hero and About hero (md+)" },
    "emphasis": { "$value": { "fontFamily": "Fraunces", "fontSize": "inherit", "fontWeight": 300, "lineHeight": "inherit", "letterSpacing": "0em", "fontStyle": "italic" }, "$type": "typography", "$description": "Italic light emphasis words inside headlines" },
    "ghost": { "$value": { "fontFamily": "Fraunces", "fontSize": "256px", "fontWeight": 400, "lineHeight": 1, "letterSpacing": "0em", "fontStyle": "italic" }, "$type": "typography", "$description": "Oversized background word at 6% rust alpha" }
  },
  "spacing": {
    "4": { "$value": "4px", "$type": "dimension" },
    "8": { "$value": "8px", "$type": "dimension" },
    "12": { "$value": "12px", "$type": "dimension" },
    "16": { "$value": "16px", "$type": "dimension" },
    "20": { "$value": "20px", "$type": "dimension" },
    "24": { "$value": "24px", "$type": "dimension" },
    "32": { "$value": "32px", "$type": "dimension" },
    "40": { "$value": "40px", "$type": "dimension" },
    "48": { "$value": "48px", "$type": "dimension" },
    "56": { "$value": "56px", "$type": "dimension" },
    "64": { "$value": "64px", "$type": "dimension" },
    "80": { "$value": "80px", "$type": "dimension" },
    "96": { "$value": "96px", "$type": "dimension" },
    "112": { "$value": "112px", "$type": "dimension" },
    "128": { "$value": "128px", "$type": "dimension" },
    "144": { "$value": "144px", "$type": "dimension" },
    "160": { "$value": "160px", "$type": "dimension" },
    "176": { "$value": "176px", "$type": "dimension" },
    "unit": { "$value": "4px", "$type": "dimension", "$description": "Base spacing unit" }
  },
  "radius": {
    "none": { "$value": "0px", "$type": "dimension", "$description": "Default — buttons, cards, inputs, images" },
    "base": { "$value": "4px", "$type": "dimension", "$description": "Fallback remnant — unused visually" },
    "arch": { "$value": "9999px 9999px 0 0", "$type": "dimension", "$description": "Arch icon frames — top corners only" }
  },
  "shadow": {
    "soft": { "$value": "0 10px 40px -15px rgba(122, 76, 42, 0.15)", "$type": "shadow", "$description": "Form card, scrolled header" },
    "warm": { "$value": "0 20px 60px -20px rgba(192, 98, 48, 0.25)", "$type": "shadow", "$description": "Photography, primary CTA, selected quiz tiles" },
    "overlay-text": { "$value": "0 2px 12px rgba(0, 0, 0, 0.55)", "$type": "shadow", "$description": "Marquee quote legibility" }
  },
  "surface": {
    "cream": { "$value": "#faf8f5", "$type": "color", "$description": "Level 0: page canvas" },
    "cream-warm": { "$value": "#f4eee6", "$type": "color", "$description": "Level 1: alternating bands, form cards" },
    "linen": { "$value": "#f0ebe6", "$type": "color", "$description": "Level 2: muted inset fills" },
    "umber": { "$value": "#864923", "$type": "color", "$description": "Level 3: hero bands" },
    "rust": { "$value": "#c06230", "$type": "color", "$description": "Level 4: statement band, hover wipes" },
    "charcoal": { "$value": "#2b2b2b", "$type": "color", "$description": "Level 5: footer, closing CTA" }
  },
  "$extensions": {
    "com.refero.extraction": {
      "url": "https://solhaus.design",
      "siteName": "Solhaus",
      "extractedAt": "2026-11-24T00:00:00.000Z",
      "variant": "extended"
    }
  }
}
```