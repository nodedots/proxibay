# Stackduck

![Stackduck](public/logo-wordmark.svg#gh-light-mode-only)
![Stackduck](public/logo-wordmark-dark.svg#gh-dark-mode-only)

**Stop building dashboards. Plug your projects in.**

Stackduck is portfolio monitoring for developers running multiple projects — part
Datadog for indie devs, part Backstage for solo founders. Register a project once,
attach a connector, and see health, users, and revenue across everything you run.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4
- **Backend/API:** Firebase Cloud Functions (TypeScript, Express)
- **Data:** Firestore (catalog + bucketed time-series metrics)
- **Auth:** Firebase Auth (email/password, Google, GitHub)
- **Hosting:** Firebase Hosting (a Vite build also deploys anywhere static)

## Quickstart

```bash
npm install
cp .env.example .env   # fill in your Firebase web config
npm run dev
```

The app reads projects and metric buckets directly from Firestore when the
Functions API is unreachable, so Auth + Firestore alone is enough to explore
the UI. Deploying `functions/` (requires Blaze for Secret Manager + Scheduler)
unlocks connector setup, signed ingest, polling, and reconciliation.

```bash
firebase deploy --only firestore:rules   # always safe
firebase deploy --only functions,hosting # needs Blaze
```

Key docs in-repo: `API_CONTRACT.md` (Cloud Functions surface), `DECISIONS.md`
(decision log), `PROJECT_DETAIL_SPEC.md`, and `proxybay docs/` (specs).

## Contributing

Issues and pull requests are welcome at
[github.com/nodedots/stackduck](https://github.com/nodedots/stackduck). See
`/docs` in the app (self-hosting + connector walkthroughs) and
[Support](https://github.com/nodedots/stackduck/issues) for help.
