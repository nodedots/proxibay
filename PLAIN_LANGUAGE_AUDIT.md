# Plain-Language String Audit (app UI, all routes)

Method: every user-visible string in `src/` checked against a non-developer
reading it cold. Code comments, API paths, and internal type names are out of
scope — only rendered text. Each item: location → current → replacement.
"Kept" items are called out so the choices are reviewable.

## A. Status words shown raw (highest leverage — seen on every screen)

| # | Location | Current | Replacement |
|---|----------|---------|-------------|
| A1 | `ProjectDetail.tsx:526` connector pill | `connected` / `error` / `pending` | Pill keeps the dot; text becomes Receiving updates / Having trouble / Waiting for data (full line per layout spec §3) |
| A2 | `ProjectDetail.tsx:876` Recent rows | `firebase · connected · polled 12m ago` | `Firebase sent new data · 12m ago` (drop the enum chain entirely) |
| A3 | `ProjectDetail.tsx:774` rule pill | `active` / `muted` | Active / Paused (capitalized, and "Muted" → "Paused" — "muted" is mixer jargon) |
| A4 | `PortfolioHome.tsx:245` card footer | `· connected, error` (raw `connectorStatuses.join`) | Drop the enum list; the dot + card color already carry it. Keep only "Updated 2m ago" |
| A5 | `PortfolioHome.tsx:212,217` card a11y | `aria-label="…status green"`, `title="green"` | Human: `aria-label="Swaptrick — healthy"` (healthy / needs attention / waiting for data) |
| A6 | `AddProject.tsx:335` webhook result | `Status is [pending]` badge | `Waiting for your first update` (badge text, same style) |
| A7 | `ProjectDetail.tsx:427` project badge | `active` / `paused` / `archived` (lowercase) | Active / Paused / Archived (title case; enum stays internal) |
| A8 | `ProjectDetail.tsx:437-439` status `<select>` | lowercase options | Same title-case labels, same values |

## B. Metric/type labels shown raw

| # | Location | Current | Replacement |
|---|----------|---------|-------------|
| B1 | `ProjectDetail.tsx:738` chart subtitle | `user_metrics` | Family label: Users / Errors / Revenue / Uptime / Custom (new `metricFamilyLabel()` helper; key line below it stays specific) |
| B2 | `ProjectDetail.tsx:528` capability pills | `user_metrics`, `error_metrics` | Fold into the "Reporting" line: "Users: total, signups · Errors: count" (pills deleted, not relabeled) |
| B3 | `ProjectDetail.tsx:804` rule metric dropdown | `user_metrics / signups` | `Errors — error count` format: family first, then the specific thing |
| B4 | `ProjectDetail.tsx:775-779` rule rows | `error_count above 5 over 15m → email …` | Full sentence: "Tell me when error count goes above 5 over 15 minutes → email …" |
| B5 | `PortfolioHome.tsx:236` card metric names | `signups` (underscores stripped only) | Humanize via shared helper (`signups` → Signups, `error_count` → Error count, `transaction_volume` → Revenue) |
| B6 | `ConnectWebhook.tsx` snippet comments | `// one of: user_metrics, error_metrics, …` | Fine to keep — that page is developer-facing by nature. Only user-facing surfaces change. |

## C. Error messages that leak raw API text

| # | Location | Current | Replacement |
|---|----------|---------|-------------|
| C1 | `lib/api.ts:53` fallback | `` Request failed (403) `` | `Something went wrong (code 403). Try again — still stuck? Tell us what you were doing.` (code kept for support, sentence first) |
| C2 | `lib/api.ts:24-31` `connectErrorMessage` | passes `err.message` through verbatim | Map known server codes to sentences: bad signature → "That secret doesn't match — it may have been rotated. Generate a fresh one and try again."; 401/403 on health check → "We couldn't reach your Firebase project — check the key is still valid and hasn't been deleted."; 404 → "We couldn't find that — it may have been deleted." Unknown codes fall back to C1 pattern. Never render a bare code. |
| C3 | `ProjectDetail.tsx:235-261` attach sheets | `Saved but unhealthy: <raw detail>` | Keep the prefix, map the detail through the same C2 table (server health text like `auth-denied` must never surface). |
| C4 | `ProjectDetail.tsx:181` load failure | `Failed to load project. Check your connection and Firebase config.` | "We couldn't open this project. Check your connection and try again." ("Firebase config" is our wiring, not their problem.) |
| C5 | `PortfolioHome.tsx:105` list failure | `` Could not load projects: <raw error> `` | Same C1 pattern: sentence first, code in parens. Never interpolate raw errors. |
| C6 | `Editable` save failure (`ProjectDetail.tsx:58`) | `'Save failed.'` or raw API text | "Couldn't save that change — try again." (current "Save failed." is terse to the point of cold; raw passthrough is worse) |

## D. Internal-language leaks in UI copy

| # | Location | Current | Replacement |
|---|----------|---------|-------------|
| D1 | `ProjectDetail.tsx:415` archived banner | `Ingest disabled (URLs return 410).` | "This project is archived. New data is paused." |
| D2 | `ProjectDetail.tsx:765-766` alerts intro | `switch on automatically once scheduled evaluation ships` | "Rules you save here will start watching on their own." |
| D3 | `ProjectDetail.tsx:883` Recent footer | `Alert firings land here in Phase 2.` | Delete (feed lives in §5 now; nothing announces phases). |
| D4 | `ProjectDetail.tsx:544-547` webhook pending | `send a signed POST to <url>, then this flips to connected automatically` | "Send your first update to the address below — this switches on by itself once it arrives." ("flips" is engineer slang.) |
| D5 | `ProjectDetail.tsx:16-22` `timeAgo` | `never` (e.g. "Updated never", "Polled never") | "Not yet" ("Updated · not yet" reads wrong — restructure to "No updates yet" / omit the line when there's nothing to report). |
| D6 | `ProjectDetail.tsx:740` chart empty | `No points in range.` | "No signups in the last 7 days." (per-metric, per-range wording) |
| D7 | `types.ts:129` comment | `alerts deferred to Phase 2` | Code comment, not UI — kept, but reworded to avoid phase language even internally. |
| D8 | `ProjectDetail.tsx:500` pending-connector prompt | `Loading connectors…` | Fine (plain). Kept. |
| D9 | Duration picker labels (`h`/`m`, "Evaluate over") | Already plain. Kept. |

## E. Setup-flow copy flagged for the step-3 rewrite (not changed here)

These are sheet-specific and belong to the Add-flow pass; listed so nothing is missed:
- E1 `AddProject.tsx:186` + `ProjectDetail.tsx:572` — "Service-account JSON (read-only roles recommended)" needs the "What is this?" expander + Docs link (link already exists; expander doesn't).
- E2 Webhook sheets — needs the one honest "needs a developer" sentence above the snippet (both files).
- E3 Stripe/Supabase sheets — same treatment as E1 at lower priority (key-first, still jargon-heavy: "restricted secret key", "service_role secret", "whsec_…", "eyJ…").
- E4 Progress indicator Name → Connect → Done missing from Add flow (both phases render with no sense of place).
- E5 ConnectorPicker blurbs ("Auth users + error logs, polled on a schedule", "AFRICAN payment rails" tone check on Flutterwave blurb — "African payment rails revenue." is thin vs the others; expand to match the pattern: what it reads + how it arrives).

## F. Terminology verdict (audit, no changes needed except noted)

- **connector** — used everywhere in UI (picker, sheets, rows, docs). Consistent. Keep.
- **integration** — appears only in API paths (`/v1/integrations/…`) and code comments. Never user-facing. Keep (no user impact).
- **import** — used only for GitHub/Google Cloud repo importing (ImportPicker, portfolio menu). Distinct concept from connectors, never mixed. Keep.
- **project** — consistent everywhere. Keep.
- **metric** — consistent in UI; only raw in the B-items above. Fixed via B.
- **alert** vs **rule** — mixed: section titled "Alerts" but rows/empty-states say "rule" ("New rule", "Save rule"). Decision: user-facing word is **alert** ("New alert", "Save alert", "Mute alert"); `rule` stays code-internal (types, collections, API).
- **connector vs connection** — "Want to connect live data?" (verb, fine) vs noun "connector" (fine). No conflict.
- **dashboard** — Add flow says "open project dashboard →" while the section is a project page, and Portfolio is the dashboard. Decision: project pages are "project pages"; only Portfolio is "the dashboard". Fix the two Add-flow links (E-adjacent, fold into step 3).

## Shared helpers to add (implementation turn)
1. `metricFamilyLabel(metricType)` → Users/Errors/Revenue/Uptime/Custom.
2. `humanKeyLabel(key)` → Signups, Error count, Transaction volume, … (fallback: title-case + spaces).
3. `connectorStatusLine(status)` → {dot, headline} per spec §3 (single source; replaces CONN_PILL + ad-hoc ternaries).
4. `describeRule(rule)` → the §5 sentence (used by both the rule list and, later, the feed).
5. Centralize the C2 error-code table in `lib/api.ts` next to `connectErrorMessage`.

## Follow-up audit: strings added 2026-09-25 (portfolio removal + migration reconnect)

New user-visible copy since the original pass, checked against the same
non-developer-reading-it-cold standard. Line numbers omitted on purpose — they
drift faster than the last audit already did.

| # | Location | Current | Verdict |
|---|----------|---------|---------|
| F1 | `PortfolioHome.tsx` Remove button (card bottom right) | `Remove` + `aria-label="Remove {name} from your portfolio"` | Kept. Short button label is fine because the dialog carries the consequence; the accessible name names the target so a screen-reader user never hears a bare "Remove". |
| F2 | `ConfirmDialog.tsx` heading | `Remove "{name}"?` | Kept. Names the specific project, so it reads as a question about *this* thing rather than a generic warning. |
| F3 | `ConfirmDialog.tsx` body | `This permanently deletes the project and everything attached to it — data sources, metrics history, and alert rules. It can't be undone.` | Kept. States the blast radius in product words, not collection names. |
| F4 | `ConfirmDialog.tsx` body, second line | `Only want it out of the way for now? Open the project and use Archive instead — archived projects keep their history and can be restored.` | Kept. Offer the reversible path in the same breath as the destructive one; most "delete" intent is really "hide this". |
| F5 | `ConfirmDialog.tsx` prompt | `Type {name} to confirm` / `Remove permanently` | Kept. Matches the detail page's delete, so the two confirmations cost the same intent. "Remove permanently" not "Delete forever" — same meaning, less dramatic. |
| F6 | `PortfolioHome.tsx` success toast | `"{name}" was removed, along with its data sources, metrics, and alert rules.` | Kept. Confirms what actually happened after the card has already vanished — the absence of the card is not enough feedback on its own. |
| F7 | `ReconnectBanner.tsx` heading | `Reconnect your project — your credentials didn't carry over during our move to the new backend.` | Kept. Names the cause as a one-time migration event rather than a fault, which is the whole point of this step existing. |
| F8 | `ReconnectBanner.tsx` per-connector detail | e.g. `A fresh signing secret is generated below — update the secret where your backend sends metrics.` | Kept. Says what to do next instead of what broke. |
| F9 | `ReconnectBanner.tsx` dismiss | `Later` (not `Dismiss` / `Got it`) | Kept. Honest — the task is genuinely deferrable, and "Later" doesn't imply the problem went away. |
| F10 | `ConfirmDialog.tsx` busy label | `Removing…` | Kept. Mirrors the app's existing `Checking…` / `Importing…` pattern. |

Not covered here (out of scope for this audit): API error strings from the new
backend, which surface through the existing C2 error-code mapping in `lib/api.ts`.

