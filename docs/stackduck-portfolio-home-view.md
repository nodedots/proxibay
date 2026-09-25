# Proxibay — Portfolio Home View (UI/Layout Spec)

Follows on from the "Add Project" Flow, which referenced this view as the landing point for the "Add project" action and the destination status colors roll up to. This gives it the same level of detail the project detail flow already got.

## 1. Purpose

This is the single screen that embodies the core value proposition — one glance across every registered project, instead of checking N separate admin panels. It's the first thing the founder should see on login, and the thing that has to prove Proxibay is actually saving time versus the old workflow.

## 2. Layout

**Grid of project cards**, not a table — a table reads as data-entry/ops-console; a card grid reads as a portfolio you're proud of, which fits the Backstage-catalog half of the positioning better and scales visually well from a handful of projects up to ~15-20.

### Top bar
- "Add project" button — persistent, top-right, never buried in a menu (per the Add Project Flow doc's requirement)
- Search/filter input — filter by name, stack tag, or status (active/paused/archived)
- Optional view toggle: grid (default) vs. compact list, for once the portfolio grows past what's comfortable as cards

### Project Card (per project)
Each card shows, top to bottom:

1. **Status indicator** — a colored dot/bar, derived from: any active/triggered alert (red) > connector error state (amber) > all connectors healthy or no connector attached (green/neutral). This ordering matters: an active alert should always outrank a merely-quiet "no connector" state, since a firing alert is the thing that needs attention right now.
2. **Project name** (primary text)
3. **Stack tags** (small pills, if set) — e.g. `firebase`, `react`
4. **Key metrics row** — up to 3 numbers, chosen by what data actually exists for that project:
   - If `user_metrics` exists: total users or recent signups
   - If `error_metrics` exists: current error count/rate
   - If `revenue_metrics` exists: recent transaction volume
   - If none exist yet: the row is replaced with a quiet "No data connected" line + inline "Connect" link, not left visually blank
5. **Last updated** timestamp — when the most recent metric was received, so staleness is visible (e.g. "Updated 4m ago" vs. "Updated 3d ago" signals a possibly-broken poll)

### Empty portfolio state (zero projects)
- Not just a blank grid — a single centered prompt: "Register your first project" + the Add Project button, since this is the very first thing a new user (including the founder himself, day one) sees

## 3. Status Color Logic (detail)

Given the ordering in §2.1, the resolved status per project is:

```
if (hasTriggeredUnresolvedAlert) → red
else if (anyConnectorStatus === "error") → amber
else if (anyConnectorStatus === "pending") → neutral/gray (waiting for first data, not a failure)
else → green (healthy or no connector attached — deliberately not distinguished at a glance,
              since "no connector" isn't a problem state per the lazy-catalog philosophy)
```

**Design decision worth flagging:** a project with no connector at all shows the same green/neutral status as one with fully healthy connectors. This is intentional — the catalog philosophy treats "no data connected yet" as a valid, non-alarming state, not a warning. If this turns out to be confusing in practice (can't tell "healthy" from "not monitored" at a glance), a future revision could add a distinct neutral-gray "not monitored" state instead of folding it into green — flagged as an open item, not decided here.

## 4. Sort/Group Behavior

- Default sort: projects with an active alert first, then by most-recently-updated
- Optional grouping by status (active/paused/archived) — archived projects collapsed/hidden by default, since they shouldn't compete for attention on the primary view

## 5. Interaction

- Clicking a card → project detail view (per the Add Project Flow doc's Step 4/5)
- No inline actions on the card itself beyond navigation — editing, connector management, etc. all happen on the detail page, keeping the home view purely a scanning/triage surface

## 6. Open Items Surfaced by This Spec

- [ ] Decide whether "no connector attached" needs its own distinct visual state instead of folding into green/healthy, once real usage shows whether that's confusing
- [ ] Decide exact thresholds for "stale" data warnings (e.g. should a project whose Firebase connector hasn't reported in 24h show as amber even without an explicit connector error?)
- [ ] Decide compact list view's column layout, if/when the grid view stops scaling comfortably
