# Stackduck backend — NestJS API + PostgreSQL/TimescaleDB (Phase 1)

Self-managed replacement for Firebase (Firestore + Firebase Auth + Cloud Functions).
The frontend stays untouched until Phase 3; this builds the full API first.

## Layout

- `src/entities/` — `User`, `Project`, `Connector`, `MetricPoint` (Timescale hypertable), `AlertRule`
- `src/auth/` — passport-local (bcrypt) + google-oauth20 + github2, JWT access + refresh
- `src/connectors/` — ported connector providers + registry + CRUD/healthcheck/rotate controllers
- `src/metrics/` — point writer + `time_bucket()` reader (falls back to `date_trunc()` without Timescale)
- `src/ingest/` — generic-webhook HMAC guard + Stripe signature guard, throttled controllers
- `src/alerts/` — CRUD + 5-minute evaluation service (sum for counts, latest for gauges, cooldown)
- `src/jobs/` — `@nestjs/schedule` polling (30 min providers, 24 h Stripe) + alert evaluation (5 min)
- `scripts/firestore-migrate.ts` — Phase 2 one-time Firestore → staging Postgres migration

## Credential storage (Step 6 — decided)

**Encrypted columns in Postgres** (AES-256-GCM, app-level, per your choice).
Set `CREDENTIALS_ENCRYPTION_KEY` to 32 random bytes base64-encoded:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

No Secret Manager, no GCP dependency. Secrets are never returned by any endpoint
(controllers strip `credentialsEnc`/`previousCredentialsEnc`).

## Local dev

```powershell
# 1. Start Postgres + TimescaleDB (Docker Desktop must be running)
docker compose -f backend/docker-compose.yml up -d

# 2. Install + configure
cd backend
npm install
copy .env.example .env   # then set CREDENTIALS_ENCRYPTION_KEY + JWT secrets

# 3. Run
npm run start:dev         # API on :3001, /v1/health
```

Without TimescaleDB the API still boots (plain table + `date_trunc()` fallback);
set `REQUIRE_TIMESCALE=true` to fail fast instead. Hosting is decided: Railway
using their **TimescaleDB** template — see [RAILWAY.md](RAILWAY.md).

Alert email is delivered by Resend: set `RESEND_API_KEY` and `ALERT_FROM_EMAIL`
to enable it. With the key absent the evaluation job logs
`EMAIL (unsent — no RESEND_API_KEY)` rather than pretending to notify, so a local
run is never mistaken for a delivered alert. `smoke:email` performs the real send.

## Verification (no Docker on this machine — Docker Desktop daemon is down)

- `tsc --noEmit` passes (0 errors).
- `scripts/unit-check.cjs` passes 8/8 (Stripe/webhook signatures, AES round-trip + tamper, cents→major).
- DB-backed boot (`synchronize` + hypertable creation) and the migration script
  are written but **not yet run** — they need a live Postgres. Next step on a
  machine with Docker running: `docker compose -f backend/docker-compose.yml up -d`
  then `npm run start:dev`, then exercise register → project → connector →
  ingest → metrics → alerts.

## Smoke tests (run these, don't trust a compile)

| Command | What it proves |
| --- | --- |
| `npm run smoke:unit` | Signature + encryption vectors (no DB/network needed) |
| `npm run smoke:local` | register → project → webhook connector → signed ingest → metrics read-back |
| `npm run smoke:alerts` | alert rule → evaluation → webhook delivery → cooldown blocks re-fire |
| `npm run smoke:email` | **real** Resend send (needs `RESEND_API_KEY` + `ALERT_TO`) |

`smoke:alerts` needs `PROJECT_ID` + `TOKEN` from `smoke:local`'s output, and the
API must run with `JOBS_TRIGGER_SECRET` set — that enables
`POST /v1/internal/jobs/{evaluate-alerts,poll-providers,reconcile-stripe}`
so the 5-minute job can be triggered on demand instead of waited on. The routes
404 when `JOBS_TRIGGER_SECRET` is empty, so production stays unaffected.

## Hosting — Railway

See [RAILWAY.md](RAILWAY.md). Key point: use Railway's **TimescaleDB template**
("[we do not plan to add extensions to the PostgreSQL templates… for the most
popular extensions, like PostGIS and Timescale, there are several options in the
template marketplace](https://docs.railway.com/guides/postgresql)") — the plain
Postgres template has no TimescaleDB. Set `REQUIRE_TIMESCALE=true` there so a
wrong database fails fast instead of silently degrading to `date_trunc()`.


## API surface (mirrors API_CONTRACT.md, JWT instead of Firebase ID tokens)

- `POST /v1/auth/register|login|refresh|logout`, `GET /v1/auth/me`
- `GET /v1/auth/google|github` → callbacks (update OAuth app configs in Phase 3)
- `POST/GET/PATCH/DELETE /v1/projects…`
- `POST /v1/projects/:id/connectors/:provider` + `:id/healthcheck` + `:id/rotate-secret`
- `GET /v1/projects/:id/metrics?metricType=&key=[&from=&to=]` (90d max)
- `POST/GET/PATCH/DELETE /v1/projects/:id/alerts…` (CRUD; evaluated every 5 min)
- `POST /v1/ingest/:connectorId` (public, HMAC guard, 60/min throttle)
- `POST /v1/stripe/:connectorId` (public, Stripe guard, 60/min throttle)
- `POST /v1/internal/jobs/{evaluate-alerts,poll-providers,reconcile-stripe}`
  (only when `JOBS_TRIGGER_SECRET` is set; 404s otherwise)

## Phase 2 migration notes

`scripts/firestore-migrate.ts` reads all Firestore collections into staging
Postgres, verifies counts, and spot-checks 5 projects. Two deliberate caveats:

1. **Secrets don't migrate** — Secret Manager ciphertext can't transfer without
   the original IAM; connector rows are created in `error` with a placeholder
   and owners reconnect (re-enter credentials) afterward.
2. **Metric buckets un-bucket** — D2 daily documents explode back into individual
   `metric_points` rows (the whole point of the hypertable improvement).
