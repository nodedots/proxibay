import { Timestamp } from 'firebase-admin/firestore'
import { NormalizedEvent } from './types.js'
import { accessSecret } from './secrets.js'

interface ServiceAccountJson {
  project_id: string
  client_email: string
  private_key: string
  [k: string]: unknown
}

/**
 * healthCheck: lightweight proof of access. Spins up a scoped Admin SDK app
 * from the stored SA JSON and calls auth().listUsers(1) — confirms the key is
 * valid without running a full fetch (per Firebase connector spec).
 */
export async function firebaseHealthCheck(credentialsRef: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const sa = JSON.parse(await accessSecret(credentialsRef)) as ServiceAccountJson
    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      return { ok: false, detail: 'Service account JSON is missing project_id, client_email or private_key.' }
    }
    const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
    const { getAuth } = await import('firebase-admin/auth')
    const name = `healthcheck-${Date.now()}`
    const sub = initializeApp({ credential: cert(sa as never) }, name)
    try {
      await getAuth(sub).listUsers(1)
      return { ok: true, detail: 'listUsers(1) succeeded — service account has read access.' }
    } finally {
      await deleteApp(sub)
    }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'healthCheck failed' }
  }
}

/**
 * fetchMetrics(handle, since): poll-mode fetch per spec.
 * - user_metrics/total_users + user_metrics/signups via listUsers() diffed on
 *   creationTime > since (paginated; large bases should move to a create-trigger later)
 * - error_metrics/error_count via Cloud Logging (best-effort: 0 when the Logging
 *   API isn't enabled — recorded in metadata so charts don't lie)
 * - active_users only if the source app maintains lastActiveAt (not guaranteed)
 */
export async function firebaseFetchMetrics(
  credentialsRef: string,
  projectId: string,
  connectorId: string,
  since: Date,
): Promise<NormalizedEvent[]> {
  const sa = JSON.parse(await accessSecret(credentialsRef)) as ServiceAccountJson
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app')
  const { getAuth } = await import('firebase-admin/auth')
  const name = `poll-${connectorId}-${Date.now()}`
  const sub = initializeApp({ credential: cert(sa as never) }, name)
  const now = Timestamp.now()
  try {
    const auth = getAuth(sub)
    let total = 0
    let signups = 0
    let pageToken: string | undefined
    do {
      const page = await auth.listUsers(1000, pageToken)
      for (const u of page.users) {
        total += 1
        const created = new Date(u.metadata.creationTime)
        if (created > since) signups += 1
      }
      pageToken = page.pageToken
    } while (pageToken)

    const events: NormalizedEvent[] = [
      { projectId, connectorId, metricType: 'user_metrics', key: 'total_users', value: total, timestamp: now },
      { projectId, connectorId, metricType: 'user_metrics', key: 'signups', value: signups, timestamp: now },
    ]

    // Error counts need the Cloud Logging API (severity>=ERROR scoped to the
    // project's functions). Best-effort: report 0 with provenance metadata when
    // unavailable rather than failing the whole poll.
    let errorCount = 0
    let errorsProvenance = 'cloud-logging'
    try {
      errorCount = await queryLoggingErrorCount(sa, since)
    } catch {
      errorsProvenance = 'unavailable-logging-api'
    }
    events.push({
      projectId,
      connectorId,
      metricType: 'error_metrics',
      key: 'error_count',
      value: errorCount,
      timestamp: now,
      metadata: { source: errorsProvenance },
    })
    return events
  } finally {
    await deleteApp(sub)
  }
}

async function queryLoggingErrorCount(sa: ServiceAccountJson, since: Date): Promise<number> {
  // Uses the service account's own access token against Logging entries:list.
  // Kept in a tiny inline OAuth flow to avoid adding googleapis as a dep yet.
  const { JWT } = await import('google-auth-library').catch(() => ({ JWT: null as never }))
  if (!JWT) throw new Error('google-auth-library not installed')
  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ['https://www.googleapis.com/auth/logging.read'],
  })
  const token = await jwt.getAccessToken()
  const accessToken = (token as { token?: string }).token ?? (token as unknown as string)
  const res = await fetch('https://logging.googleapis.com/v2/entries:list', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resourceNames: [`projects/${sa.project_id}`],
      filter: `severity>=ERROR timestamp>="${since.toISOString()}"`,
      pageSize: 1000,
    }),
  })
  if (!res.ok) throw new Error(`Logging API ${res.status}`)
  const data = (await res.json()) as { entries?: unknown[] }
  return data.entries?.length ?? 0
}
