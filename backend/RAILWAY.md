# Railway hosting — stackduck-api + TimescaleDB Postgres

Railway's default Postgres template does **not** include TimescaleDB
([Railway docs: "we do not plan to add extensions… for the most popular
extensions, like PostGIS and Timescale, there are several options in the
template marketplace"](https://docs.railway.com/guides/postgresql) —
use the **TimescaleDB template**, not the plain Postgres one).

## 1. Database: TimescaleDB template (not plain Postgres)

1. Railway project → **New → Database → TimescaleDB** (marketplace template;
   unmanaged, you own its config — see Railway's warning).
2. Open the TimescaleDB service → **Variables** → copy `DATABASE_URL`
   (Railway injects `DATABASE_URL`, `PGHOST`, `PGUSER`, etc. automatically).
3. Verify the extension exists before pointing the API at it:
   `SELECT * FROM pg_available_extensions WHERE name = 'timescaledb';`
   must return a row. If it doesn't, that service is plain Postgres —
   do not proceed; re-provision from the TimescaleDB template.
4. The API's `TimescaleSetupService` runs `CREATE EXTENSION IF NOT EXISTS
   timescaledb` + `create_hypertable('metric_points', …)` on boot, so no
   manual DDL is needed once the template is correct.

## 2. API service

1. **New → GitHub Repo** (or Empty Service + `railway up`), root directory
   `backend/`. Build: `npm install && npm run build`. Start: `npm run start:prod`.
   Add `backend/railway.json` (nixpacks) if the UI asks for explicit commands.
2. **Variables** (all in Railway → API service → Variables; nothing hardcoded,
   nothing committed — `.env` is gitignored and `.env.example` is the schema):
   - `DATABASE_URL` — reference the TimescaleDB service (`${{TimescaleDB.DATABASE_URL}}`)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — generate per environment:
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `CREDENTIALS_ENCRYPTION_KEY` — 32 bytes base64:
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `RESEND_API_KEY` + `ALERT_FROM_EMAIL` — Resend (see below)
   - `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` — Phase 3 prep values
   - `PUBLIC_APP_URL` — staging frontend origin (NOT the live app until Phase 4)
   - `REQUIRE_TIMESCALE=true` — fail fast on Railway if the extension is missing
     (local dev keeps `false` for plain-Postgres fallback)
3. Generate a domain → note the `https://…up.railway.app` URL as the
   **staging API base** for the OAuth callback setup (step 5).

## 3. Email: Resend

1. Resend dashboard → **API Keys** → create key → set `RESEND_API_KEY`.
2. **Domains** → verify the sending domain → set `ALERT_FROM_EMAIL`
   (e.g. `Stackduck <alerts@yourdomain>` — must be the verified domain;
   `onboarding@resend.dev` only delivers to the account owner).
3. Wiring: `AlertsService` constructs `new Resend(apiKey)` and sends via
   `resend.emails.send({ from, to: [rule.channelTarget], subject, html })`
   on the Alerting Model's email channel. **Without the key it logs instead
   of sending** (`EMAIL (unsent — no RESEND_API_KEY)`) so local dev never
   silently pretends to notify.
4. End-to-end test (after Railway deploy): create an alert rule with
   `channel: email`, trip it with a test event, confirm the email arrives,
   then confirm cooldown suppresses the re-fire. Do not mark email "done"
   on a compile check alone.

## 4. Local shakedown (before touching Railway/production)

Docker Desktop must be **running** (daemon unreachable = `docker ps` fails;
start Docker Desktop and retry — no code change fixes that).

```powershell
docker compose -f backend/docker-compose.yml up -d
cd backend
npm run start:dev   # :3001, /v1/health
```

Walkthrough: register → project → generic-webhook connector → signed POST
to `/v1/ingest/:id` → row in `metric_points` → `GET /v1/projects/:id/metrics`
daily rollup via `time_bucket()` → alert rule tripped → 5-min job fires →
cooldown blocks re-fire. Report anything off — don't silently patch.

## 5. OAuth callbacks (staging only — live stays on Firebase)

- Google Cloud Console → Credentials → OAuth client → add
  `https://<staging-api>/v1/auth/google/callback`
- GitHub → OAuth App settings → Authorization callback URL →
  `https://<staging-api>/v1/auth/github/callback`
- Keep the **live** app on Firebase handlers until Phase 3/4. Staging-only.
