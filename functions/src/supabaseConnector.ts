import { Timestamp } from 'firebase-admin/firestore'
import { NormalizedEvent } from './types.js'
import { accessSecret } from './secrets.js'

export interface SupabaseCredentials {
  /** e.g. https://xyzcompany.supabase.co (trailing slash tolerated) */
  url: string
  /** service_role secret — bypasses RLS, which is exactly why polling works */
  serviceKey: string
}

interface SupabaseAuthUser {
  id: string
  created_at: string
  last_sign_in_at: string | null
}

export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!/^https:\/\/[^/]+\.[^/]+/.test(trimmed)) return null
  return trimmed
}

function authHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` }
}

async function adminListUsers(
  url: string,
  key: string,
  page: number,
  perPage: number,
): Promise<SupabaseAuthUser[]> {
  const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
    headers: authHeaders(key),
  })
  if (res.status === 401 || res.status === 403) throw new Error('auth-denied')
  if (!res.ok) throw new Error(`Supabase API ${res.status}`)
  const data = (await res.json()) as { users?: SupabaseAuthUser[] } | SupabaseAuthUser[]
  const users = Array.isArray(data) ? data : (data.users ?? [])
  return users
}

/**
 * healthCheck: one admin user lookup — proves the URL is a real Supabase
 * project AND the key is the service_role key (the anon key gets 401/403
 * here, which is exactly the misconfiguration we want to catch inline).
 */
export async function supabaseHealthCheck(credentialsRef: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const creds = JSON.parse(await accessSecret(credentialsRef)) as Partial<SupabaseCredentials>
    const url = creds.url ? normalizeUrl(creds.url) : null
    if (!url) return { ok: false, detail: 'That doesn’t look like a Supabase project URL (https://xyzcompany.supabase.co).' }
    if (!creds.serviceKey || typeof creds.serviceKey !== 'string') {
      return { ok: false, detail: 'Missing service-role key. Use the service_role secret, not the anon key.' }
    }
    try {
      await adminListUsers(url, creds.serviceKey.trim(), 1, 1)
    } catch (e) {
      if (e instanceof Error && e.message === 'auth-denied') {
        return { ok: false, detail: 'Supabase rejected the key. You probably pasted the anon key — reconnect with the service_role secret.' }
      }
      throw e
    }
    return { ok: true, detail: 'Admin user lookup succeeded — URL and service-role key are valid.' }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'healthCheck failed' }
  }
}

/** Pure mapping: user list → the three user_metrics events (unit-testable). */
export function usersToEvents(
  users: SupabaseAuthUser[],
  projectId: string,
  connectorId: string,
  since: Date,
  now: FirebaseFirestore.Timestamp,
  activeWindowDays = 30,
): NormalizedEvent[] {
  let total = 0
  let signups = 0
  let active = 0
  const activeCutoff = now.toMillis() - activeWindowDays * 86400000
  for (const u of users) {
    total += 1
    if (new Date(u.created_at) > since) signups += 1
    if (u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > activeCutoff) active += 1
  }
  return [
    { projectId, connectorId, metricType: 'user_metrics', key: 'total_users', value: total, timestamp: now },
    { projectId, connectorId, metricType: 'user_metrics', key: 'signups', value: signups, timestamp: now },
    {
      projectId, connectorId, metricType: 'user_metrics', key: 'active_users', value: active, timestamp: now,
      metadata: { window: '30d', source: 'last_sign_in_at' },
    },
  ]
}

/**
 * fetchMetrics(handle, since): poll-mode fetch. Paginates the admin user list,
 * then maps via usersToEvents. error_metrics deliberately NOT claimed: log
 * access needs a separate management token the service_role key can't provide.
 */
export async function supabaseFetchMetrics(
  credentialsRef: string,
  projectId: string,
  connectorId: string,
  since: Date,
): Promise<NormalizedEvent[]> {
  const creds = JSON.parse(await accessSecret(credentialsRef)) as SupabaseCredentials
  const url = normalizeUrl(creds.url) as string
  const key = creds.serviceKey.trim()
  const now = Timestamp.now()
  const all: SupabaseAuthUser[] = []
  let page = 1
  for (;;) {
    const users = await adminListUsers(url, key, page, 1000)
    if (users.length === 0) break
    all.push(...users)
    if (users.length < 1000 || page >= 50) break
    page += 1
  }
  return usersToEvents(all, projectId, connectorId, since, now)
}
