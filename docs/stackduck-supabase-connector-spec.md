# Proxibay — Supabase Connector Spec

Follows on from the Stripe Connector Spec. Supabase was flagged in the Project Document as a "stretch goal for v1, safe to defer" — this fills that gap. Supabase is Postgres under the hood plus its own Auth/Storage/Realtime layers, so this connector is structurally similar to the Firebase connector but sourced from Supabase's APIs.

## 1. Why Supabase

Not part of the founder's own current stack, but common enough among indie devs that it matters once Proxibay generalizes past dogfooding. Specifying it now (even if implementation is deferred) keeps the connector contract honest — if it only ever gets designed around Firebase's shape, the "generic" promise in the positioning is untested.

## 2. Auth / Connection Setup

- **authType:** `api_key` — Supabase projects expose a `service_role` key (full access, bypasses Row Level Security) and an `anon` key (RLS-respecting, limited). Proxibay requires the **service_role key** for reliable aggregate reads, since RLS policies could otherwise silently hide data from a monitoring connector without the dev realizing it.
- Dev pastes the Supabase project URL + service_role key.
- **healthCheck:** a lightweight query, e.g. `select count(*) from auth.users limit 1`, to confirm the key is valid and has access.

**Security note to surface in the UI:** because the service_role key bypasses RLS, this is a more sensitive credential than Firebase's typically-scoped service account. The connect flow should say this plainly rather than treat it like an ordinary API key.

## 3. Fetch Mode

**Poll**, matching the Firebase connector's approach — Supabase doesn't offer a first-party outbound-events mechanism as ready-made as Stripe's webhooks (Supabase does have Database Webhooks/triggers, which is a possible push-mode upgrade later, but v1 keeps this simple and consistent with the Firebase pattern: scheduled Function polls on an interval).

## 4. Capabilities → Supabase Source → Normalized Events

| Capability | Supabase Source | Normalized Event(s) |
|---|---|---|
| `user_metrics` | `auth.admin.listUsers()` (Supabase JS Admin client) — diff against last fetch for new signups, full count for total | `{ metricType: "user_metrics", key: "signups", value: N }`<br>`{ metricType: "user_metrics", key: "total_users", value: N }` |
| `error_metrics` | Supabase's Logs/Analytics API (project logs, filterable by severity) — availability and query shape depend on Supabase plan tier, since detailed log retention is a paid-tier feature | `{ metricType: "error_metrics", key: "error_count", value: N }` |
| `user_metrics` (active) | Requires a `last_sign_in_at`-style field, which Supabase Auth actually does track natively (`last_sign_in_at` on the user object) — better native support here than Firebase | `{ metricType: "user_metrics", key: "active_users", value: N }` (users with `last_sign_in_at` within window) |
| `revenue_metrics` | **Not covered** — same as Firebase, pair with the Stripe connector for any Supabase-backed project with payments | — |
| `uptime_metrics` | **Not covered natively** — same synthetic-ping approach as the Firebase connector would apply here too | — |

**Capabilities this connector instance declares by default:** `["user_metrics"]`, with `error_metrics` only if the dev's Supabase plan tier exposes queryable logs.

## 5. Known Limitations (v1)

- **Log/error access is plan-tier-dependent** — free-tier Supabase projects may have very limited log retention/query access, so `error_metrics` capability may not be available for all connected projects. This should be detected at connect-time (a failed logs query) rather than assumed.
- **Row Level Security bypass requirement** means this connector holds unusually broad access — worth a clear warning in the connect UI, and a strong recommendation to rotate the service_role key if it's ever suspected to be exposed.
- **No native revenue or uptime data**, same gaps as Firebase — this connector is scoped to user/error metrics only.

## 6. Open Items Surfaced by This Spec

- [ ] Confirm exact Supabase Logs/Analytics API query shape and which plan tiers support it
- [ ] Decide whether to upgrade from polling to Supabase Database Webhooks for lower-latency user events, once basic polling is validated
- [ ] Decide UI copy for the service_role key security warning
