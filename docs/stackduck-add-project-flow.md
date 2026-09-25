# Proxibay — "Add Project" Flow

Follows on from the Firebase Connector Spec. This walks through the actual end-to-end UX of registering a project, from the dev's first click to seeing live data — the point where the catalog (Backstage half) and monitoring (Datadog half) genuinely merge into one motion, per the positioning in the Project Document.

## 1. Design Principle

Registering a project and attaching monitoring are **not two separate flows**. The moment you add a project, you're offered a connector; skipping that step still leaves you with a valid (if quiet) catalog entry. Nothing is required beyond a name.

## 2. Step-by-Step Flow

### Step 1 — Create the project (minimal)

- Dev clicks "Add project"
- Only required field: **Name**
- Optional fields shown but collapsed/secondary: description, stack tags, repo URL, live URL, environment, notes
- On submit: a `Project` document is created with `status: "active"` by default, everything else empty/undefined

→ A bare project now exists in the catalog. This alone is a valid end state — someone could stop here and just use Proxibay as a lightweight project directory, per the "lazy catalog" decision.

### Step 2 — Offer a connector (optional, immediately after creation)

- Right after creation, the UI prompts: "Want to connect live data for this project?"
- Choices shown as cards: **Firebase**, **Generic Webhook**, (later: Supabase, Stripe)
- Dev can pick one, pick "do this later," or skip entirely

### Step 3a — If Firebase chosen

- Dev uploads/pastes a service account JSON (per the Firebase Connector Spec's auth section)
- Proxibay runs `healthCheck()` immediately on submit — fast feedback loop, not a silent failure discovered hours later
- On success: connector instance created with `status: "connected"`, declared capabilities shown (`user_metrics`, `error_metrics`, optionally `uptime_metrics` if they opt into the ping job)
- On failure: clear inline error, dev can retry or fix permissions without leaving the flow

### Step 3b — If Generic Webhook chosen

- Proxibay generates a unique ingest URL + a signing secret for this specific connector instance
- UI shows a minimal code snippet (curl + JS fetch example) showing how to POST a `NormalizedEvent`-shaped payload
- No `healthCheck()` possible yet (push-only) — status shows `"pending"` until the first event arrives, then flips to `"connected"`

### Step 4 — Land on the project's dashboard view

- Whether a connector was attached or not, the dev lands on the project detail page
- If no connector: empty state showing the catalog info entered, plus a persistent "connect data" prompt (not modal/blocking — it's just there, so the lazy path never feels like a dead end)
- If a connector was attached: first data may not exist yet (poll hasn't run, or push hasn't received anything) — show a "waiting for first data" state, not a blank/broken-looking chart

### Step 5 — Ongoing: catalog fields fill in over time

- The dev can edit any of the optional catalog fields later, from the same project detail page, with no separate "edit mode" ceremony — inline editable fields
- Adding a second/third connector to the same project later follows the same Step 3 flow, just triggered again from the project detail page rather than right after creation

## 3. Portfolio Home View (context for where this flow starts)

- Grid/list of all registered projects
- Each card: name, status color (derived from connected connectors' health + any active alerts — see Alerts open item), a couple of key numbers if data exists
- "Add project" is a persistent action from this view, not buried in a menu

## 4. Edge Cases Worth Deciding Later (not resolved here)

- What happens if a dev deletes a project that still has a connector actively receiving pushed data? (Reject deletion? Soft-archive + stop accepting events?)
- Can one connector instance serve multiple projects (e.g. one Firebase org with several apps under it), or is it strictly one connector per project? Current spec assumes the latter (one connector instance belongs to exactly one project) — worth confirming this holds once Supabase/Stripe connectors are added, since a single Stripe account might span multiple of the dev's projects.

## 5. Open Items Surfaced by This Flow

- [ ] Decide project-deletion behavior when an active connector exists
- [ ] Decide whether a connector instance can ever be shared across projects (e.g. one Stripe account, multiple apps) or must stay strictly 1:1
- [ ] Design the "waiting for first data" empty state content (what reassures the dev nothing's broken while they wait for the first poll/push)
