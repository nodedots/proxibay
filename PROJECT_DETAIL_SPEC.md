# Project Detail View — Full Layout Spec (v2)

Replaces the v1 draft. Defines the complete layout against the *current* product:
dark-mode token tiers (`text-ink`, `bg-surface`, …), grouped ConnectorPicker shelf,
per-connector setup sheets (Firebase/Stripe/Supabase/Webhook), alert-rule CRUD,
direct-Firestore + API fallback data layer. Companion to the Portfolio Home View doc.

## Purpose

One page per project: identify it, describe it, connect it, read it, watch it.
A non-developer who has never seen this page must be able to answer, top to
bottom: *what is this project, is it healthy, where does its data come from,
what are the numbers, and who gets told when something breaks?*

## Route & states

- `/projects/:projectId`. Unknown / unowned id → "Project not found" card + back link.
- Loading: skeleton blocks mirroring the sections below (header line, About card,
  connector rows, chart grid) — never a blank flash.
- Load failure: centered card, plain sentence, "Try again" (never a code).
- Archived: butter banner, plain words ("This project is archived. New data is
  paused."), Restore button. No status codes in copy, ever.

## Layout (top → bottom, max-width 1200px)

### 1. Header — identity + rare actions
- **Project name, inline editable, 30px Inter 600.** Click → becomes an input
  (Enter saves, Esc cancels). Same no-edit-mode pattern as the catalog, so the
  name works identically everywhere.
- **Status badge** (Active = mint, Paused = butter, Archived = slate) and
  **environment tag** (Production / Staging / Development — title case in UI,
  enum values stay internal).
- **"..." menu (right side)** holding everything used rarely: Pause, Archive,
  Delete, Restore (when archived). The current always-visible status `<select>`
  + "Archive…" button move in here so the header reads calm, not operational.
  - Pause = project kept, polling stops surfacing it as live.
  - Archive = soft-archive (data retained, ingest paused, restorable).
  - Delete = hard delete, typed confirm (type the project name), irreversible,
    highlighted as the danger action.
- Archived projects show Restore as a normal button (not buried in the menu).

### 2. Catalog — "About this project"
- Calm definition-list layout (two columns ≥sm): Description, Tags, Website,
  Code, Environment, Notes. Values render as quiet text; empty ones as
  "+ Add description" style placeholders — never blank rows, never a form.
- Every field edits in place on click (existing Editable behavior: Enter/blur
  saves, Esc cancels, inline error on failure). URLs render as links when set.
- Footer line: "Saved 2m ago" (relative time, never a timestamp).

### 3. Connectors — "Where live data comes from"
Each connected source is a card (not a row) with, top to bottom:
- **Title + plain-language status line** (never the enum):
  - connected → "Receiving updates" (+ green dot)
  - error → "Having trouble connecting" (+ coral dot) + one-line plain reason
  - pending → "Waiting for first data" (+ gray dot) + what happens next
    ("Firebase checks about every 30 minutes" / "Send your first update to the
    address below and this switches on by itself").
- **"Reporting" line**: human metric names actually flowing
  ("Users: total, signups · Errors: count") — never `user_metrics`-style enums.
- **"Last update" line**: relative time ("12m ago"); "Not yet" when nothing
  has arrived (never "never").
- **Actions, per source**: "Check again" (re-runs the health check, inline
  spinner → inline result); webhook address with Copy button; Stripe endpoint
  with Copy button.
- **Add-source area**: the grouped ConnectorPicker shelf (Database / Revenue /
  Webhooks, live vs Soon) + "How to get your credentials →" (new tab). Same
  per-type setup sheets as the Add flow. 1:1 per type: an attached type shows
  "Connected" in the shelf instead of re-offering setup.
- **Empty state** (no sources): "No live data yet — this page stays useful
  without it." + the picker inline. Never a dead end.

### 4. Metrics — "What the numbers say"
- **Hero stat row first**: one glanceable number per metric family present
  (e.g. Users 1,248 · Errors 3 today · Revenue $312 this month) — big numerals,
  human labels, no enums. Empty when no data (the row simply doesn't render).
- **Charts below**: one card per metric, human title ("Signups", "Error count"),
  current value top-right, line chart underneath.
- **Time-range selector: 24h / 7d / 30d** (simple segmented control, not a query
  builder; replaces the current 7/30/90). 24h reads intraday points.
- **Empty states per card**: "No signups in the last 7 days." (not "No points
  in range"). Whole-section empty: "Charts appear here automatically once your
  first data arrives." + link up to Connectors.

### 5. Alerts — rules + feed, one section
- **Rule rows in plain sentences**: "Tell me when *error count* goes *above 5*
  *over 15 minutes* → email you@example.com" + Active/Muted pill + Mute/Delete.
  (Replaces the current symbolic `key condition threshold` rendering.)
- **Feed below the rules**: recent firings, newest first, plain descriptions
  ("Error count went above your threshold (7 vs 5) · 2h ago · emailed").
  Until scheduled evaluation runs, the feed shows its empty state:
  "No alerts have fired yet. Rules you save above will start watching on
  their own." Feed row structure is defined now so evaluation only adds rows.
- **New-rule form**: metric dropdown shows human names ("Errors — error count");
  threshold is a plain number; window uses the duration picker with an
  "Evaluate over" label; channel + destination. Validation messages are
  sentences ("Pick a metric to watch first."). The current "Rules saved here
  switch on automatically once scheduled evaluation ships" line is rewritten
  per the string audit (no ship/phase language).

### 6. Recent activity
- Human rows only: "Firebase sent new data · 12m ago", "Health check passed · 1h ago",
  "You edited the description · 2d ago". No `type · status` enum rows.
- **Not** the alerts feed (that's §5) — this is connector/catalog activity.

## Responsive
- Header stacks (name → badges → "..." menu) at 375px; connector cards go full
  width; chart grid collapses to one column; the "..." menu stays tappable
  (≥44px targets). Duration picker and sheets already single-column safe.

## Explicitly out of scope for this pass
- Scheduled alert evaluation + delivery (engine work; the feed is ready for it).
- Synthetic uptime/ping connector; cross-project comparisons.
- Changing the data model (all copy changes map onto existing fields).
