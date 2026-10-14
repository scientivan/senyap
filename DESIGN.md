---
name: Senyap
description: A private, stake-backed insider-signal market on Midnight, shown as a privacy market you can watch working.
colors:
  night: "#2a1b1b"
  night-2: "#1f1414"
  night-3: "#352323"
  night-line: "#4a3434"
  crimson: "#a50c22"
  red: "#c1272d"
  red-press: "#a31f24"
  gold: "#ae9970"
  gold-soft: "#d9cdb4"
  gold-ink: "#6a5a38"
  white: "#ffffff"
  panel: "#f5f3f3"
  panel-2: "#ebe7e7"
  line: "#e4dfdf"
  ink: "#2a1b1b"
  ink-2: "#5b4646"
  ink-3: "#8a7b7b"
  on-night: "#f4efef"
  on-night-2: "#cdbfbf"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "clamp(48px, min(7.4vw, 12vh), 104px)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "clamp(36px, 4.8vw, 64px)"
    fontWeight: 300
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "24px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  lede:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1
  stat:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', Inter, 'Helvetica Neue', sans-serif"
    fontSize: "clamp(56px, 6vw, 88px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.045em"
    fontFeature: "'tnum'"
  code:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "14px"
    fontWeight: 500
    letterSpacing: "0.04em"
rounded:
  row: "10px"
  panel: "12px"
  list: "14px"
  frame: "18px"
  sheet: "28px"
  pill: "999px"
spacing:
  gutter: "16px"
  frame-inset: "8px"
  panel: "18px"
  tile: "22px"
  section-tight: "112px"
  section: "140px"
  container: "1240px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 6px 0 22px"
  button-primary-hover:
    backgroundColor: "{colors.red-press}"
  button-secondary-light:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  button-secondary-light-hover:
    backgroundColor: "{colors.panel-2}"
  button-secondary-dark:
    backgroundColor: "{colors.night-3}"
    textColor: "{colors.on-night}"
    rounded: "{rounded.pill}"
    height: "48px"
    padding: "0 22px"
  button-sm:
    height: "40px"
    padding: "0 16px"
  pill-sealed:
    backgroundColor: "{colors.night}"
    textColor: "{colors.on-night}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 11px"
  pill-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.night}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 11px"
  pill-neutral:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "28px"
    padding: "0 11px"
  lockchip:
    backgroundColor: "{colors.night}"
    textColor: "{colors.on-night}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 12px"
  frame:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.frame}"
    padding: "8px"
  frame-panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "18px"
  ui-row:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.row}"
    padding: "10px 14px"
    height: "52px"
  note:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.frame}"
    padding: "22px"
  segmented:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "4px"
  segmented-on:
    backgroundColor: "{colors.night}"
    textColor: "{colors.on-night}"
    height: "38px"
  nav:
    backgroundColor: "{colors.night-3}"
    textColor: "{colors.on-night-2}"
    rounded: "{rounded.pill}"
    padding: "5px"
---

# Design System: Senyap

<!-- Recorded from the built artifact at apps/web (14 Oct 2026). Ground truth is the code; where the direction contract in apps/web/index.html and the build differ, the build wins. North Star and colour names were chosen by the documenter from the build and are provisional until Dien confirms them. -->

## Overview

**Creative North Star: "The Witnessed Vault"**

Senyap is a privacy market you can watch working. The page refuses the category default (a dark hero with glowing abstract 3D and a grid of feature cards) and instead shows the mechanism moving: crimson pick chips with a gold lock and cipher text travel right to left into a vault, buyers see a labelled histogram before paying, and each privacy step is something the visitor can press. Every private value carries a visible state (sealed, revealed to you, or public), and that state vocabulary drives colour more than decoration does.

The world is the AKINDO palette laid out in Cerebrium's structure. A sticky night-coloured hero fills exactly one viewport; white sheets with rounded top corners slide over it; a rounded night band and a night close section bracket the white middle. Display type is SF Pro at weight 300 (thin, clean, tightly tracked), while everything a visitor operates (buttons, chips, rows, tabs) is set at 500 or heavier. Density is calm on the landing surface: large display headings, a single context sentence underneath, then real product UI inside framed panels.

Reference sources chosen by Dien: cerebrium.ai and its Awwwards Site of the Day page for structure, typography rhythm and motion; AKINDO's brand palette for colour. Copy the structure and the palette only. Content, shapes and the vault metaphor are Senyap's own.

**Key Characteristics:**
- Night hero and night band with a 32px dot grid texture; white light sections; no other section backgrounds.
- Thin 300-weight display headings, solid 500+ UI text, justified paragraphs.
- Borderless pill buttons; the primary is red with a sliding arrow disc.
- Framed cards (outer frame, 8px inset, inner panel) that hold real product UI fragments.
- Gold means "revealed to you"; crimson means sealed and committed; night means sealed and unreadable. (Gold is also allowed as a general brand accent; see "Decided by Dien".)
- Motion explains the mechanism (chips sealing into the vault, text decrypting, bars growing on reveal), always gated by `prefers-reduced-motion`.

## Colors

A warm, dark-red AKINDO palette: two neutral families (night and white sheet), one bold red family, and gold as the one accent with a precise meaning.

### Primary
- **AKINDO Crimson** (`crimson`): the brand red for sealed, committed things. It colours the pick chips in the vault scene, inline accent words in headings, code names of Midnight primitives, and the lead bento tile.
- **Signal Red** (`red`): the action colour. Primary buttons, the buy button, the active-step dot, filled vote dots and the range input accent. Darkens to **Pressed Red** (`red-press`) on hover.

### Secondary
- **Revealed Gold** (`gold`): the colour of a value that has been revealed to you (histogram fills, tally bars, decryption shares, the "revealed to you" state chip) plus the closing word of display headlines. Lighter **Parchment Gold** (`gold-soft`) is gold text on night surfaces; **Deep Gold Ink** (`gold-ink`) is gold text on light surfaces. Gold also carries the focus ring and text selection.

### Neutral
- **AKINDO Night** (`night`, also `ink`): the hero, the privacy band, the close section, sealed chips, the selected segment and all primary text on white.
- **Vault Black** (`night-2`) and **Vault Panel** (`night-3`): framed surfaces and nav or tab tracks on night. **Night Rule** (`night-line`) is the 1px border on night.
- **White Sheet** (`white`): the background of every light section and of frames.
- **Soft Panel** (`panel`) and **Pressed Panel** (`panel-2`): inner panels, note cards, secondary buttons, empty bar tracks. **Hairline** (`line`) is the 1px border on white.
- **Ink 2** (`ink-2`): secondary text on white. **Ink 3** (`ink-3`) is for icons only, never body text.
- **Night Text** (`on-night`) and **Night Text 2** (`on-night-2`): primary and secondary text on night.

### Named Rules
**The State Colour Rule.** Colour reports privacy state before it decorates. Night or crimson with a lock means sealed, gold means revealed to you, a flat panel grey means public. A new surface that shows a private value must use one of these three, never a new hue. Exception decided by Dien on 14 Oct 2026: gold may also serve as a general brand accent (headline accent words, active tab, note icons, dark button disc, focus ring, selection).

**The Solid Only Rule.** Every fill is a solid token. No transparent tints, no gradient washes, no gradient text, no glow. The only gradient in the build is the dot-grid texture (`radial-gradient` dots on 32px cells), which is a pattern, not a wash.

**The No Market Colours Rule.** No green and red win/loss pairing and no price-chart shapes. Red is for action and commitment, never for "down".

## Typography

**Display Font:** SF Pro via the system stack (with Inter, then Helvetica Neue as fallback)
**Body Font:** the same stack
**Code Font:** `ui-monospace`, SF Mono, Menlo (code, cipher text and addresses only)

**Character:** one family carries the whole voice. Display sizes run at weight 300 with tight negative tracking (thin and clean, Cerebrium-like); every interactive or labelling surface sits at 500 to 800, so the page reads light at a distance and solid up close.

### Hierarchy
- **Display** (300, `clamp(48px, min(7.4vw, 12vh), 104px)`, 1.02): the hero headline only. The `vh` term keeps it inside one viewport at any zoom. The close section uses the same weight at `clamp(42px, 6.4vw, 92px)`.
- **Headline** (300, `clamp(36px, 4.8vw, 64px)`, 1.02): every section heading. The step list in "How it works" uses the same thin weight at `clamp(32px, 3.8vw, 50px)` as a navigable index.
- **Title** (500, 24px, 1.2): titles under framed cards. Note titles use 600 at 19px; preview and small card titles use 600 at 17px.
- **Lede** (400, 19px, 1.55, max about 640px): the single context sentence under a section heading. Hero lede is 19px with max 540px.
- **Body** (400, 17px, 1.55): running text, justified with hyphenation. Card and note body drops to 16px.
- **Label** (500, 13 to 15px, line-height 1): buttons (16px), nav (15px), pills and chips (13px), rows and tabs (14 to 15px).
- **Stat** (800, `clamp(56px, 6vw, 88px)`, 0.9, tabular figures): bento numbers only.
- **Code** (500, 13 to 15px): Midnight primitive names, cipher strings, wallet addresses.

### Named Rules
**The Thin Display Rule.** Display and headline text is weight 300 and tracked at -0.035em. Nothing a visitor clicks or reads as a label is thinner than 500.

**The Justified Paragraph Rule.** Every paragraph is `text-align: justify` with `hyphens: auto` and `text-wrap: pretty`. The only exceptions in the build are hint lines, tooltips and short UI notes, which are left aligned.

**The Monospace Is Data Rule.** Monospace appears only where the content is literally code, cipher text or an address. It is never a label style.

## Layout

- **Container:** max 1240px, centred, with side gutters of at least 16px that also respect the safe-area insets.
- **Stacking model:** the hero is `position: sticky` at `100dvh`; following content sits on white sheets (28px top radius, `z-index: 5`) that scroll over it. The privacy band is an inset night slab (8px side margin, 28px radius); the close section is a night sheet with a 28px top radius.
- **Hero fit:** the hero is exactly `100dvh` at any browser zoom. It sheds content by height first (hint under 640px tall, preview card under 520px, lede under 420px), then `useFitInside` scales the content block down to a floor of 0.72. Content is anchored bottom-left; the buyer preview card sits bottom-right on a 1.2fr / 0.8fr grid.
- **Section rhythm:** 140px vertical padding for main white sections, 112 to 120px for the band, intros and close. Heading to lede gap 16 to 20px; lede to content 44 to 52px.
- **Grids:** two-column splits (0.9fr / 1.1fr for "How it works" with a sticky step list at `top: 120px`; 0.8fr / 1.2fr for primitives), a six-column bento (3 + 3, then 2 + 2 + 2), and two-column note cards.
- **Headings stack:** the context sentence always sits under its heading in the same column. Two-column splits pair a heading block with interactive content, never a heading with a floating paragraph.
- **Breakpoints:** 980px (header collapses to a menu), 960px (all splits become one column; bento becomes two columns), 900px (hero becomes one column; vault canvas takes the top 46%), 600px (vault canvas 24%; hint hidden), 560px (bento one column), 520px (tally rows compress).

## Elevation & Depth

Mostly flat with tonal layering: depth comes from the frame-inside-panel nesting and from white sheets sliding over the sticky night hero. A small set of soft, offset, warm-tinted shadows lifts framed cards and floating elements; none glow.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 14px 34px -18px rgba(42, 27, 27, 0.32)`): framed cards, tooltips, and primitive rows on hover.
- **Card lift, hover** (`box-shadow: 0 22px 44px -22px rgba(42, 27, 27, 0.38)`): framed cards on hover, paired with a 3px rise.
- **Button seat** (`box-shadow: 0 6px 16px -8px rgba(20, 10, 10, 0.45)`): the primary button only.
- **Night float** (`box-shadow: 0 24px 50px -20px rgba(0, 0, 0, 0.6)`): the buyer preview card over the hero.
- **Hairline rule** (`box-shadow: 0 1px 0 var(--night-line)` or `var(--line)`): the scrolled header's bottom edge.

### Named Rules
**The No Glow Rule.** Shadows are offset downward and tinted with night. No zero-offset halos, no coloured glow, no glassmorphism or backdrop blur, no hard neobrutalist offsets. The 3D vault scene follows the same rule with solid materials.

## Shapes

Soft, consistent rounding at a few fixed steps: pills (999px) for every button, chip, tab track and nav; 18px for outer frames, tiles and note cards; 12px for inner panels and note icons; 14px for list rows; 10px for UI rows and inline notes; 28px for page-scale sheets and the band. Borders are always 1px (`line` on white, `night-line` on night). The bento tile tilts by -0.3deg on hover; nothing else rotates except icons that signal open or closed (the primitive row plus icon turns -45deg).

## Components

### Buttons
Borderless pills that feel solid and quick.
- **Shape:** full pill, 48px tall (40px small), no border.
- **Primary:** Signal Red with white label at 500 / 16px; when it carries an arrow, a white 36px disc sits flush right (6px padding) holding a red arrow.
- **Arrow disc motion:** on hover the visible arrow slides out to the right while a second arrow slides in from the left (0.45s, `cubic-bezier(0.16, 1, 0.3, 1)`). Press scales the whole button to 0.98.
- **Secondary:** Soft Panel with ink text on white sections; Vault Panel with Night Text on night sections. Its disc is ink (light) or gold (dark).
- **Quiet:** transparent, inherits colour, turns crimson on hover.
- **Disabled:** 55% opacity and a not-allowed cursor.

### Chips and pills
- **Pills** (28px, 13px / 500): neutral, sealed (night), public (panel grey), gold, night (gold-soft on Vault Panel), and ok (gold-ink on a pale gold). Icons are 13px inline SVG.
- **Lock chip** (32px, night, 13px / 500): a sealed value. Always carries the lock icon.
- **State chip** (34px, 14px / 500): Sealed (`#140c0c` with an inset night rule), Revealed to you (gold), Public (`night-line` grey), Partial (gold-soft on Vault Panel). It flips in on change (`rotateX` 70deg to 0 over 0.45s).

### Cards / Containers
- **Frame:** white, 1px hairline, 18px radius, 8px inset, Card lift shadow. Inside, a Soft Panel (12px radius, 18px padding) holds real product UI. Under the panel, a meta block holds a 500-weight title and one or two justified lines.
- **Bento tile:** the same frame recipe without the shadow. Tiles carry a pill naming the figure in the top-right corner (never above the stat), an 800-weight stat, and a 500 / 19px sentence. The lead tile panel is crimson; the second is night.
- **Note card:** Soft Panel, 18px radius, 22px padding, a 42px night icon square with a gold icon, a 600 / 19px first line and a justified body. Disclaimers and demo-data notices live here, never as loose paragraphs.
- **Preview card (hero):** night frame (`night-2`, `night-line` border) around a Vault Panel, holding a labelled histogram with gold fills and night pills.

### Inputs / Fields
- **Segmented control:** white pill track with a hairline, 4px inset, 38px segments; the selected segment is night with Night Text.
- **Range input:** native slider tinted with Signal Red; value shown at 600 with tabular figures.
- **UI row:** 52px minimum, white, hairline border, 10px radius, 500 / 15px label with a 400-weight muted value.

### Navigation
- **Header:** fixed, transparent over the hero; once scrolled it becomes solid night (or white over light sections) with a 1px rule. Wordmark at 500 / 21px.
- **Nav track:** a pill track (Vault Panel on night, Soft Panel on light) with 15px / 500 links in pill hit areas. Below 980px it collapses into a 40px round menu button and a dropdown panel (18px radius).
- **View-as tabs (privacy band):** the same pill-track pattern at 42px; the active tab is gold with night text.

### Vault scene (signature)
A Three.js canvas behind the hero copy. Crimson rounded-rectangle chips, each with a gold lock and two lines of monospace cipher text, flow right to left into a vault that can be dragged to rotate and clicked to speed the flow. Each arrival increments the "sealed picks" counter. Materials are solid; there is no bloom or glow. With reduced motion, the scene renders without the flow.

### Tooltips
White, 1px hairline, 12px radius, Card lift shadow, 250px wide, with a 600-weight first line. Every sealed or bucketed value has a tooltip that explains, specifically, why it is sealed or what the bucket means.

### Motion grammar
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` everywhere.
- **Decrypt:** card titles resolve from hex noise into text when they become active (about 900ms).
- **Grow:** revealed bars scale in from the left (0.9 to 1.2s).
- **Count up:** numbers count from zero with an ease-out curve when first seen.
- **Flip:** state chips and sent notes flip in on `rotateX`.
- **Reveal:** step content goes from 35% opacity to full as its step becomes active.
- **Reduced motion:** all animation and transition durations collapse to 0.01ms; hooks short-circuit to the final value. Without `IntersectionObserver`, content is shown immediately.

## Do's and Don'ts

### Do:
- **Do** set display and headline text in the SF Pro system stack at weight 300 with -0.035em tracking.
- **Do** put the context sentence directly under its heading, in the same column.
- **Do** justify every paragraph (`text-align: justify; hyphens: auto`).
- **Do** use white (`white`) as the background of every light section. Strong colour goes in the hero, the band, the close section, or inside cards.
- **Do** make buttons borderless pills; the primary is Signal Red with the sliding arrow disc.
- **Do** keep the hero at exactly `100dvh` at any zoom. Shed content by height first, then scale the content block with a floor of 0.72.
- **Do** label demo data as demo ("Demo market", "Undo demo", a note card stating that every team, scout and number is demo data).
- **Do** give every private value a visible state (sealed, revealed to you, public) and a tooltip explaining it.
- **Do** build cards as frame, inset panel with real product UI, then a title and one or two lines.
- **Do** gate every animation behind `prefers-reduced-motion` and keep content visible when scroll or observer APIs are missing.

### Don't:
- **Don't** put an eyebrow, kicker, or pill label above a heading. Ever.
- **Don't** use small monospace labels. Monospace is for code, cipher text and addresses only.
- **Don't** use glow, gradient washes, gradient text, or transparent tints.
- **Don't** use ":" in UI copy to explain a preceding phrase. Write a full sentence instead.
- **Don't** use em dashes or arrow glyphs in copy. Arrows appear only as SVG icons inside button discs.
- **Don't** place a context paragraph beside a heading in a second column.
- **Don't** add border outlines to buttons.
- **Don't** let anything read as gambling or trading: no price charts, no green/red win-loss colouring, no betting language.
- **Don't** let the page look AI-generated: no generic bordered feature cards with a small label, title and paragraph, no floating paragraphs, no pastel tints.
- **Don't** invent users, testimonials, volumes or partners.

### Decided by Dien (14 Oct 2026)
- **Body text weight is 400** (thin and clean). For Senyap this supersedes the older global rule of at least 500 on visible text. Display stays 300; UI labels 500 to 600; stats 800.
- **Gold is a general brand accent**, not only the "revealed to you" marker: headline accent words, the active view-as tab, note-card icons, the dark button disc, focus ring and selection may all use gold. Revealed values still use gold.
- **Bento pills sit in the tile's top-right corner**, never above the number, so nothing reads as an eyebrow.
