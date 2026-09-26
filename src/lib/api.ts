/**
 * NestJS API client (post-cutover). JWT access token in memory, opaque
 * refresh token in localStorage; a single in-flight refresh is shared by
 * concurrent 401s. Same { error: { code, message } } envelope as before.
 */

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:3001'

const REFRESH_KEY = 'stackduck:refresh'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

let accessToken: string | null = null
let refreshPromise: Promise<string> | null = null

export function setSession(access: string | null, refresh: string | null) {
  accessToken = access
  try {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
    else localStorage.removeItem(REFRESH_KEY)
  } catch {
    // Private mode — session lasts this visit.
  }
}

export function getRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

/** Current in-memory access token (null after reload until restored). */
export function getAccessToken(): string | null {
  return accessToken
}

export function hasSession(): boolean {
  return getRefreshToken() !== null || accessToken !== null
}

/** After a reload (no access token in memory): trade the stored refresh for one. */
export async function restoreSession(): Promise<boolean> {
  if (accessToken) return true
  if (!getRefreshToken()) return false
  try {
    await refreshAccess()
    return true
  } catch {
    return false
  }
}

async function refreshAccess(): Promise<string> {
  if (!refreshPromise) {
    const refresh = getRefreshToken()
    if (!refresh) throw new ApiError(401, 'unauthenticated', 'Not signed in.')
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      })
      const body = (await res.json().catch(() => null)) as {
        accessToken?: string
        refreshToken?: string
        error?: { code: string; message: string }
      } | null
      if (!res.ok || !body?.accessToken || !body?.refreshToken) {
        setSession(null, null)
        throw new ApiError(res.status, body?.error?.code ?? 'invalid_refresh', body?.error?.message ?? 'Session expired — sign in again.')
      }
      setSession(body.accessToken, body.refreshToken)
      return body.accessToken
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

/**
 * Product-grade message for connector-setup failures. Never renders a bare
 * code: known server codes map to sentences, unknown ones get a sentence
 * first with the code in parens for support. (Audit C1–C3.)
 */
export function connectErrorMessage(err: unknown): string {
  if (err instanceof SyntaxError) {
    return 'That is not valid JSON — paste the full service-account file contents.'
  }
  if (err instanceof ApiError) {
    if (err.code === 'bad_signature') {
      return "That secret doesn't match — it may have been rotated. Generate a fresh one and try again."
    }
    if (err.status === 401 || err.status === 403) {
      return "We couldn't reach that service — check the key is still valid and hasn't been deleted."
    }
    if (err.status === 404 || err.code === 'unknown_connector' || err.code === 'not_found') {
      return "We couldn't find that — it may have been deleted."
    }
    if (err.status === 422 || err.code === 'connector_unhealthy') {
      return err.message
    }
    return `Something went wrong${err.status ? ` (code ${err.status})` : ''}. Try again — still stuck? Tell us what you were doing.`
  }
  return 'Couldn’t reach Stackduck’s servers. Check your connection and try again — if you self-host, the API backend must be running first.'
}

/** Generic loader failure line: sentence first, code in parens. (Audit C1.) */
export function loadErrorMessage(what: string, err: unknown): string {
  const code = err instanceof ApiError ? ` (code ${err.status})` : ''
  return `Couldn’t load ${what}${code}. Check your connection and try again.`
}

export async function api<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 401 && accessToken && retry && !path.startsWith('/v1/auth/')) {
    try {
      const next = await refreshAccess()
      return api<T>(path, {
        ...init,
        headers: { ...headers, Authorization: `Bearer ${next}` },
      }, false)
    } catch (e) {
      if (e instanceof ApiError) throw e
    }
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string }
  } | null
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'internal', body?.error?.message ?? `Request failed (${res.status}).`)
  }
  return body as T
}

/** Reconstructs a webhook ingest URL (same API base + scheme as the server). */
export function ingestUrlFor(connectorId: string): string {
  return `${API_BASE}/v1/ingest/${connectorId}`
}

/** Reconstructs a Stripe webhook endpoint URL (same API base + scheme as the server). */
export function stripeUrlFor(connectorId: string): string {
  return `${API_BASE}/v1/stripe/${connectorId}`
}
