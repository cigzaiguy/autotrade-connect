# Refinitiv Ivory Terminal — Visual Rework

Retheme the app to a light, print-terminal look inspired by Refinitiv / FT / Bloomberg's ivory mode. Structural code, routes, and data stay the same — only the design system and presentational shells change.

## Design tokens (src/styles.css)

Replace the current dark OKLCH palette with a light ivory system. All values expressed as tokens so shadcn utilities inherit them.

- `--background` = `#F5F1E8` (warm ivory paper)
- `--surface` = `#EEE8D8` (card paper)
- `--surface-strong` = `#E8E2D3` (raised surface / table stripe)
- `--hairline` / `--border` = `#0F1B3D` @ 12% (fine navy rule)
- `--foreground` = `#0F1B3D` (deep navy text)
- `--muted-foreground` = `#0F1B3D` @ 60%
- `--primary` = `#0F1B3D` (navy — used for headers, key CTAs, active nav)
- `--primary-foreground` = `#F5F1E8`
- `--accent` = `#8B1A1A` (oxblood — reserved for alerts, deltas-down, "LIVE" tags, admin warnings)
- `--signal-up` = `#0F5132` (forest green)
- `--signal-down` = `#8B1A1A`
- `--signal-warn` = `#8A6A00` (dark amber)
- Kill `shadow-glow` / cyan neon. Replace with `--shadow-paper` (crisp 1px navy hairline + tiny 2px offset shadow).
- Remove the `.scanline` utility (CRT effect doesn't belong on paper).

## Typography

- Load Space Mono (400/700) + Rubik (400/500/600/700) via `<link>` in `src/routes/__root.tsx` (drop Inter + JetBrains Mono links).
- `--font-mono` = `"Space Mono"` — used for headlines, tickers, listing codes, metric numerals, section eyebrows.
- `--font-sans` = `"Rubik"` — body copy, form inputs, table cell text.
- Set base body size to `15px` with `line-height: 1.55` for the executive density; headings tightened with `tracking-tight`.

## Executive density rules

- Card padding steps up from `p-4` → `p-6`; section gutters `gap-6`.
- Table rows min-height `44px`, zebra using `--surface-strong` at 50%.
- Numerals get `font-variant-numeric: tabular-nums` globally on `.font-mono`.
- Eyebrows: uppercase Space Mono, `text-[11px]`, `tracking-[0.22em]`, navy @ 70%.
- Buttons: square-ish `rounded-sm`, navy fill / ivory text for primary; ghost = navy 1px border on ivory.

## Component pass (presentational only)

Files touched, no logic changes:

1. **src/styles.css** — full token swap above, remove scanline & marquee glow, add `.paper-rule` (1px navy hairline), `.ticker-tape` (ivory bg, navy text, oxblood deltas).
2. **src/routes/__root.tsx** — swap font `<link>` tags; update `<meta name="theme-color">` to ivory; remove `className="dark"` on `<html>` (switch to light color-scheme).
3. **src/routes/index.tsx** (landing) — hero on ivory with navy headline in Space Mono, oxblood eyebrow "LIVE TERMINAL · EST. 2026", module cards become bordered paper tiles with navy rule + mono tag chips.
4. **src/routes/auth.tsx** — terminal login reframed as a "credentials slip": ivory card, navy border, mono field labels, oxblood error state.
5. **src/routes/_authenticated/dashboard.tsx** — Deal Room: ticker becomes ivory tape with navy text and oxblood/green deltas; category filter chips become navy outline pills; listing rows become dense table with mono listing codes and Rubik descriptions; status pills recolored (Listed=navy outline, Interest=amber, Matching=oxblood, Closed=green).
6. **src/routes/_authenticated/intel.tsx** — feed styled like an FT column: Space Mono headline, Rubik lede, oxblood "Impact" rule on the left.
7. **src/routes/_authenticated/admin.tsx** (+ queue/traders/deals subroutes) — admin chrome: oxblood "SYSTEM · ADMIN" banner instead of cyan warning, navy sidebar, CSV export button as ghost navy.

## Out of scope

- No changes to server functions, RLS, Firecrawl pipeline, routes, or data shapes.
- No new features. Purely a visual/theme replacement.

## Verification

- `bun run build` clean.
- Spot-check landing, /auth, /dashboard, /intel, /admin via Playwright screenshots at 1280×1800 to confirm the ivory/navy/oxblood system reads as a professional terminal and nothing regressed layout-wise.
