# AssetControl — Design System

This documents the **implemented** visual system for the AssetControl frontend. The source of truth for tokens is `artifacts/asset-control/src/index.css` (`:root` and `.dark`). This file supersedes the earlier dark "Command Center" brief, which was never implemented.

## Brand & personality

A calm, professional "operations console" for IT/operations teams. Warm, paper-like light surfaces with a confident teal primary and an energetic orange accent. Technical details (asset tags, serials, IDs) are set in a monospace face so columns and codes scan cleanly. The tone is precise and trustworthy without feeling like a cold enterprise dashboard.

## Color tokens

Tokens are HSL triplets consumed via `hsl(var(--token))`. Light is the default; a `.dark` variant exists but the app ships light-first.

### Light (`:root`)

| Token | HSL | Role |
|---|---|---|
| `--background` | `42 37% 96%` | Warm cream app background |
| `--foreground` | `222 28% 18%` | Ink slate text |
| `--card` | `42 45% 99%` | Card/panel surface |
| `--border` | `38 25% 87%` | Hairline borders |
| `--input` | `38 25% 82%` | Input borders |
| `--primary` | `174 48% 35%` | Teal — primary/interactive, focus ring |
| `--primary-foreground` | `42 45% 99%` | Text on primary |
| `--secondary` | `36 34% 91%` | Secondary surface |
| `--muted` | `40 26% 92%` | Muted surface (zebra, chips) |
| `--muted-foreground` | `218 14% 45%` | Secondary/label text |
| `--accent` | `24 86% 59%` | Orange — highlights/CTAs |
| `--destructive` | `3 63% 48%` | Red — destructive/errors |
| `--ring` | `174 48% 35%` | Focus ring (teal) |
| `--radius` | `0.65rem` | Base corner radius |

### Brand / fixed accents (used directly in `index.css`)

- **Orange CTA:** `#ef8b4b` (with lighter hover `#f4a061`) — the `button-accent` and brand mark.
- **Dark sidebar / dark button:** `#172b35` (deep teal-slate) with hover `#274852`.
- **Health/pulse green:** `#79cf9d`.

### Semantic status pills

Used for asset/maintenance status; each is a tinted background + saturated foreground:

- **Green** (available/healthy) `#37886b`
- **Blue** (assigned) `#5174b2`
- **Orange** (in repair / maintenance) `#bd6c38`
- **Red** (urgent / lost) `#bb5b54`
- **Gray** (retired / neutral) `#6b747a`
- **Purple** (secondary state) `#805fac`

## Typography

Dual-font strategy loaded from Google Fonts:

- **Manrope** (`--app-font-sans`) — headings, body, UI labels. Weights 400–800.
- **DM Mono** (`--app-font-mono`) — asset tags, serials, metrics, eyebrows, and any tabular/technical value. Weights 400–500.

Headings use tight negative letter-spacing (e.g. topbar `-0.055em`). Eyebrows are uppercase mono at ~10–11px with wide tracking.

## Layout & spacing

- **Shell:** fixed dark sidebar (`246px`, collapses to `70px` ≤820px, becomes a bottom bar ≤640px) + fluid main area.
- **Content width:** `.page-wrap` max `1440px`, generous padding that scales down on small screens.
- **Grids:** dashboard metric grid is 4-up; detail views are 2-column and collapse to 1 column ≤720px.
- **Rhythm:** small, dense gaps (typically `9–16px`) for an information-rich feel.

## Elevation & shape

- Elevation is conveyed with **hairline borders** (`--border`) and very subtle shadows (`0 2px 0 hsl(var(--foreground)/.025)`), not heavy drop shadows.
- Corner radius: `--radius` (`0.65rem`) base; buttons/inputs ~`7–8px`; cards/modals `10–12px`; status pills are fully rounded.
- Focus states: teal border + `3px` soft primary glow (`hsl(var(--primary)/.1)`).

## Components (conventions)

- **Buttons:** `button-accent` (orange, primary CTA), `button-dark` (ink slate), `button-ghost` (bordered/transparent), `text-button` (inline teal link). Compact min-height ~35px.
- **Cards / panels:** `--card` surface, hairline border, subtle shadow.
- **Data tables:** uppercase mono headers on a muted header row, row-only borders, hover tint in primary at low opacity.
- **Inputs:** `--background` fill, `1px` border, mono where values are technical (serials, IPs, tags).
- **Status pills:** tinted pill + small LED dot in the semantic color.

## Clerk theming

Auth screens use `@clerk/themes` `shadcn` with overrides in `App.tsx` matching this palette (teal primary `#2f7f78`, cream background `#fffdf8`, Manrope). Keep Clerk variables in sync with these tokens when the palette changes.
