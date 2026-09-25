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
- Set threshold alerts delivered by email or webhook.
- Use Firebase authentication, including email/password, Google, and GitHub sign-in.

Connector availability depends on the integration; see the app's connector catalog for current status.

## Stack

- **Frontend:** React, TypeScript, Vite, and Tailwind CSS v4
- **Backend/API:** Firebase Cloud Functions with TypeScript and Express
- **Data:** Firestore for the project catalog and time-series metric buckets
- **Authentication:** Firebase Auth
- **Hosting:** Firebase Hosting, or any static host that can serve the Vite build

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

## Build and deploy

From the repository root, verify the frontend with:

```sh
npm run lint
npm run build
npm --prefix functions run build
```

Deploy only after selecting and configuring your own Firebase project. Hosting and Firestore rules can be deployed independently; Cloud Functions that use Secret Manager or scheduled jobs may require the Firebase Blaze plan and appropriate Google Cloud APIs and permissions.

```sh
firebase deploy --only firestore:rules
firebase deploy --only functions,hosting
```

## Project documentation

- [API contract](API_CONTRACT.md): Cloud Functions endpoints and payloads
- [Connector reference](CONNECTORS.md): supported integrations, permissions, and reported metrics
- [Project detail specification](PROJECT_DETAIL_SPEC.md): active project experience
- [Decision log](DECISIONS.md): product and implementation decisions
- [Dark mode notes](DARK_MODE.md): theme behavior
- [License](LICENSE)

## Contributing

Stackduck is open source, and contributions are welcome. Read the [contribution guide](CONTRIBUTING.md), [report a bug](https://github.com/nodedots/stackduck/issues/new?template=bug_report.yml), or [request a feature](https://github.com/nodedots/stackduck/issues/new?template=feature_request.yml). Pull requests use the repository checklist. Please do not post credentials or security-sensitive vulnerability details in public issues.
