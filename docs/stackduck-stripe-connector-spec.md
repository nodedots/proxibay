# Proxibay — Stripe Connector Spec

Follows on from the Alerting Model. The Firebase Connector Spec explicitly excluded `revenue_metrics` ("Not covered by the Firebase connector — revenue requires a Stripe or equivalent connector"). This document fills that gap for any of the founder's projects that take payments (Swaptrick, Loancue, potentially Way2Sign/Pharmsend later).

## 1. Why Stripe Second

Revenue is one of the four core metric types from the original project doc, and it's the one capability the primary Firebase connector structurally cannot provide. Any project with payments is only half-monitored without this.

## 2. Auth / Connection Setup

- **authType:** `oauth` (Stripe Connect) or `api_key` (restricted API key) — restricted key is simpler to implement first and sufficient for read-only reporting; OAuth/Connect only matters if Proxibay ever needs to act on behalf of multiple *external* Stripe accounts (i.e., once this generalizes beyond the founder's own accounts)
- **v1 decision:** start with a **restricted API key** (read-only scopes: `charges:read`, `balance:read`, `payouts:read`) — dev generates this themselves in the Stripe dashboard and pastes it in, no OAuth flow to build yet
- **healthCheck:** a lightweight call like `stripe.balance.retrieve()` to confirm the key is valid and scoped correctly

## 3. Fetch Mode

**Both**, unlike Firebase:

- **Poll** — scheduled Function calls Stripe's API for aggregate figures (useful for `mrr`-style rollups that are easier to compute from a full balance/charge history than to catch event-by-event)
- **Push** — Stripe supports native webhooks (`charge.succeeded`, `charge.failed`, `payout.paid`, etc.) which map cleanly to real-time events; this connector should register a Stripe webhook endpoint at connect-time and receive those directly, which is more accurate than polling for per-transaction events

**v1 scope decision:** implement **push via Stripe webhooks** as the primary path (more accurate, lower latency, and Stripe already does the hard work of delivering events reliably); polling is only used for periodic reconciliation (e.g. nightly job to catch anything a missed webhook delivery would have dropped), not as the main data path.

## 4. Capabilities → Stripe Events → Normalized Events

| Capability | Stripe Source | Normalized Event(s) |
|---|---|---|
| `revenue_metrics` | Webhook: `charge.succeeded` | `{ metricType: "revenue_metrics", key: "transaction_volume", value: amount }` |
| `revenue_metrics` | Webhook: `charge.failed` | `{ metricType: "revenue_metrics", key: "failed_payments", value: 1 }` (count, not amount) |
| `revenue_metrics` | Nightly reconciliation: `stripe.balance.retrieve()` + recent charges list | `{ metricType: "revenue_metrics", key: "mrr", value: computed }` — MRR isn't a native Stripe field for one-off/BNPL-style charges (relevant for Loancue's model), so this needs project-side logic, not a direct passthrough |

**Note on Loancue specifically:** since it's BNPL/pay-later, "revenue" isn't a single clean `charge.succeeded` event — repayment schedules complicate what counts as realized revenue vs. outstanding. This connector spec covers straightforward charge-based revenue (Swaptrick-style); Loancue's revenue model likely needs a `custom` metric type with project-specific logic rather than being force-fit into this connector's default `mrr`/`transaction_volume` keys.

## 5. Webhook Endpoint Handling

- Proxibay exposes one ingest endpoint per connector instance (same pattern as the Generic Webhook connector), but this one specifically verifies Stripe's webhook signature (`Stripe-Signature` header) before accepting a payload — never trust an unverified POST claiming to be Stripe
- On signature failure: reject with 400, log for the dev to notice (surfaced as a connector health issue, not a silent drop)

## 6. Known Limitations (v1)

- **MRR computation is approximate**, not a true subscription-MRR calculation, since not all of the founder's projects use Stripe Subscriptions — some are one-off/BNPL-style charges (see Loancue note above)
- **No refund/dispute handling yet** — `charge.refunded` and dispute-related events aren't mapped in v1; revenue numbers won't reflect refunds until this is added
- **Reconciliation job is nightly, not real-time** — a missed webhook (rare, but possible) means up to ~24h lag before that data point is caught, which is an acceptable trade-off at dogfood scale

## 7. Open Items Surfaced by This Spec

- [ ] Decide how Loancue's BNPL repayment model maps into `custom` metric events (what counts as "revenue" at charge time vs. at full repayment)
- [ ] Add refund/dispute event handling (`charge.refunded`, `charge.dispute.created`) once basic charge tracking is validated
- [ ] Decide whether OAuth/Stripe Connect is ever needed, or whether restricted API keys remain sufficient (only becomes relevant if Proxibay generalizes to external devs with their own Stripe accounts)
