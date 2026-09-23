# DECISIONS.md — Proxibay Phase 1 working log

Per instructions: reasonable calls on PRD open items are logged here and we keep
moving. Full-stop questions (contradictions / expensive-to-reverse) go to the user.

## D1 — ConnectorInstance.type adds "stripe" (2026-09-20)
Data Model enum omits "stripe" but Stripe spec + PRD FR7 treat Stripe as v1.
Decision: `ConnectorType = "firebase" | "generic-webhook" | "supabase" | "stripe"`.
Cheap now, expensive later (rules + queries depend on it).

## D2 — MetricBucket doc ID includes key (2026-09-20)
Project doc says `projectId_metricType_date`; Data Model says `projectId_metricType_key_date`.
Decision: Data Model wins (`..._key_date`) — without key, one metricType with
multiple keys (signups + total_users) would collide.

## D3 — NormalizedEvent shape = Data Model (camelCase + connectorId/key) (2026-09-20)
Project doc uses snake_case without connectorId/key. Decision: Data Model wins;
it is the newer, storage-aligned shape.

## D4 — Credentials live in Secret Manager, Firestore holds only credentialsRef (2026-09-20)
PRD open item. Decision: Google Secret Manager (`projects/…/secrets/proxibay-{connectorId}/versions/latest`),
`credentialsRef` = secret resource name. Rationale: rotation + IAM without touching
Firestore; Functions config env would leak across instances. Firebase connector SA JSON
and webhook signing secrets both go here. Reversible cost: medium — ref format is
just a string, so migration path stays open.

## D5 — Webhook rate limit: 60 req/min per connectorId, 500-event batch cap (2026-09-20)
Spec leaves ceiling tbd. Decision: 60/min per connector + max 500 events per POST,
429 + `Retry-After` on exceed, signature failures logged and counted on connector
status. Tune after dogfood data.

## D6 — Retention: raw points 30 days, daily aggregates forever (2026-09-20)
Spec open item. Decision: scheduled cleanup trims `points` older than 30d;
`dailyAggregate` kept forever. Keeps dashboard reads bounded, preserves history.
Revisit if charts need longer intraday zoom.

## D7 — Poll cadence: Firebase every 30 min default (2026-09-20)
Spec range 15–60 min. Decision: 30 min default, per-connector override later.
Balances freshness vs Functions cost at ~15-project dogfood scale.

## D8 — Deletion with active connectors: soft-archive + disable ingest (2026-09-20)
PRD open item (block vs soft-archive). Decision: `deleteProject` sets
`status: "archived"`, flips connectors to error/disabled, ingest returns 410 Gone.
Hard delete only via explicit second confirm later. Rationale: push URLs may still
be live in dev backends — silent data loss is worse than a retained archived row.

## D9 — Connectors strictly 1:1 with projects in v1 (2026-09-20)
One Stripe account spanning apps is real but rare at dogfood scale.
Decision: 1:1; multi-project sharing deferred. Each instance has own secret/URL.

## D10 — "No connector" renders as neutral gray, distinct from healthy green (2026-09-20)
Home spec folds no-connector into green (deliberate but flagged confusing).
Decision: keep spec's priority chain, but render "no connector, no alert" as gray
(not green) so healthy-monitored vs not-monitored are distinguishable.
Status helper in src/types.ts preserves the chain; UI maps the final else into
green-if-any-connector / gray-if-none. Cheap to revert if dogfood disagrees.

## D11 — Tailwind v4 (@theme) + Recharts for charts (2026-09-20)
DESIGN.md ships v4 `@theme` tokens; chart lib was "Recharts / Tremor (tbd)" in
project doc. Decision: Tailwind v4 + Recharts. Fits existing tokens verbatim.

## D12 — Region europe-west1, single-owner Auth, no self-signup UI (2026-09-20)
Region: founder locale default; data residency cheap to change pre-launch.
Auth: email/password, accounts created in console; client has sign-in only.

## D13 — Single Express `api` function + emulator fallbacks (2026-09-20)
One v2 `onRequest` Express app (not one function per endpoint) to keep cold starts
at 1. Secret Manager has a Firestore (`_secrets/…`) fallback on the emulator where
Secret Manager doesn't exist; `credentialsRef` stays opaque either way. Rate limiting
is an in-memory per-instance minute counter — best-effort at dogfood scale; move to
a shared store if instances scale past 1.

## D14 — Direct-Firestore fallback in the client (2026-09-20)`src/lib/store.ts` mirrors the API's project/metric reads + project create/update/
archive with direct Firestore calls (all permitted by the rules + contract, which
already allows direct bucket reads). Pages try the Functions API first and fall back
automatically, so the app stays usable where only Auth+Firestore are deployed
(demo) or the API is down. Connector attach/healthcheck/rotate stay API-only —
they need server-side secrets and surface a clear error offline.

## D15 — Self-signup enabled, consent recorded in users/{uid} (2026-09-20)
Reverses D12's no-signup stance per request. Email signup + Google/GitHub OAuth
(popup on desktop, redirect ≤640px). Consent checkbox gates signup only, including
social (buttons disabled until checked); consent persisted as
`users/{uid} {email, consentAt}` (owner-only rules) for email signups and
first-time social signups (`isNewUser`, incl. redirect returns). /privacy + /terms
are placeholders marked for replacement.

## D16 — Consent gate is consent-state based, not signup-path based (2026-09-20)
Caught by real usage: the founder's GitHub login (via the Sign in tab) created a
user with no consent record — new social users entering outside the signup tab
bypassed the checkbox. Fix: after every login the client checks `users/{uid}`
for `consentAt`; missing record holds the user on a "One more step" interstitial
(agree + continue, or sign out) instead of entering the app. Self-healing for
pre-existing accounts too. Headless-browser GitHub popup tests proved unreliable
(popup self-closes in automation); the integration was verified by the founder's
real GitHub login instead.

## D17 — Landing page + two CSS-system fixes (2026-09-20)
Public `/` landing (nav, hero, one dark card, 3 blurbs, footer); portfolio moved
to `/portfolio`, app chrome hidden on `/`. Two real bugs found via screenshot:
(1) DESIGN.md `--spacing-<n>` tokens in Tailwind v4 `@theme` hijack the numeric
spacing scale (`h-8`→8px etc.) — tokens now live as plain `:root` vars, `@theme`
documents why; (2) unlayered component classes beat Tailwind utilities, so
overrides like `bg-paper-white` on `.badge` lost — primitives moved into
`@layer components`. Neutral badges also vanish on the ash page, so landing
labels use white badges.

## D18 — Product-site milestone: logo, legal, pages, polish system (2026-09-20)
Logo: connected-nodes mark (navy tile, 2 white + 1 coral node), Inter 600
wordmark lockup + icon-only + favicon.svg. Legal pages are real standard-form
content (Firebase Auth/Firestore, secret-manager credential handling, no
ads/selling, liability) — template, needs lawyer review before real signups.
New: About (founder note), Learn (quickstart + connectors + FAQ), Pricing
("free for now"), styled 404 + catch-all route. Polish: 150–200ms transitions
on all primitives, card lift, skeleton shimmer, modal pop/fade, focus-visible
rings, styled error+retry states, responsive display-type steps (64px desktop /
40px mobile), reduced-motion guard.

## D19 — Shared site chrome + NodeDots credit (2026-09-20)
`SiteNav`/`SiteFooter` replace per-page duplication (which had caused double
headers on About/Learn/Pricing); app chrome + wrapper stay off all marketing
paths via a shared path list (also fixes nested `<main>` landmarks). Founder
note signed NodeDots. Footer carries a "Developed by NodeDots" modal (story +
how-it-works links, no external URLs). Legal pages + 404 share the footer.

## D21 — OAuth repo/project importing (2026-09-20, scope fix amended later)
GitHub `repo` scope rides along at sign-in (proven working); Google's restricted
`cloudplatform.read-only` is requested LAZILY at import time only — requesting it
at login hard-breaks all Google sign-ins with `invalid_scope` (caught live).
A friendly verification-pending message covers rejections at import. Tokens: POST
/v1/integrations/:provider/token → Secret Manager + ref in users/{uid}.oauth;
client falls back to tab-scoped sessionStorage until the backend is deployed —
raw tokens never touch Firestore. Popup desktop / redirect ≤640px; import
reauth LINKS (never silently switches identity); picker auto-opens only for
genuinely new connections (no every-login nag); stale/revoked tokens get one
401-triggered re-auth. True webhook-driven repo sync deferred to Phase 2.

## D22 — GCP project link lives in notes, not a new field (2026-09-20)
The v1 Project model has repoUrl (used for GitHub) but no structured slot for a
GCP project ID. Per the stop-and-ask rule on schema changes, imports write
"Imported from GCP project ‹id›." into notes — visible, searchable, trivially
migratable to a real field later. No contradiction with the spec, no migration risk.

## D25 — Open-source site: MIT, feedback inbox, no header dropdown (2026-09-20)
MIT LICENSE (Saviour Ukobong/nodedots) + README referencing it. Feedback is a
public append-only `feedback` collection (shape-validated rules, console-reviewed;
spam risk accepted at this scale over an auth wall that would kill drive-by
reports). Header keeps About/Docs/Pricing flat — Support/Feedback/Changelog/
License live in the footer, so no Resources dropdown was needed.

## D27 — Kelviq billing, sandbox-only (2026-09-22)
Pro monthly/yearly flat per account ($9.99 → $107.89 computed, not hardcoded);
per-seat billing deferred to Teams/Enterprise (footer-copy only, no code). Plan identifiers stay server-side —
client sends tier/period, server maps via env (empty = 409 not-published, so
Pricing degrades to Coming-soon). customerId is always the verified UID.
Portal auto-provisions the Kelviq customer-with-email on first 400 and never
bare-500s. Webhook dedupe is an in-memory set (single instance; Redis before
scaling). No license wiring (no license-key plans), no free-plan enrolment (no
free plan published), no enforcement gates yet — all flagged as follow-ups.
Keys live in functions/.env.local (gitignored) → Functions env at deploy.

## D26 — shadcn + Rare UI adoption, re-themed (2026-09-20)
`components.json` + `@` alias + `cn()` wired for Tailwind v4 (no tailwind.config;
theme stays in `@theme`). Installed only the three mapped components (nothing
speculative): folder-component (new `proxibay` theme: paper body, navy flap,
warm-stone strokes + `accent` flap-dot carrying the home-status color),
fluid-orb (coral, 104px, ambient beside the hero snippet), duration-picker
(re-skinned to navy/slate/paper via direct edits; fixed its React-18 ref typing
and added missing flubber types). Alert rules get a minimal save/list/mute/
delete UI on the detail page (`projects/{id}/alertRules`, owner rules) with an
honest "evaluation ships later" note — the picker needed a real form, and a

## D21 — Theme switcher: Light/Dark/System, dark tokens derived from the feature card (2026-09-22)
Dark theme derived from the one deliberately-dark component DESIGN.md already
had (the Inkwell Navy feature card): page drops to Midnight Navy #0d1122,
cards take Inkwell Navy #151b31, modals/menus a Raised Navy #222b4b, and the
feature card bumps to Raised Navy so it stays distinct from the now-darker
page. Text is Paper White at 100/70/55% (the card's existing opacity pattern);
coral/mint/butter unchanged (5.5–13:1 on navy); slate idle-status dot
brightened; primary buttons invert (paper fill, navy text) because a navy
button would vanish on navy cards. Full token table + contrast checks in
DARK_MODE.md. Mechanism: fixed palette tokens stay put; a semantic tier
(`--color-canvas/surface/elevated/inset/feature/ink*/line*/primary/ring/…`)
flips under `html[data-theme="dark"]`; `@custom-variant dark` is
attribute-driven so `dark:` never fires from the OS alone. Choice persists in
localStorage `proxibay-theme` (UI pref, not app data); default is Light —
never System — with an inline index.html script applying it pre-paint;
`system` follows a live prefers-color-scheme listener. Every page/component
swept from palette utilities to semantic ones; butter/mint/coral surfaces keep
navy text in both themes by pinning `text-inkwell-navy` there explicitly.

dead-end demo widget would have been worse. CREDITS.md + Docs acknowledgment
per the MIT attribution ask. `/license` route
collides with the root LICENSE file only under vite-dev on case-insensitive
filesystems; production builds don't ship it, verified via preview.

## D23 — Stripe: amounts in major units, no mrr key, refunds deferred (2026-09-20)
Per-event values stored in major currency units (2500¢ → 25) with currency +
charge/payout id in metadata. Nightly job emits `revenue_30d` + `failed_24h`
gauges instead of the spec's approximate `mrr` — real MRR needs subscription
logic; a mislabeled number is worse than a missing one. Push owns per-event keys
so the two streams never double-count. Refunds/disputes acknowledged-ignored
until handling is designed. Webhook secret optional at connect (poll-only mode).

## D24 — Supabase: user_metrics only, active window 30d, anon rejected inline (2026-09-20)
Error logs need a Supabase management token the service_role key can't mint, so
the connector claims only `user_metrics` (spec's "don't assume" rule honored by
construction). `active_users` uses a stable 30d `last_sign_in_at` window rather
than the poll interval, so the gauge means the same thing every poll. The anon
key fails the admin lookup by design — the health check names that mistake
explicitly instead of a generic 401. Push upgrade (DB webhooks) deferred.

## D20 — Connection guide page + credential links in situ (2026-09-20)
New public `/learn/connect`: Firebase service-account key walkthrough (console
path, read-only lockdown to Firebase Authentication Admin + Logs Viewer, key
hygiene), webhook signing walkthrough (generate, Node + curl snippets, pending
→connected, limits), troubleshooting cards. Linked everywhere credentials are
asked: Add-flow step 1 + step 2 + both setup sheets, detail Live-data header +
both attach sheets, Learn connector cards (anchored #firebase/#webhook).


