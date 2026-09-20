# Project Detail View — Layout Spec (DRAFT for review — not implemented yet)

Companion to the Portfolio Home View doc, same card/palette language
(DESIGN.md tokens: Ash Canvas page, Paper White cards, Inkwell Navy actions,
Mint = healthy, Butter = warning, Coral = error).

## Purpose
One page per project: static catalog (editable), live connectors, metric charts,
recent history. Home is triage; this page is manage + investigate.

## Route
`/projects/:projectId`. Unknown / unowned id → "Project not found" card + link home.

## Layout (top → bottom, max-width 1200px)

### 1. Header row
- Status dot + project name (heading, 36px Inter 600 — GRIFTER never for UI text).
- `environment` badge (production/staging/development) + `status` badge
  (active = mint, paused = butter, archived = slate).
- Right side: status `<select>` (active/paused/archived) + Delete (soft-archive,
  confirm inline: "Archive? Ingest URLs return 410." per D8).

### 2. Catalog card — "About"
All fields inline-editable, no edit mode (FR2): click a value → it becomes an
input; blur/Enter saves via `PATCH /v1/projects/:id`; Escape cancels.
Fields: description (textarea), stackTags (comma input → pills), repoUrl / liveUrl
(linked when set), environment (select), notes (textarea, supports docs links).
Empty fields render as quiet "+ add" placeholders, never blank rows.
Optimistic UI with rollback on 4xx; `updatedAt` shown as "Saved 2m ago".

### 3. Connectors card — "Live data"
List of connector instances, one row each:
- Type icon/label (Firebase / Generic Webhook) + `capabilities` pills
  (user_metrics, error_metrics, …).
- Status pill: connected (mint) / error (coral) / pending (ash) + `lastHealthCheck`
  / `lastFetchedAt` as relative time ("polled 12m ago").
- Per-type actions:
  - Firebase: "Run health check" (`POST …/healthcheck`), inline error detail on failure.
  - Webhook: ingest URL (copy button) + "Rotate secret" (shows new secret once,
    notes 24h grace) — raw secret never displayed after creation.
- "Connect another" button → same Step-3 sheets as the Add flow (1:1 per type
  enforced: existing type shows "already connected" instead).
- No connector → persistent non-modal prompt (FR19): "No live data yet — [Connect
  Firebase] [Create webhook URL]" (never a dead end).
- Poll-but-no-data-yet / push-pending → "Waiting for first data" state with what to
  expect ("Firebase polls every ~30 min" / "Send a signed POST to the URL above"),
  not blank charts.

### 4. Metrics section — "Charts"
- One chart card per observed `(metricType, key)`: 30-day view by default
  (`GET …/metrics?metricType=&key=&from=&to=`), Recharts line (counts) — gauges
  (`uptime status`) render latest-value + step line.
- Card header: human label ("Signups"), current value (`dailyAggregate.last`),
  30d sum where meaningful. Empty buckets → "No points in range" (not zero-line).
- Range picker: 7d / 30d / 90d (API max 90d). Points downsampled client-side >500.
- No metrics at all → the waiting-state copy from §3 (never blank/broken charts).

### 5. Activity card — "Recent" (Phase 1: poll/ingest history; alert feed in Phase 2)
- Rows: connector polls ("Firebase poll: 3 events, 12m ago"), webhook receipts,
  health-check results, catalog edits. Source: connector `lastFetchedAt` /
  `lastHealthCheck` + bucket `updatedAt` (no new collection in v1).
- Phase 2 adds alert firings here (spec'd in Alerting Model).

## States
- Loading: skeleton cards. Error: inline card w/ retry (expired session → sign-in).
- Archived: butter banner "This project is archived. Ingest disabled." + Restore button.

## Open (detail-specific)
- Chart per key vs per metricType grouping once keys grow (defer: per key, regroup later).
- Stale-data threshold: no poll/push in 24h → amber connector row even if `connected`?
  (Same open item as Home; propose 24h, decide in dogfood.)
- Catalog edit conflict: last-write-wins v1 (single owner — acceptable).

## Explicitly out of scope (v1)
Alert rule CRUD + firings feed, Stripe/Supabase sections, cross-project comparisons.
