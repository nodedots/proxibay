# Stackduck

![Stackduck](public/logo-wordmark.svg#gh-light-mode-only)
![Stackduck](public/logo-wordmark-dark.svg#gh-dark-mode-only)

**Stop building dashboards. Plug your projects in.**

Stackduck is an open-source monitoring portfolio for developers who run more than one project. Register each project once, connect its data sources, and see health, users, errors, and revenue together instead of maintaining another dashboard for every app.

## What you can do

- Keep a catalog of projects with stack, repository, environment, and notes.
- Connect supported data sources and ingest metrics from other backends with signed webhooks.
- Monitor Sentry errors, GitHub Actions runs, PostHog usage, Better Stack uptime, and Vercel deployments.
- Compare project health, activity, users, and revenue in a portfolio view.
- Save threshold alert rules; evaluation, cooldown, and email/webhook delivery all run in the new backend.
- Sign in with email/password, Google, or GitHub. The live app still uses Firebase Auth until the frontend cutover.

Connector availability depends on the integration; see the app's connector catalog for current status.

## Stack

This repository currently carries two backends while the migration completes.

**Live today** — the frontend still talks to this one:

- **Frontend:** React, TypeScript, Vite, and Tailwind CSS v4
- **Backend/API:** Firebase Cloud Functions with TypeScript and Express
- **Data:** Firestore for the project catalog and time-series metric buckets
- **Authentication:** Firebase Auth
- **Hosting:** Firebase Hosting, or any static host that can serve the Vite build

**New backend** — built, typechecked, and documented in [`backend/`](backend/), not yet cut over:

- **Backend/API:** NestJS with TypeScript
- **Data:** PostgreSQL with the TimescaleDB extension. Metric points are written to a hypertable and rollups use `time_bucket()`, replacing the Firestore daily-bucket documents
- **Authentication:** NestJS passport strategies (email/password, Google, GitHub) issuing short-lived JWT access tokens plus rotating refresh tokens
- **Connector credentials:** encrypted at the application layer (AES-256-GCM) in Postgres columns
- **Hosting:** Railway, using their TimescaleDB template — Railway's plain Postgres templates ship no extensions
- **Email:** Resend, for alert delivery

The frontend is deliberately unchanged by the pivot; only its data-fetching layer moves from Firebase SDK calls to REST calls.

## Run locally

Requirements: Node.js 20 or newer, npm, and a Firebase project for authenticated and data-connected flows.

```sh
npm ci
```

Copy `.env.example` to `.env`, then fill in the Firebase web-app configuration for your own project. Start the frontend:

```sh
npm run dev
```

The UI can be explored without deploying Cloud Functions. Authentication and project data require Firebase Auth and Firestore configuration; connector setup, signed ingest, polling, and reconciliation require the backend functions and the relevant provider credentials.

For local backend development, install function dependencies and start the configured emulators:

```sh
cd functions
npm ci
npm run serve
```

Configure Firebase CLI and emulator project settings for your environment. Never commit `.env`, service-account files, provider credentials, or webhook signing secrets.

### The new backend

The NestJS + Postgres/TimescaleDB API lives in `backend/` and runs independently of Firebase. It needs a Postgres instance with the TimescaleDB extension:

```sh
docker compose -f backend/docker-compose.yml up -d   # local TimescaleDB (Docker must be running)
cd backend
npm ci
cp .env.example .env                                  # then set CREDENTIALS_ENCRYPTION_KEY + JWT secrets
npm run start:dev                                     # API on http://localhost:3001, see /v1/health
```

`CREDENTIALS_ENCRYPTION_KEY` must be 32 random bytes, base64-encoded:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Without TimescaleDB the API still boots — rollups fall back to `date_trunc()` — but set `REQUIRE_TIMESCALE=true` anywhere real so a plain-Postgres database can't quietly pass as healthy. Full details, including the deploy checklist, are in [backend/README.md](backend/README.md) and [backend/RAILWAY.md](backend/RAILWAY.md).

Run the checks that don't need a database:

```sh
cd backend
npm run smoke:unit     # signature + credential-encryption vectors
```

With the database and API running, these exercise the real flows end to end:

```sh
npm run smoke:local    # register → project → webhook connector → signed ingest → metric read-back
npm run smoke:alerts   # alert rule → evaluation → webhook delivery → cooldown blocks a re-fire
npm run smoke:email    # real Resend send (needs RESEND_API_KEY and ALERT_TO)
```

## Build and deploy

From the repository root, verify the frontend with:

```sh
npm run lint
npm run build
npm --prefix functions run build
npm --prefix backend run build
```

Deploy only after selecting and configuring your own Firebase project. Hosting and Firestore rules can be deployed independently; Cloud Functions that use Secret Manager or scheduled jobs may require the Firebase Blaze plan and appropriate Google Cloud APIs and permissions.

```sh
firebase deploy --only firestore:rules
firebase deploy --only functions,hosting
```

### Deploying the new backend

Until the cutover, only one backend serves live traffic. The steps for standing up the NestJS API are in [backend/RAILWAY.md](backend/RAILWAY.md): provision the **TimescaleDB** template (not plain Postgres), set the environment variables on the API service, and point a staging domain at it. Keep the live app on Firebase and keep OAuth callbacks on the staging URL until the frontend cutover is deliberate.

## Project documentation

- [Backend API](backend/README.md): the NestJS + PostgreSQL/TimescaleDB service — setup, endpoints, smoke tests
- [Railway deployment](backend/RAILWAY.md): TimescaleDB template, environment variables, OAuth callback setup
- [API contract](API_CONTRACT.md): Cloud Functions endpoints and payloads (historical — predates the pivot)
- [Connector reference](CONNECTORS.md): supported integrations, permissions, and reported metrics
- [Project detail specification](PROJECT_DETAIL_SPEC.md): active project experience
- [Decision log](DECISIONS.md): product and implementation decisions, including the backend pivot
- [Design specifications](docs/): PRD, data model, alerting model, and connector specs
- [Security plan](docs/stackduck-security-plan.md): what has to be owned deliberately now that managed Firebase services are gone
- [Dark mode notes](DARK_MODE.md): theme behavior
- [License](LICENSE)

## Contributing

Stackduck is open source, and contributions are welcome. Read the [contribution guide](CONTRIBUTING.md), [report a bug](https://github.com/nodedots/stackduck/issues/new?template=bug_report.yml), or [request a feature](https://github.com/nodedots/stackduck/issues/new?template=feature_request.yml). Pull requests use the repository checklist. Please do not post credentials or security-sensitive vulnerability details in public issues.
