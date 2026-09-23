import { auth } from '../firebase'

const PROJECT = import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'stackduck-dev'
const BASE =
  import.meta.env.VITE_FUNCTIONS_BASE ??
  `http://localhost:5001/${PROJECT}/europe-west1/api`

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
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
  return 'Couldn’t reach Stackduck’s servers. Check your connection and try again — if you self-host, the API backend must be deployed first (Auth + database alone aren’t enough for connectors).'
}

/** Generic loader failure line: sentence first, code in parens. (Audit C1.) */
export function loadErrorMessage(what: string, err: unknown): string {
  const code = err instanceof ApiError ? ` (code ${err.status})` : ''
  return `Couldn’t load ${what}${code}. Check your connection and try again.`
}

async function token(): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'unauthenticated', 'Not signed in.')
  return user.getIdToken()
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${await token()}`,
    },
  })
  const body = (await res.json().catch(() => null)) as {
    error?: { code: string; message: string }
  } | null
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code ?? 'internal', body?.error?.message ?? `Request failed (${res.status}).`)
  }
  return body as T
}

/** Reconstructs a webhook ingest URL (same BASE + scheme as the server). */
export function ingestUrlFor(connectorId: string): string {
  return `${BASE}/v1/ingest/${connectorId}`
}

/** Reconstructs a Stripe webhook endpoint URL (same BASE + scheme as the server). */
export function stripeUrlFor(connectorId: string): string {
  return `${BASE}/v1/stripe/${connectorId}`
}
