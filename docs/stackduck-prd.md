# Proxibay — Product Requirements Document (PRD)

**Status:** Draft v1
**Owner:** Saviour Ukobong

## 1. Summary

Proxibay is a backend monitoring and admin platform for developers running multiple projects. It replaces the pattern of building a separate admin dashboard per project with a single place to register a project once and see its live health, usage, and revenue data.

**Positioning:** a combination of Datadog (real-time observability, alerting) for indie devs, and Backstage (a catalog of everything you own) for solo founders.

**Value proposition:** *Don't build another SPA dashboard. Just plug your project in.*

## 2. Problem Statement

Developers and project owners managing more than one product accumulate one bespoke admin panel per project. There's no unified view of what's healthy, what's failing, who's using what, or how much revenue is coming in across a portfolio — just N disconnected dashboards, each rebuilt from scratch.

## 3. Goals

- Give a single dev/founder one place to register every project they run and see its live status without building custom tooling per project
- Make "adding monitoring" and "cataloging a project" the same action, not two separate flows
- Validate the product against a real, messy multi-project portfolio (the founder's own ~15+ live apps) before generalizing to other developers

## 4. Non-Goals (v1)

- Not a full APM/tracing tool (no distributed tracing, no code-level profiling)
- Not a general-purpose admin/CRUD backend generator — Proxibay observes and catalogs, it doesn't replace a project's actual admin operations
- Not multi-tenant/team-based access control at v1 — single-owner accounts only
- Not native Slack/Discord/SMS alert integrations — generic webhook covers this indirectly

## 5. Target Users

- **Phase 1:** the founder himself, dogfooding across his own portfolio (Stridu, Swaptrick, Accentta, Way2Sign, Pharmsend, Loancue, Learnlytics, and others) — predominantly Firebase-based (React/TypeScript/Vite/Tailwind + Firebase Auth/Firestore/Functions)
- **Phase 2:** other indie devs/solo founders running multiple small projects, once the core is validated

## 6. Core Concepts

### 6.1 Catalog Entry (Project)
Each registered project has a static profile (name, description, stack tags, repo/live URL, environment, status, notes) and, optionally, one or more attached connectors that populate it with live data. Only `name` is required; all other catalog fields are optional and fillable over time — the catalog must never gate live monitoring behind a form.

### 6.2 Connector
A plugin that authenticates against a backend/service and normalizes its data into a common event schema. Each connector declares its `authType`, `fetchMode` (poll/push/both), and `capabilities` (which metric types it can produce).

### 6.3 Metric Types
Four core types plus an escape hatch: `user_metrics`, `error_metrics`, `revenue_metrics`, `uptime_metrics`, `custom`.

### 6.4 Alerts
Threshold-based rules evaluated on a schedule against stored metric buckets, delivered via email or webhook, with cooldown to prevent notification fatigue.

## 7. Functional Requirements

### 7.1 Project Management
- FR1: User can create a project with only a name
- FR2: User can edit any catalog field inline, at any time, with no separate edit mode
- FR3: User can set project status to active/paused/archived
- FR4: Deleting a project with an active connector must be explicitly handled (block, or soft-archive + stop ingest) — behavior tbd (see Open Items)

### 7.2 Connectors
- FR5: User can attach a Firebase connector via service account JSON; system runs a health check immediately on submit
- FR6: User can attach a Generic Webhook connector; system generates a unique ingest URL and signing secret
- FR7: User can attach a Stripe connector via restricted API key; system registers a Stripe webhook for push-based revenue events, with nightly reconciliation as backstop
- FR8: System normalizes all connector output into the common `NormalizedEvent` schema before storage
- FR9: Connector status (`connected` / `error` / `pending`) is visible per connector instance, independent of catalog project status

### 7.3 Metrics & Storage
- FR10: Incoming events are aggregated into daily bucketed documents per `projectId_metricType_key_date`, not stored one-per-event
- FR11: Each bucket stores intraday points plus a daily aggregate (sum/avg/max/min/last)
- FR12: Dashboard views read bucketed documents, not raw events, to keep read costs bounded

### 7.4 Alerts
- FR13: User can define an alert rule per project/metric/key with a threshold, condition (above/below), evaluation window, and delivery channel
- FR14: Alerts evaluate on a schedule (not real-time-on-ingest); default interval ~5 minutes
- FR15: Triggered alerts respect a cooldown period before re-firing for the same condition
- FR16: Alert delivery supports email and generic webhook at v1

### 7.5 Dashboard / UI
- FR17: Portfolio home view shows all registered projects with a status indicator (derived from connector health + any active alerts) and key metrics where available
- FR18: Project detail view shows full catalog info, connector list/status, metric charts, and a feed of recent alert firings
- FR19: A project with no connector shows a persistent, non-blocking "connect data" prompt rather than a dead-end empty state

## 8. Technical Requirements

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend/API | Firebase Cloud Functions (TypeScript) |
| Data storage | Firestore — catalog collections + bucketed time-series metric documents |
| Auth | Firebase Auth |
| Hosting | Firebase Hosting |
| Scheduling | Cloud Scheduler (polling connectors, alert evaluation) |

Full schema definitions (Project, ConnectorInstance, NormalizedEvent, MetricBucket, AlertRule) are specified in the Data Model & Schema Spec.

## 9. Connector Roadmap

| Connector | Priority | Fetch Mode | Status |
|---|---|---|---|
| Firebase | v1 | Poll | Specced |
| Generic Webhook | v1 | Push | Conceptually specced (needs its own full doc) |
| Stripe | v1 | Push (+ nightly poll reconciliation) | Specced |
| Supabase | v1 stretch / v1.1 | Poll (assumed) | Not yet specced |

## 10. Success Criteria for v1 (Dogfood Phase)

- Founder has registered his own live projects in Proxibay and at least the Firebase-based ones report live user/error data
- At least one project with payments (Swaptrick) reports revenue data via the Stripe connector
- At least one alert rule has fired correctly (true positive) without excessive noise (no false-positive fatigue)
- Founder can honestly say Proxibay replaced checking N separate admin panels with one portfolio view, for his own daily use

## 11. Risks

- **Cloud Functions cost/cold-start at scale** if polling many projects on tight intervals — acceptable at dogfood scale (~15 projects), needs revisiting before opening to external devs
- **Firebase connector's active-user tracking gap** — no native session/activity metric without the dev's own app maintaining a `lastActiveAt` field
- **Loancue's BNPL revenue model** doesn't map cleanly onto standard charge-based revenue tracking — needs custom-metric handling, not solved by the default Stripe connector
- **Domain/naming** — "Proxibay" has no confirmed conflict but domain availability across TLDs hasn't been verified at registrar level

## 12. Open Items (Consolidated)

- [ ] Project-deletion behavior when an active connector exists
- [ ] Whether a connector instance can ever be shared across projects (e.g. one Stripe account spanning multiple apps) or must stay strictly 1:1
- [ ] "Waiting for first data" empty-state content
- [ ] Default `windowMinutes` and cooldown values per metric type
- [ ] Edge-triggered vs. level-triggered alerting logic for uptime/status metrics vs. threshold metrics
- [ ] Whether a cross-project alerts inbox is needed once real usage patterns are visible
- [ ] Loancue's BNPL repayment model → `custom` metric mapping
- [ ] Refund/dispute event handling for the Stripe connector
- [ ] Intraday-point retention/downsampling policy for metric buckets
- [ ] Connector credential storage wiring (Secret Manager vs. Cloud Functions env config)
- [ ] Full Generic Webhook connector spec (currently only conceptually described)
- [ ] Supabase connector spec
- [ ] Domain registration confirmation across TLDs

## 13. Related Documents

- Project Document (positioning, naming, initial stack decision)
- Data Model & Schema Spec (Project, ConnectorInstance, NormalizedEvent, MetricBucket, AlertRule shapes)
- Firebase Connector Spec
- Stripe Connector Spec
- "Add Project" Flow
- Alerting Model
