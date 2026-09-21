import crypto from 'crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { NormalizedEvent } from './types.js'
import { accessSecret } from './secrets.js'

export interface StripeCredentials {
  /** restricted secret key (rk_live_/rk_test_ preferred, sk_* also works) */
  apiKey: string
  /** webhook endpoint signing secret (whsec_…) — optional, enables push */
  webhookSecret?: string
}

const STRIPE_API = 'https://api.stripe.com/v1'

function basicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`
}

async function stripeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${STRIPE_API}${path}`, { headers: { Authorization: basicAuth(apiKey) } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Stripe API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

/**
 * healthCheck: balance.retrieve() — proves the key is valid + readable,
 * without pulling any data (mirrors the Firebase listUsers(1) pattern).
 */
export async function stripeHealthCheck(credentialsRef: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const creds = JSON.parse(await accessSecret(credentialsRef)) as Partial<StripeCredentials>
    if (!creds.apiKey || typeof creds.apiKey !== 'string') {
      return { ok: false, detail: 'Missing API key. Paste a restricted secret key from your Stripe dashboard.' }
    }
    await stripeGet(creds.apiKey, '/balance')
    return { ok: true, detail: 'balance.retrieve() succeeded — key is valid and readable.' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'healthCheck failed'
    if (/401/.test(msg)) return { ok: false, detail: 'Stripe rejected the key (401). Check it wasn’t truncated and isn’t a publishable key.' }
    return { ok: false, detail: msg }
  }
}

/**
 * Verifies a Stripe webhook signature: HMAC-SHA256(webhookSecret,
 * `${timestamp}.${rawBody}`) compared against the v1 entry, with a 5-minute
 * timestamp tolerance against replay attacks.
 */
export function verifyStripeSignature(rawBody: Buffer, webhookSecret: string, header: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')))
  const t = Number(parts.t)
  const v1 = parts.v1 ?? ''
  if (!t || !v1 || Math.abs(Date.now() / 1000 - t) > 300) return false
  const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex')
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(v1.trim(), 'utf8')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

interface StripeEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

const MAJOR = (cents: number) => Math.round((cents / 100) * 100) / 100

/**
 * Maps one verified Stripe event to NormalizedEvents. Unknown types (incl.
 * refunds/disputes — deferred) are ignored, never errored.
 */
export function stripeEventToNormalized(
  projectId: string,
  connectorId: string,
  now: FirebaseFirestore.Timestamp,
  event: StripeEvent,
): NormalizedEvent[] {
  const obj = event.data.object
  const currency = typeof obj.currency === 'string' ? obj.currency : undefined
  switch (event.type) {
    case 'charge.succeeded': {
      const amount = typeof obj.amount === 'number' ? obj.amount : 0
      return [{
        projectId, connectorId, metricType: 'revenue_metrics', key: 'transaction_volume',
        value: MAJOR(amount), timestamp: now,
        metadata: { ...(currency ? { currency } : {}), charge: String(obj.id ?? event.id) },
      }]
    }
    case 'charge.failed':
      return [{
        projectId, connectorId, metricType: 'revenue_metrics', key: 'failed_payments',
        value: 1, timestamp: now,
        metadata: { ...(currency ? { currency } : {}), charge: String(obj.id ?? event.id) },
      }]
    case 'payout.paid': {
      const amount = typeof obj.amount === 'number' ? obj.amount : 0
      return [{
        projectId, connectorId, metricType: 'revenue_metrics', key: 'payout_volume',
        value: MAJOR(amount), timestamp: now,
        metadata: { ...(currency ? { currency } : {}), payout: String(obj.id ?? event.id) },
      }]
    }
    default:
      return []
  }
}

/**
 * Nightly reconciliation (poll backstop): aggregates the last 30d of succeeded
 * charges + last 24h of failures into gauge keys. Push owns the per-event keys
 * (transaction_volume/failed_payments), so nothing here double-counts.
 */
export async function stripeReconcile(
  credentialsRef: string,
  projectId: string,
  connectorId: string,
): Promise<NormalizedEvent[]> {
  const creds = JSON.parse(await accessSecret(credentialsRef)) as Partial<StripeCredentials>
  if (!creds.apiKey) throw new Error('missing api key')
  const now = Timestamp.now()
  const since30d = Math.floor(Date.now() / 1000) - 30 * 86400
  let revenue30d = 0
  let startingAfter: string | undefined
  for (let pages = 0; pages < 10; pages++) {
    const page = (await stripeGet(
      creds.apiKey,
      `/charges?limit=100&created[gte]=${since30d}` +
        (startingAfter ? `&starting_after=${startingAfter}` : ''),
    )) as {
      data: Array<{ id: string; amount: number; currency: string; status: string; created: number }>
      has_more: boolean
    }
    for (const c of page.data) {
      if (c.status === 'succeeded') revenue30d += c.amount
    }
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }
  const failed = (await stripeGet(
    creds.apiKey,
    `/charges?limit=100&created[gte]=${Math.floor(Date.now() / 1000) - 86400}`,
  )) as { data: Array<{ status: string }> }
  const failed24h = failed.data.filter((c) => c.status === 'failed').length
  return [
    {
      projectId, connectorId, metricType: 'revenue_metrics', key: 'revenue_30d',
      value: MAJOR(revenue30d), timestamp: now, metadata: { source: 'nightly-reconciliation' },
    },
    {
      projectId, connectorId, metricType: 'revenue_metrics', key: 'failed_24h',
      value: failed24h, timestamp: now, metadata: { source: 'nightly-reconciliation' },
    },
  ]
}
