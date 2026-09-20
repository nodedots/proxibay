# Proxibay — Firebase Connector Spec

Follows on from the Data Model & Schema Spec. This defines exactly what the first connector (Firebase) does: which Admin SDK calls it makes, how those map into `NormalizedEvent`s, and what it needs from the dev to get connected.

## 1. Why Firebase First

It's the founder's own stack across nearly all his live projects (Stridu, Swaptrick, Accentta, Way2Sign, Pharmsend, Loancue, etc.), so it's the fastest path to real dogfood data and the connector contract gets battle-tested against real production projects immediately.

## 2. Auth / Connection Setup

- **authType:** `service_account`
- Dev uploads a Firebase service account JSON (scoped, read-only where Firebase's IAM roles allow it — e.g. `Firebase Viewer` + specific read roles rather than full Editor/Owner).
- Proxibay stores only a reference (`credentialsRef`) per the data model spec; the actual JSON goes into Secret Manager, never Firestore.
- **healthCheck:** a lightweight call (e.g. `admin.auth().listUsers(1)`) to confirm the service account still has valid access; distinct from a full metrics fetch.

## 3. Fetch Mode

**Poll.** Cloud Scheduler triggers a Cloud Function on an interval (e.g. every 15–60 min, configurable per project) which runs `fetchMetrics(handle, since)` for each connected Firebase project.

## 4. Capabilities → SDK Calls → Normalized Events

| Capability | Admin SDK / API Source | Normalized Event(s) |
|---|---|---|
| `user_metrics` | `admin.auth().listUsers()` (paginated) — compare against last fetch to compute new signups; total count from full list or a maintained counter | `{ metricType: "user_metrics", key: "signups", value: N }`<br>`{ metricType: "user_metrics", key: "total_users", value: N }` |
| `user_metrics` (active) | Firestore query on a `lastActiveAt` field, if the dev's app maintains one — **not guaranteed available**, depends on the project's own schema | `{ metricType: "user_metrics", key: "active_users", value: N }` (only if source data exists) |
| `error_metrics` | Cloud Functions error logs via Cloud Logging API, filtered to the project's function names | `{ metricType: "error_metrics", key: "error_count", value: N }`<br>`{ metricType: "error_metrics", key: "error_rate", value: pct }` |
| `uptime_metrics` | Not natively available from Firebase Admin SDK — would need a separate lightweight ping/health-check job hitting the project's `liveUrl` | `{ metricType: "uptime_metrics", key: "status", value: 1|0 }`<br>`{ metricType: "uptime_metrics", key: "latency_ms", value: N }` |
| `revenue_metrics` | **Not covered by the Firebase connector** — revenue requires a Stripe (or equivalent) connector; Firebase connector does not claim this capability | — |

**Capabilities this connector instance actually declares:** `["user_metrics", "error_metrics"]` by default; `uptime_metrics` only if the dev opts into the separate ping job for that project.

## 5. Normalization Function (shape)

```ts
async function fetchMetrics(handle: FirebaseHandle, since: Timestamp): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];

  // user_metrics
  const userSnapshot = await handle.auth.listUsers();
  const newSignups = userSnapshot.users.filter(u => u.metadata.creationTime > since);
  events.push({
    projectId: handle.projectId,
    connectorId: handle.connectorId,
    metricType: "user_metrics",
    key: "signups",
    value: newSignups.length,
    timestamp: now(),
  });
  events.push({
    projectId: handle.projectId,
    connectorId: handle.connectorId,
    metricType: "user_metrics",
    key: "total_users",
    value: userSnapshot.users.length,
    timestamp: now(),
  });

  // error_metrics — pseudocode, actual implementation uses Cloud Logging client
  const errorCount = await queryCloudLoggingErrors(handle.projectId, since);
  events.push({
    projectId: handle.projectId,
    connectorId: handle.connectorId,
    metricType: "error_metrics",
    key: "error_count",
    value: errorCount,
    timestamp: now(),
  });

  return events;
}
```

This is illustrative, not final — pagination handling for `listUsers()` on large user bases, and the exact Cloud Logging filter query, still need to be written out in implementation.

## 6. Known Limitations (v1)

- **No native active-user tracking** unless the dev's own app already writes a `lastActiveAt` field somewhere Proxibay can query — Firebase Admin SDK has no built-in session/activity metric.
- **No native revenue data** — must pair with a Stripe connector for any project with payments.
- **No native uptime** — requires a separate scheduled ping, which is really a tiny "synthetic monitoring" connector of its own, not part of the core Firebase connector.
- **Signup counting via full `listUsers()` diffing** is fine at current portfolio scale but won't scale well to large user bases — worth revisiting (e.g. using Firebase Auth's `creationTime` filtering more efficiently, or listening via Cloud Functions triggers on user creation instead of polling) if any project's user base grows large.

## 7. Open Items Surfaced by This Spec

- [ ] Decide whether uptime/synthetic monitoring is its own connector type or a Firebase-connector sub-feature
- [ ] Decide on Cloud Logging query specifics for `error_metrics` (log severity filter, function name scoping)
- [ ] Consider moving signup tracking from polling `listUsers()` to a Cloud Function trigger on user creation, once any project's user base grows
