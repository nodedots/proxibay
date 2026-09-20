import { auth } from '../firebase'

const BASE =
  import.meta.env.VITE_FUNCTIONS_BASE ??
  'http://localhost:5001/proxibay-dev/europe-west1/api'

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
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
