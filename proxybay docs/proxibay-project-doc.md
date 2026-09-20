# Proxibay — Project Document

**Tagline:** Don't build another SPA dashboard. Just plug your project in.

## 1. Problem

Devs and project owners running more than one product end up with a separate admin panel per project — one dashboard per backend, no unified view of health, users, or revenue. Every new project means building yet another internal dashboard from scratch.

## 2. Positioning

Proxibay is a combination of:

- **Datadog for indie devs** — real-time observability: errors, uptime, usage, revenue, with alerting.
- **Backstage for solo founders** — a catalog/registry of every project you run, with ownership and context, not just live numbers.

The two halves are unified: registering a project in the catalog is also how you attach monitoring to it. There's no separate "add a project" and "add monitoring" step.

## 3. Target User & Rollout

- **Phase 1 (dogfood):** Built and tested against the founder's own portfolio of ~15+ live projects (Stridu, Swaptrick, Accentta, Way2Sign, Pharmsend, Loancue, Learnlytics, and others), which are mostly Firebase-based (React/TypeScript/Vite/Tailwind + Firebase Auth/Firestore/Functions).
- **Phase 2 (generalize):** Open the platform to other devs/founders once the core is validated on real usage.

## 4. Core Concept

Each project is registered once in a **catalog entry**. That entry is both:

1. A **static profile** — name, description, stack tags, repo URL, live URL, environment (prod/staging), status (active/paused/archived), free-text notes/docs links.
2. A **live monitoring surface** — populated automatically once one or more connectors are attached.

Catalog fields are optional and lazy — a project can exist with just a name and a connector. Richer fields get filled in over time rather than gating the live monitoring value behind a form.

## 5. Metric Types (v1 fixed set + escape hatch)

- `user_metrics` — signups, active users, total users
- `error_metrics` — error rate, crash count, failed function invocations
- `revenue_metrics` — transaction volume, MRR, failed payments
- `uptime_metrics` — up/down status, response latency
- `custom` — arbitrary key-value the dev defines themselves

Starting with a fixed enum (plus `custom` as an escape hatch) keeps the UI consistent; can loosen into fully open-ended types later once real usage patterns are clear.

## 6. Connector Architecture

A connector is a plugin that knows how to talk to one kind of backend/service and normalize its data into Proxibay's common event schema.

**Connector contract (conceptual):**

```
interface Connector {
  id: string;                    // e.g. "firebase", "generic-webhook"
  authType: "api_key" | "oauth" | "service_account" | "none";
  capabilities: MetricType[];    // which metric types this connector can produce
  fetchMode: "poll" | "push" | "both";

  connect(credentials): Promise<ConnectionHandle>;
  healthCheck(handle): Promise<"ok" | "error">;
  fetchMetrics(handle, since: Timestamp): Promise<NormalizedEvent[]>; // poll mode
  // push mode: platform exposes an ingest endpoint scoped to the connection
}
```

**Normalized event shape:**

```
{ project_id, metric_type, value, timestamp, metadata }
```

**Fetch modes:**

- **Pull** — for platforms with admin APIs (Firebase, Supabase, Stripe). Platform polls on a schedule (e.g. Cloud Scheduler → Function).
- **Push** — for arbitrary custom backends. Dev's app calls a generic ingest endpoint or uses a lightweight SDK/webhook.

**v1 connectors to ship:**

1. **Firebase** (own stack — first to validate, since it's the founder's actual backend)
2. **Generic webhook/ingest** (covers anything custom)
3. **Supabase** (common among indie devs) — stretch goal for v1, safe to defer

## 7. Data Model (high level)

- **Catalog data** (project metadata, connector configs, user accounts) → **Firestore**. Document-shaped, low-volume, fits naturally.
- **Time-series metrics** → also Firestore, but **bucketed** (e.g. `projectId_metricType_2026-09-20` per-day documents) rather than one document per event, to avoid Firestore's per-read cost blowing up on raw event storage. Seam left open to migrate to a dedicated time-series store (Postgres/TimescaleDB or Supabase) later if usage outgrows this.

## 8. Stack Decisions

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind | Matches founder's existing stack across all his other projects |
| Charts | Recharts / Tremor (tbd) | For metric visualizations |
| Backend/API | Firebase Cloud Functions (TypeScript) | Ingest endpoint, OAuth/API-key setup flows, scheduled polling |
| Catalog + metrics storage | Firestore | Bucketed documents for time-series (see §7) |
| Auth | Firebase Auth | Consistent with rest of portfolio |
| Hosting | Firebase Hosting | Consistent with rest of portfolio |
| Language | TypeScript throughout | Connector contract and normalized event schema benefit strongly from static types — a mistyped field in a connector should fail at compile time, not silently break a chart |

**Known risk to revisit later:** Cloud Functions cold starts / per-invocation pricing could get awkward if polling many projects on tight intervals at scale. Acceptable at dogfood scale (a handful of the founder's own projects); worth reconsidering if Proxibay scales to many external tenants.

## 9. Naming

**Proxibay** — evokes proximity (everything close, in one place) and a nod to "plugging in" (patch-bay metaphor), while staying distinctive from generic ops-tool names. No conflicting existing product found in initial search (closest unrelated matches: Proxibid, an auction platform; "Proxy Bay," an unrelated Pirate-Bay-proxy site) — domain availability across TLDs still needs registrar-level confirmation before locking in.

## 10. Open Questions / Next Steps

- [ ] Finalize normalized event schema field names and types
- [ ] Decide exact Firebase Admin SDK calls to feed the first connector (Auth, Firestore counts, Functions error logs)
- [ ] Design the "add project" flow end to end (catalog fields vs. connector attachment sequencing)
- [ ] Decide alerting rule model (thresholds, notification channels)
- [ ] Confirm domain availability and register
