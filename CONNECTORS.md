# Connector reference

Connectors attach to a project and write normalized metrics into its existing charts and alert system. Provider credentials are sent to the authenticated API, encrypted, and never saved in the connector document or returned to the client. Poll-based integrations run every 30 minutes. Provider permissions should be limited to read access.

Credential storage differs between the two backends while the migration completes. The live Firebase backend keeps secrets in Secret Manager and stores only a `credentialsRef` on the connector. The new NestJS backend stores them in an encrypted column (`credentials_enc`, AES-256-GCM, key from `CREDENTIALS_ENCRYPTION_KEY`) — see [D29](DECISIONS.md) — and strips that column from every API response. Because Secret Manager ciphertext can't be decrypted without the original IAM, credentials do not migrate: after the cutover each connector shows a one-time "reconnect" prompt instead of failing silently ([D34](DECISIONS.md)).

## Available connectors

| Connector | Setup fields | Metrics |
| --- | --- | --- |
| Firebase | Service-account JSON | User signups, total users, error count |
| Supabase | Project URL and service-role key | User totals, signups, active users |
| Stripe | Restricted API key; webhook secret is optional | Charges, payouts, failed payments, revenue |
| Generic Webhook | Generated signed-ingest URL and secret | Any supported metric sent by your backend |
| Sentry | Organization slug, project slug, auth token | Received error events in the last 24 hours |
| GitHub Actions | Repository, fine-grained token | Workflow runs, failures, in-progress runs in the last 24 hours |
| PostHog | Project ID, region, personal API key | 30-day active users, events in the last 24 hours |
| Better Stack | Existing monitor URL, Uptime API token | Current availability (up/down) |
| Vercel | Project ID, access token, optional team ID | Recent ready, active, and failed deployments |

New integrations are added from a project's **Data sources** section or during project setup. A provider connection check runs before the connector is marked healthy. A successful connection begins polling on the next scheduled run.

## Token scope guidance

- **Sentry:** create a token with `project:read` for the selected project.
- **GitHub Actions:** use a fine-grained token scoped to the selected repository with Actions read access and repository metadata read access.
- **PostHog:** use a personal API key with `query:read` and read access to the selected project.
- **Better Stack:** use a read-only Uptime API token for the team that owns the monitor.
- **Vercel:** scope an access token to the selected project/team and grant read access only.

Do not paste provider secrets into issues or commit them. Revoke or rotate a token at its provider if it is exposed. Deleting a Stackduck project does not revoke provider tokens; revoke them in the provider account as well.

## API

Token-based connectors use the authenticated endpoint:

```http
POST /v1/projects/:projectId/connectors/:provider
Authorization: Bearer <access token>
Content-Type: application/json
```

The new backend issues its own JWT access tokens (with rotating refresh tokens); the live Firebase backend still expects a Firebase ID token. Both derive the owning account from the token, never from the request body.

Provider values are `sentry`, `github-actions`, `posthog`, `betterstack`, and `vercel`. The request fields correspond to the setup table, with `token` required for all five. Successful responses include the connector and inline health check. A failed health check returns `422` with the saved connector marked `error`; correct the credentials and submit the form again to replace the failed connector credentials.

Manual health checks use `POST /v1/projects/:projectId/connectors/:connectorId/healthcheck`. On the Firebase backend metrics land in daily bucket documents; on the NestJS backend they are individual rows in a TimescaleDB hypertable rolled up on read with `time_bucket()` ([D30](DECISIONS.md)). Either way they feed the same charts and alert rules.
