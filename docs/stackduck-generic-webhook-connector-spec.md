# Proxibay — Generic Webhook Connector Spec

Follows on from the Portfolio Home View spec. The Add Project Flow doc described this connector conceptually ("Proxibay generates a unique ingest URL + a signing secret... UI shows a minimal code snippet"). This gives it the full spec Firebase and Stripe already have — it matters more than either of them long-term, since it's what makes the "just plug your project in" promise true for any backend, not just the ones Proxibay ships named connectors for.

## 1. Why This Connector Matters Most

Firebase and Stripe connectors only cover devs on those specific platforms. The generic webhook is what lets *any* backend — a custom Express server, a Django app, a Rails app, anything — participate in Proxibay without Proxibay needing to know anything about it in advance. This is the connector that makes the platform actually generic rather than "Firebase + Stripe monitoring with extra steps."

## 2. Auth / Connection Setup

- **authType:** `none` in the sense that there's no third-party credential to collect — but the connection isn't unauthenticated. Instead:
  - On creation, Proxibay generates a unique **ingest URL** (e.g. `https://ingest.proxibay.app/v1/{connectorId}`) and a **signing secret**
  - The dev's own backend is responsible for signing each outgoing request with that secret (HMAC-SHA256 over the raw request body, sent as a header, e.g. `X-Proxibay-Signature`)
  - Proxibay verifies the signature on receipt; unsigned or mismatched-signature requests are rejected, same pattern as the Stripe connector's signature verification
- **healthCheck:** not proactively callable (Proxibay can't ping a webhook it doesn't control) — connector status starts at `"pending"` and flips to `"connected"` on first successfully-verified event, matching the behavior already described in the Add Project Flow

## 3. Fetch Mode

**Push only.** This connector has no poll capability by definition — it exists specifically for backends Proxibay has no other way to reach.

## 4. Payload Contract

The dev's backend POSTs directly in the `NormalizedEvent` shape (from the Data Model & Schema Spec), with `projectId` and `connectorId` pre-filled by Proxibay's ingest endpoint based on the URL, so the dev doesn't need to know or send those:

```json
POST https://ingest.proxibay.app/v1/{connectorId}
Headers:
  Content-Type: application/json
  X-Proxibay-Signature: <hmac-sha256 hex digest>

Body:
{
  "metricType": "user_metrics",
  "key": "signups",
  "value": 3,
  "timestamp": "2026-09-20T14:00:00Z",
  "metadata": { "source": "nightly-batch" }
}
```

- `metricType` must be one of the five defined types; unrecognized values are rejected with a 400, not silently coerced into `custom`
- `value` must be numeric
- `timestamp` is optional — if omitted, Proxibay stamps it with receipt time
- Batch submission: the endpoint also accepts an array of event objects in one POST, to avoid forcing a dev to make N requests for N data points from a single batch job

## 5. Minimal Integration Snippet (shown to the dev in-app)

```js
const crypto = require('crypto');

function sendMetric(event) {
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac('sha256', PROXIBAY_SIGNING_SECRET)
    .update(body)
    .digest('hex');

  return fetch(PROXIBAY_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Proxibay-Signature': signature,
    },
    body,
  });
}
```

This is the exact snippet referenced (but not written out) in the Add Project Flow doc's Step 3b.

## 6. Rate Limiting & Abuse Handling

- Since the ingest URL is a public endpoint (secured only by signature, not IP allowlisting at v1), it needs basic rate limiting per `connectorId` — e.g. reject beyond some reasonable ceiling (tbd) per minute, to prevent a misconfigured retry loop on the dev's own side from flooding metric storage
- Signature failures are logged and surfaced on the connector's status (repeated failures could mean the dev regenerated their secret without updating their code, or someone is probing the endpoint)

## 7. Known Limitations (v1)

- **No delivery guarantees on Proxibay's side** — if the dev's own backend fails to send an event (crash, network issue), Proxibay has no way to know data is missing, unlike the Stripe connector's nightly reconciliation backstop. This is an inherent trade-off of push-only, arbitrary-source connectors — worth stating plainly in the docs so devs don't assume Proxibay is polling and self-healing gaps for them.
- **No schema validation beyond type/shape checks** — Proxibay can verify `metricType` is valid and `value` is numeric, but can't validate that a `key` like `"signups"` means what the dev thinks it means. Cross-project consistency here is the dev's responsibility, not something Proxibay enforces.

## 8. Open Items Surfaced by This Spec

- [ ] Decide the actual rate limit ceiling per connector
- [ ] Decide whether to add an optional "expected frequency" setting per generic-webhook connector, so Proxibay could flag "no data received in expected window" as a soft warning (partial mitigation for the no-delivery-guarantee limitation above)
- [ ] Decide signing-secret rotation flow (can a dev regenerate the secret without losing the connector's history?)
