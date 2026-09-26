import { api, API_BASE, getAccessToken, getRefreshToken, restoreSession, setSession } from './api'
import type { UserPrefs } from './prefs'

/** Authenticated account, as returned by GET /v1/auth/me. */
export interface BackendUser {
  id: string
  email?: string | null
  displayName?: string | null
  photoUrl?: string | null
  createdAt: string
  providers: string[]
  prefs: Partial<UserPrefs> | null
}

type Listener = (user: BackendUser | null | undefined) => void

let current: BackendUser | null | undefined = undefined
const listeners = new Set<Listener>()

function emit() {
  for (const fn of listeners) fn(current)
}

export function getSessionUser(): BackendUser | null | undefined {
  return current
}

export function subscribeSession(fn: Listener): () => void {
  listeners.add(fn)
  fn(current)
  return () => {
    listeners.delete(fn)
  }
}

/** Resolve the persisted session (if any) into a user. Idempotent. */
export async function refreshUser(): Promise<BackendUser | null> {
  if (!getRefreshToken()) {
    current = null
    emit()
    return null
  }
  try {
    await restoreSession()
    const res = await api<{ user: BackendUser }>('/v1/auth/me')
    current = res.user
  } catch {
    current = null
  }
  emit()
  return current
}

/** Store an OAuth-callback or fresh-login token pair, then resolve the user. */
export async function adoptTokens(accessToken: string, refreshToken: string): Promise<BackendUser | null> {
  setSession(accessToken, refreshToken)
  return refreshUser()
}

export function setSessionUser(user: BackendUser | null | undefined) {
  current = user
  emit()
}

/** Revoke the refresh token server-side (best-effort), then clear locally. */
export async function signOut(): Promise<void> {
  const refresh = getRefreshToken()
  setSession(null, null)
  current = null
  emit()
  if (refresh) {
    try {
      await fetch(`${API_BASE}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
    } catch {
      // Local state is already cleared — server revocation is best-effort.
    }
  }
}

/** Backend OAuth authorize URL (full-page redirect; consent rides along). */
export function oauthStartUrl(provider: 'google' | 'github', consent: boolean): string {
  const url = new URL(`${API_BASE}/v1/auth/${provider}`)
  if (consent) url.searchParams.set('consent', '1')
  return url.toString()
}

/** Import-time authorize URL. Full-page navigation carries no auth header, so the
 *  short-lived access token rides as a one-time query param (verified
 *  server-side, never stored). Restored first so reloads work. */
export async function importStartUrl(provider: 'github' | 'google'): Promise<string> {
  await restoreSession()
  const token = getAccessToken()
  if (!token) throw new Error('Not signed in.')
  return `${API_BASE}/v1/auth/${provider}-import?token=${encodeURIComponent(token)}`
}
