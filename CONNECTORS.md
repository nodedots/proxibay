# Connector reference

Connectors attach to a project and write normalized metrics into its existing charts and alert system. Provider credentials are sent to the authenticated Functions API, stored as secrets, and never saved in the connector document. Poll-based integrations run every 30 minutes. Provider permissions should be limited to read access.

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
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Provider values are `sentry`, `github-actions`, `posthog`, `betterstack`, and `vercel`. The request fields correspond to the setup table, with `token` required for all five. Successful responses include the connector and inline health check. A failed health check returns `422` with the saved connector marked `error`; correct the credentials and submit the form again to replace the failed connector credentials.

Manual health checks use `POST /v1/projects/:projectId/connectors/:connectorId/healthcheck`. Metrics are stored in Stackduck's existing daily metric buckets and can be used in alerts.
