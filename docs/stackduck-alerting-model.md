# Proxibay — Alerting Model

Follows on from the "Add Project" Flow. This resolves the `AlertRule` skeleton left open in the Data Model & Schema Spec: how rules are defined, evaluated, and delivered.

## 1. Design Principle

Alerting is the part of the "Datadog for indie devs" half of the positioning that actually earns its keep — a portfolio home view with status colors is only useful if something proactively tells you when a color changes, rather than requiring you to keep checking. But for a solo-founder-scale tool, alerting has to stay simple: no complex query language, no multi-condition rule chains at v1.

## 2. Rule Shape (refined from the data model spec)

```ts
interface AlertRule {
  id: string;
  projectId: string;
  metricType: MetricType;
  key: string;                     // e.g. "error_count", "signups"
  condition: "above" | "below";
  threshold: number;
  windowMinutes: number;           // e.g. evaluate over the last 15/60 min
  channel: "email" | "webhook";
  channelTarget: string;           // email address or webhook URL
  status: "active" | "muted";
  lastTriggeredAt?: Timestamp;
  createdAt: Timestamp;
}
```

Added since the original skeleton: `windowMinutes` (a threshold without a time window is ambiguous — "error_count above 10" means nothing without knowing over what period) and `lastTriggeredAt` (needed for cooldown logic, see §4).

## 3. Evaluation Model

**Scheduled, not real-time-on-ingest.** A single Cloud Function runs on a schedule (e.g. every 5 minutes), and for each active `AlertRule`:

1. Reads the relevant `MetricBucket` document(s) covering `windowMinutes`
2. Computes the aggregate needed (sum for counts like `error_count`, latest value for gauges like `uptime status`)
3. Compares against `threshold` per `condition`
4. If triggered and not in cooldown, fires the notification and updates `lastTriggeredAt`

This is simpler and cheaper than evaluating on every single ingest event, and fits the bucketed-metrics storage model already in place — no separate real-time pipeline needed.

**Trade-off:** detection latency is bounded by the schedule interval (up to ~5 min lag), not instant. Acceptable for a solo-founder tool; would need revisiting if this were sold as a true real-time ops product later.

## 4. Cooldown / Notification Fatigue

- After a rule triggers, it won't re-fire for the same condition for a configurable cooldown period (e.g. 30–60 min), even if the underlying metric stays above threshold
- Rule automatically "resolves" (silently, no separate notification at v1) once a subsequent evaluation finds the condition no longer met
- `status: "muted"` lets a dev manually silence a noisy rule without deleting it

## 5. Delivery Channels (v1 scope)

- **Email** — simplest, no infra beyond an email-sending service. **Implemented via Resend** ([D33](../DECISIONS.md)) on the new backend: `RESEND_API_KEY` + `ALERT_FROM_EMAIL` send the alert directly from the evaluation job. A delivery failure throws, so a rule is never recorded as fired when nothing was sent, and without a key the service logs `EMAIL (unsent — no RESEND_API_KEY)` instead of pretending to notify
- **Webhook** — POST a JSON payload to a URL the dev controls; this is what lets a dev route alerts into Slack/Discord/etc. themselves without Proxibay needing native integrations for each

**Explicitly deferred:** native Slack/Discord/SMS integrations — the generic webhook covers this need without Proxibay maintaining N integrations at dogfood stage.

## 6. Where Alerts Surface in the Product

- Portfolio home view: a project's status color reflects any currently-triggered (non-resolved) alert, not just connector health
- Project detail view: a feed of recent alert firings for that project (trigger time, metric, value vs. threshold)
- No separate cross-project "alerts inbox" at v1 — deferred, since dogfood-scale usage (one dev, ~15 projects) doesn't yet need a dedicated triage view; revisit if/when this generalizes to other devs with larger portfolios

## 7. Open Items Surfaced by This Model

- [ ] Decide default `windowMinutes` and cooldown values per metric type (error-rate spikes probably want a shorter window than, say, weekly signup trend alerts)
- [ ] Decide whether uptime/`status` metric alerts need different logic (edge-triggered on state change) vs. threshold-based metrics (level-triggered) — these are subtly different alerting patterns
- [ ] Revisit whether a cross-project alerts inbox is needed once real usage across the founder's own ~15 projects shows whether per-project feeds are enough
