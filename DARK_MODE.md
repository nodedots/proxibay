# Proxibay — Dark Mode Tokens

Companion to `proxybay docs/DESIGN.md`. DESIGN.md fully specifies the light theme
plus one deliberately-dark component (the Inkwell Navy feature card). This doc
derives the dark theme **from that card**: in dark mode, the feature card's
aesthetic becomes the whole app's, and the page drops one tier deeper.

**Reference point:** the existing dark feature card = Inkwell Navy `#151b31`
background, Paper White text at 100% / 70% opacity, Coral accents.

---

## Tier ladder (dark)

The core idea — three navy tiers, bottom to top:

| Tier | Token role | Value | vs. Inkwell Navy |
|------|-----------|-------|------------------|
| Page background | `canvas` | **Midnight Navy `#0d1122`** | deeper (near-black, not pure `#000`) |
| Card surface | `surface` | **Inkwell Navy `#151b31`** | *is* the existing dark card |
| Elevated surface (modals, dropdown menus, popovers) | `elevated` | **Raised Navy `#222b4b`** | one step lighter |

Inset washes (Ash-Canvas-in-card uses like code blocks / stat tiles) get a
fourth tier between page and card: **Deep Inset `#12172e`**.

## Token mapping (light → dark)

| Role | Light (DESIGN.md) | Dark (proposed) | Rationale |
|------|-------------------|-----------------|-----------|
| Page background | Ash Canvas `#f2f2f2` | `#0d1122` | deeper than Inkwell, still warm-navy, not `#000` |
| Card / modal surface | Paper White `#ffffff` | `#151b31` (cards) / `#222b4b` (elevated) | cards stay distinct elevated tiers above the page |
| Inset wash | Ash Canvas `#f2f2f2` | `#12172e` | recessed areas read *below* the card |
| Primary text | Inkwell Navy `#151b31` | Paper White `#ffffff` | |
| Secondary text | Graphite `#333333` | `#b9bbc1` | = Paper White @ 70% blended on `#151b31` — same ratio as the dark card's existing 70% pattern |
| Muted / helper text | Slate `#6d6f75` | `#9698a2` | = Paper White @ 55% blended on `#151b31` |
| Hairline borders / dividers | Graphite / Slate | `#31364a` | = white @ 12% on navy; Slate/Graphite go muddy on dark |
| Input / strong borders | Slate `#6d6f75` | `#494d5e` | = white @ 22% on navy |
| Accent | Coral `#ff5858` | **`#ff5858` unchanged** | 5.5:1 on `#151b31` — passes AA, no brightening needed |
| Status green / amber / red | Mint `#86e0c1` / Butter `#fedf89` / Coral `#ff5858` | **unchanged** | pastels pop on navy: mint 11:1, butter ~13:1, coral 5.5:1 |
| Status gray / pending dot | Slate `#6d6f75` | `#9698a2` | slate is only ~3.3:1 on navy — brighten to muted-text tone |
| Primary button | Navy bg + Paper text | **Paper White bg + Inkwell Navy text (inverted)** | a navy button would vanish on navy cards |
| Ghost button | transparent + navy text/border | transparent + Paper text + `#494d5e` border | |
| The dark feature card (landing) | Inkwell `#151b31` | **Raised Navy `#222b4b`** | page is now darker than the card, so the card *stays* navy but bumps up one tier to remain distinct — same trick the light theme uses in reverse |
| Focus ring | Inkwell Navy outline | Paper White outline | navy ring invisible on navy |
| Skeleton | Warm Stone `#e8e7e5` + white shimmer | `#222b4b` + `rgba(255,255,255,0.08)` shimmer | |
| Shadows | warm-stone tint (`rgba(138,133,125,0.2)`) | `rgba(0,0,0,0.4)` | warm tint is invisible on navy; true black gives depth |
| Text on Inkwell surfaces (feature card body, tooltips) | Paper / Paper-70% | unchanged (Paper / `#b9bbc1`) | these stay dark in both themes |

## Contrast checks (on `#151b31` card tier)

| Pair | Ratio | Verdict |
|------|-------|---------|
| `#ffffff` text | 17.1:1 | AAA |
| `#b9bbc1` secondary | ~8.7:1 | AAA |
| `#9698a2` muted | ~5.8:1 | AA (passes for helper text) |
| `#ff5858` coral accent | ~5.5:1 | AA |
| `#86e0c1` mint status | ~11:1 | AAA |
| `#fedf89` butter status | ~13:1 | AAA |
| `#151b31` text on `#ffffff` primary button | 17.1:1 | AAA |

## Deliberately NOT flipped

- **Logo mark** (navy tile SVG, hardcoded `#151b31`/`#fff`/`#ff5858`): the tile is
  lighter than the dark page, so it reads exactly like the dark feature card does
  today. Keep brand-fixed.
- **Google sign-in button brand colors** (`#4285F4` etc.): brand-fixed.
- **Announcement banner** (Butter Yellow): stays butter in dark mode — a dark
  page still wants the warm yellow strip; text on it stays navy (13:1 on butter).

## Known hardcoded spots to convert in Step 3

- `src/pages/ProjectDetail.tsx` — recharts line `stroke="#151b31"` (invisible on
  dark cards → theme-aware stroke)
- `src/pages/PortfolioHome.tsx` — status dot hexes (`#6d6f75` gray → `#9698a2` in dark)
- `src/pages/Landing.tsx` — project accent hexes (mint/butter are fine as-is)
- `src/components/ImportPicker.tsx`, `src/pages/SignIn.tsx` — `accent-[#151b31]`
  checkbox tint (→ Paper White in dark)
- All `bg-paper-white` / `bg-ash-canvas` / `text-inkwell-navy` / `text-slate` /
  `text-graphite` / `border-warm-stone` utility usages across pages (mechanical
  re-point at the semantic tier tokens)

## Mechanism (Step 2/3 preview)

- `<html data-theme="light|dark">`; choice stored in `localStorage["proxibay-theme"]`
  as `light | dark | system`; **default `light`** for fresh visitors (never System).
- `system` = live `prefers-color-scheme` listener; on change it re-resolves
  `data-theme` while the app is open.
- Palette tokens (`--color-inkwell-navy` etc.) stay fixed; a new semantic tier
  (`--color-canvas`, `--color-surface`, `--color-elevated`, `--color-ink`,
  `--color-ink-secondary`, `--color-ink-muted`, `--color-line`, …) flips under
  `[data-theme="dark"]` and is what components reference.
