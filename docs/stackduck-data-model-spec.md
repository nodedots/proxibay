# Proxibay — Data Model & Schema Spec

Follows on from the Project Document. This defines the concrete shapes for catalog entities, the normalized event schema, and the Firestore bucketing strategy for time-series metrics.

## 1. Catalog Collections (Firestore)

### `projects/{projectId}`

```ts
interface Project {
  id: string;
  ownerId: string;              // uid of the account that registered it
  name: string;                 // required — only mandatory field
  description?: string;
  stackTags?: string[];         // e.g. ["firebase", "react", "typescript"]
  repoUrl?: string;
  liveUrl?: string;
  environment?: "production" | "staging" | "development";
  status: "active" | "paused" | "archived";
  notes?: string;                // free-text, docs links etc.
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Everything but `name`, `ownerId`, `status` (defaults to `active`) is optional — matches the "lazy catalog" decision from the project doc.

### `projects/{projectId}/connectors/{connectorId}`

```ts
interface ConnectorInstance {
  id: string;
  type: "firebase" | "generic-webhook" | "supabase";  // extendable
  authType: "api_key" | "oauth" | "service_account" | "none";
  fetchMode: "poll" | "push" | "both";
  capabilities: MetricType[];        // what this instance actually reports
  credentialsRef: string;             // pointer to secret storage, never raw secrets in Firestore
  status: "connected" | "error" | "pending";
  lastHealthCheck?: Timestamp;
  lastFetchedAt?: Timestamp;          // for poll-mode connectors
  createdAt: Timestamp;
}
```

Credentials themselves live outside Firestore proper (e.g. Secret Manager or Cloud Functions config) — Firestore only holds a reference, never the raw key/token.

## 2. Normalized Event Schema

Every connector — regardless of source — outputs events shaped like this before they're written anywhere:

```ts
type MetricType = "user_metrics" | "error_metrics" | "revenue_metrics" | "uptime_metrics" | "custom";

interface NormalizedEvent {
  projectId: string;
  connectorId: string;
  metricType: MetricType;
  key: string;            // e.g. "signups", "active_users", "error_rate", "mrr"
  value: number;
  timestamp: Timestamp;
  metadata?: Record<string, string | number | boolean>;
}
```

`key` is what lets one `metricType` hold multiple related numbers (e.g. `user_metrics` might produce both a `signups` event and an `active_users` event) without needing a new top-level type for each.

## 3. Time-Series Storage (Bucketed Documents)

> **Partially superseded (2026-09-25, [D30](../DECISIONS.md)).** On the new
> NestJS backend this section's daily-bucket documents are gone: individual points
> go into a TimescaleDB hypertable (`metric_points`) and rollups are computed on
> read with `time_bucket()`. That removes the `projectId_metricType_key_date`
> document-ID scheme below, the per-bucket point cap, and the read-append-write
> transaction per incoming point; retention becomes a `time_bucket` retention
> policy rather than a cleanup job. The section is retained because the live
> Firebase backend still stores buckets this way until the cutover.

Raw `NormalizedEvent`s are not stored one-per-document. They're aggregated into daily buckets:

### `metrics/{projectId}_{metricType}_{key}_{YYYY-MM-DD}`

```ts
interface MetricBucket {
  projectId: string;
  metricType: MetricType;
  key: string;
  date: string;              // "2026-09-20"
  points: { time: Timestamp; value: number }[];   // intraday points for this key/day
  dailyAggregate?: {
    sum?: number;
    avg?: number;
    max?: number;
    min?: number;
    last?: number;           // useful for gauge-like metrics (e.g. current uptime status)
  };
  updatedAt: Timestamp;
}
```

Writing a new data point means reading that day's bucket doc, appending to `points`, recomputing `dailyAggregate`, and writing back — one document read/write per incoming point rather than one per historical point, which keeps read costs bounded when rendering a dashboard (fetch N day-buckets instead of N × intraday-points documents).

**Retention consideration (not yet decided):** whether to downsample or drop intraday `points` after some window (e.g. keep daily aggregates forever, but only keep raw intraday points for the last 30 days) — flagged as an open question, not resolved here.

## 4. Alerts (skeleton — not yet fleshed out)

```ts
interface AlertRule {
  id: string;
  projectId: string;
  metricType: MetricType;
  key: string;
  condition: "above" | "below";
  threshold: number;
  channel: "email" | "webhook";   // notification target, tbd in detail
  status: "active" | "muted";
}
```

This is a placeholder shape — the actual evaluation logic, notification channels, and rule UI are still open per the project doc's next-steps list.

## 5. Open Items Surfaced by This Spec

- [ ] Decide intraday-point retention/downsampling policy for `MetricBucket.points`
- [ ] Decide where connector credentials actually live (Secret Manager vs. Cloud Functions env config) and how `credentialsRef` resolves to them
- [ ] Flesh out `AlertRule` evaluation (who runs it — a scheduled Function checking recent buckets? real-time on ingest?)
