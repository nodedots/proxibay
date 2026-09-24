# Contributing to Stackduck

Thanks for helping improve Stackduck. Bug reports, thoughtful feature proposals, documentation fixes, and pull requests are welcome.

## Before you start

- Search existing [issues](https://github.com/nodedots/stackduck/issues) and pull requests so work is not duplicated.
- For substantial changes, open an issue first to discuss the problem and intended approach.
- Keep pull requests focused. Include screenshots for user-facing changes and update documentation when behavior or setup changes.

## Local setup

Stackduck uses Node.js 20 or newer. From the repository root:

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and fill in the Firebase web-app values for the Firebase project you use locally. Never commit `.env` or credentials.
3. Start the frontend with `npm run dev`.

The frontend can be explored without connecting project data. Connector and authenticated flows require a configured Firebase project and the Functions API. For local backend work, install dependencies in `functions/` with `npm ci`, then use the Firebase emulators configured in `firebase.json` (`npm run serve` from `functions/`). Configure a Firebase project/CLI locally as needed; do not commit local credentials or project secrets.

## Checks

Run these from the repository root before opening a pull request:

```sh
npm run lint
npm run build
npm --prefix functions run build
```

The functions build is especially relevant when changing `functions/`. This repository does not currently define an automated test script, so also exercise the affected flow manually and describe what you checked in the pull request.

## Code and security

- Follow the existing TypeScript, React, and styling patterns; avoid unrelated formatting or refactors.
- Keep UI responsive and accessible, including keyboard interaction and readable contrast.
- Never include passwords, API keys, Firebase service-account files, auth tokens, webhook secrets, or private user data in commits, issues, logs, or screenshots.
- Do not weaken authentication, authorization, input validation, or secret handling to make a local flow work.

## Open an issue or pull request

Use the repository's [bug report](https://github.com/nodedots/stackduck/issues/new?template=bug_report.yml) or [feature request](https://github.com/nodedots/stackduck/issues/new?template=feature_request.yml) form. Security-sensitive vulnerabilities should not be posted publicly; contact the maintainers privately through the repository's available security contact instead.

Pull requests should explain the user impact, summarize the implementation, list checks run (or why they could not be run), and include before/after screenshots for visual changes.
