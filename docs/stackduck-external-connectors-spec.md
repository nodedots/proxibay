# Stackduck — External Connectors Retroactive Spec (Sentry, GitHub Actions, PostHog, Better Stack, Vercel)

These five shipped in `f193ff2` ("support for new external connectors") without
going through the per-connector spec process used for Firebase / Stripe /
Supabase / Generic Webhook. This document backfills that process: exact auth
requirements, a read-only audit at the credential level, capabilities mapped to
the five metric types, and known limitations. Format follows
`stackduck-supabase-connector-spec.md` (§1 Why, §2 Auth, §3 Fetch Mode,
§4 Capabilities, §5 Known Limitations, §6 Open Items).

Implementation under review: `backend/src/connectors/providers/external-config.ts`
(endpoints + `capabilitiesFor`), `external-fetch.ts` (poll normalization),
`external.connector.ts` (health checks), `src/components/ExternalConnectorForm.tsx`
(setup copy). All five are `authType: api_key`, `fetchMode: poll` on the shared
30-minute schedule (Stripe-style nightly reconciliation does not apply).

## 1. Sentry

**Why:** error tracking most indie projects already run; complements Firebase
`error_metrics` for non-Firebase stacks.

**Auth:** `api_key` — Sentry auth token (org token via internal integration, or
user token via User Settings → Personal Tokens), `Authorization: Bearer`.
Minimum scopes: **`project:read`** (project details health check) +
**`event:read`** (24h received-stats query). Both are read-only scopes; a token
minted with exactly these two cannot mutate anything.
**Read-only at credential level: YES** (when scoped as specified).

**Capabilities → source → normalized events** (all `error_metrics`):

| Capability | Sentry source | Normalized event(s) |
|---|---|---|
| `error_metrics` | `GET /api/0/projects/{org}/{project}/stats/?stat=received&since=&until=&resolution=1h`, summed | `{ metricType: "error_metrics", key: "events_received_24h", value: N }` |

**Known limitations:**
- sentry.io only — the host is hardcoded; self-hosted Sentry is unsupported.
- Stats resolution is hourly over a fixed trailing 24h; not per-issue breakdown.
- Sentry API rate limits apply per org; a 429 surfaces as connector `error`.

## 2. GitHub Actions

**Why:** CI health (runs, failures, in-progress) for the repos Stackduck
already catalogs via `repoUrl`.

**Auth:** `api_key` — fine-grained personal access token restricted to the
single repository, permissions **Actions: Read-only** + **Metadata: Read-only**
(repository must match `owner/name`). Sent as `Bearer` with
`X-GitHub-Api-Version: 2022-11-28`.
**Read-only at credential level: YES** — fine-grained PATs enforce this
server-side. (Do NOT accept classic PATs with `repo` scope here: those are
read/write.)

**Capabilities → source → normalized events:**

| Capability | GitHub source | Normalized event(s) |
|---|---|---|
| `custom` | `GET /repos/{repo}/actions/runs?per_page=100&created=>={24h ago}`, `total_count` | `{ metricType: "custom", key: "workflow_runs_24h", value: N }` |
| `error_metrics` | same payload, `conclusion === "failure"` | `{ metricType: "error_metrics", key: "failed_workflow_runs_24h", value: N }` |
| `custom` | same payload, `status !== "completed"` | `{ metricType: "custom", key: "in_progress_workflow_runs", value: N }` |

**Known limitations:**
- Authenticated rate limit (5,000 req/hr) is shared with the user's other API
  use; polling is one call per 30 min so this is headroom, not a risk.
- Only the first 100 runs in the window are examined: `total_count` stays
  accurate but `failed_workflow_runs_24h` / `in_progress_workflow_runs`
  undercount on repos with >100 runs/day.
- Private repos require the token to actually cover that repository; a
  wrong-repo token fails the health check (`GET /repos/{repo}`).

## 3. PostHog — ⚠️ CAVEAT REQUIRED (same class as Supabase)

**Why:** product-usage metrics (active users, event volume) for PostHog-backed
projects.

**Auth:** `api_key` — PostHog **personal API key** (`phx_…`) + numeric project
ID + region (`us`/`eu`), via `POST /api/projects/{id}/query/` with a
`HogQLQuery` body. PostHog supports granular key scopes, and the query endpoint
documents a **project query read permission** — but the setup form does not
require or verify scoping, and a default personal key is created with **full
account access ("like logging in")**. Worse, `query:read` itself permits
**arbitrary HogQL `SELECT`s**: whoever holds the key can read all events and
person properties in the project, not just the two aggregates we query.
**Read-only at credential level: PARTIAL** — a scoped key cannot write, but no
scope restricts it to our two queries; treat the key as read access to the
whole project dataset.

**Capabilities → source → normalized events:**

| Capability | PostHog source | Normalized event(s) |
|---|---|---|
| `user_metrics` | `SELECT count(DISTINCT person_id) FROM events WHERE timestamp >= now() - INTERVAL 30 DAY` | `{ metricType: "user_metrics", key: "active_users_30d", value: N }` |
| `custom` | `SELECT count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR` | `{ metricType: "custom", key: "events_24h", value: N }` |

**Known limitations:**
- Two HogQL queries per poll; on huge event volumes these are the most
  expensive polls in the fleet — watch PostHog query billing/limits.
- Person identification follows PostHog's `person_id` semantics (anonymous +
  identified blending per project settings), so `active_users_30d` is not
  directly comparable to Firebase/Supabase user counts.
- EU vs US region must match the project or every call 404s.

## 4. Better Stack — ⚠️ CAVEAT REQUIRED (same class as Supabase)

**Why:** uptime status for projects that already monitor with Better Stack.

**Auth:** `api_key` — Better Stack **Uptime API token** (team-scoped; global
tokens also exist and are wider), `Authorization: Bearer`. Better Stack offers
**no granular per-endpoint scopes**: within its team a token is unrestricted
**read AND write** — it can list monitors, create incidents (paging on-call),
and delete resources. There is no read-only token type.
**Read-only at credential level: NO.** Our code only `GET`s, but the key
itself is read/write over the whole team's Uptime resources. The setup form's
current hint ("Use a read-only Uptime API token") describes a thing that does
not exist and must be corrected.

**Capabilities → source → normalized events:**

| Capability | Better Stack source | Normalized event(s) |
|---|---|---|
| `uptime_metrics` | `GET /api/v2/monitors?url={monitorUrl}`, exact-URL match on `attributes.url` | `{ metricType: "uptime_metrics", key: "availability_percent", value: 0 or 100 }` |

**Known limitations:**
- Match is an exact string equality on the monitor URL — a trailing slash or
  `http` vs `https` mismatch reads as "monitor unavailable" (connector
  `error`), not as down.
- `validating` status maps to 100 (treated as up); only `down` maps to 0.
- Poll returns at most one monitor; multi-URL projects need one connector per
  URL (1:1 rule already enforces one Better Stack connector per project).

## 5. Vercel — ⚠️ CAVEAT REQUIRED (same class as Supabase)

**Why:** deployment health (ready/failed/in-progress counts) for Vercel-hosted
projects.

**Auth:** `api_key` — Vercel access token (`vcp_…`) + Vercel project ID
(+ team ID for team projects). Vercel tokens scope **breadth** (Full Account /
Team / Project) but never **depth**: every scope level is read+write within
its boundary, including reading **environment variables (which hold secrets)**
and triggering/deleting deployments. There is no read-only Vercel token.
**Read-only at credential level: NO.** Additionally, the current health check
calls `GET /v2/user` (a user-level resource), which **project-scoped tokens
cannot reach** — so as built, the connector effectively requires a Team- or
Full-Account-scoped token, i.e. the broadest options. Minimum practical scope
today: Team-scoped; Full Account if the user deploys personally.

**Capabilities → source → normalized events** (`GET /v6/deployments?projectId=&limit=100&since={24h ago}`):

| Capability | Vercel source | Normalized event(s) |
|---|---|---|
| `custom` | deployments array length | `{ metricType: "custom", key: "deployments_24h", value: N }` |
| `error_metrics` | `readyState/state` in (`ERROR`, `CANCELED`) | `{ metricType: "error_metrics", key: "failed_deployments_24h", value: N }` |
| `custom` | state `READY` | `{ metricType: "custom", key: "ready_deployments_24h", value: N }` |
| `custom` | state in (`BUILDING`, `QUEUED`, `INITIALIZING`) | `{ metricType: "custom", key: "active_deployments", value: N }` |

**Known limitations:**
- 100-deployment page: counts undercount beyond 100 deployments/24h.
- `CANCELED` counts as failed (deliberate: a cancelled deploy still means the
  change didn't ship; disputable, documented here).
- `since` is evaluated server-side per Vercel's semantics; clock skew is not a
  factor (unlike webhook ingest).

## 6. Verdict summary (for the keep / caveat / pull decision)

| Connector | Read-only achievable? | Recommendation |
|---|---|---|
| Sentry | Yes (`project:read` + `event:read`) | Keep, no caveat beyond stating minimum scopes |
| GitHub Actions | Yes (fine-grained Actions+Metadata read) | Keep, refuse classic `repo`-scoped PATs in copy |
| PostHog | Partial (scoped key can't write, but arbitrary HogQL reads) | Keep **with caveat** + require `query:read`-scoped key in form copy |
| Better Stack | No (team read+write, no scopes) | Keep **with caveat**; fix form hint (no "read-only token" exists) |
| Vercel | No (read+write incl. env secrets; health check forces Team/Full scope) | Keep **with caveat**, or pull until health check is repointed at the deployments endpoint so project-scoped tokens pass |

## 7. Open items surfaced by this spec

- [ ] Decide keep / caveat / pull for PostHog, Better Stack, Vercel per §6
- [ ] If Vercel stays: repoint health check from `GET /v2/user` to the
  deployments endpoint so project-scoped tokens work, then recommend
  project-scoped tokens in copy
- [ ] If PostHog stays: form copy must require a `query:read`-scoped key and
  state the key can read all project event/person data
- [ ] Correct the Better Stack "read-only token" hint everywhere it appears
- [ ] GitHub Actions `failed_workflow_runs_24h` undercount past 100 runs/day —
  page through or document
- [ ] Sentry `event:read` scope requirement for the stats endpoint to confirm
  against a live org (health check passes on `project:read` alone; first poll
  is the real test)
