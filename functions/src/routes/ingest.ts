import { Router } from 'express'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { err } from '../auth.js'
import { MetricType, NormalizedEvent } from '../types.js'
import { accessSecret, verifySignature } from '../secrets.js'
import { writeEventsToBuckets } from '../buckets.js'

export const ingestRouter = Router()

const METRIC_TYPES: MetricType[] = ['user_metrics', 'error_metrics', 'revenue_metrics', 'uptime_metrics', 'custom']
const MAX_BATCH = 500
/** In-memory per-connector minute buckets (best-effort; use Redis/quotas at scale). */
const rateWindow = new Map<string, { minute: number; count: number }>()

function checkRate(connectorId: string): boolean {
  const minute = Math.floor(Date.now() / 60000)
  const cur = rateWindow.get(connectorId)
  if (!cur || cur.minute !== minute) {
    rateWindow.set(connectorId, { minute, count: 1 })
    return true
  }
  cur.count += 1
  return cur.count <= 60
}

/**
 * POST /v1/ingest/:connectorId — PUBLIC, HMAC-gated.
 * Raw body required for signature verification (express.raw middleware).
 */
ingestRouter.post('/:connectorId', async (req, res) => {
  const connectorId = req.params.connectorId
  const raw = req.body as Buffer
  const signature = req.header('X-Stackduck-Signature') ?? req.header('X-Proxibay-Signature') ?? ''
  if (!signature) return err(res, 401, 'bad_signature', 'Missing X-Stackduck-Signature header.')

  // Resolve owning project via collection-group lookup (1:1 in v1).
  const db = getFirestore()
  const matches = await db.collectionGroup('connectors').where('id', '==', connectorId).get()
  if (matches.empty) return err(res, 404, 'unknown_connector', 'Unknown connector.')
  const connSnap = matches.docs[0]
  const connector = connSnap.data() as {
    status: string; credentialsRef: string; previousCredentialsRef?: string; graceUntil?: { toMillis(): number }
  }
  const projectId = connSnap.ref.parent.parent?.id
  if (!projectId) return err(res, 404, 'unknown_connector', 'Unknown connector.')
  const project = await db.doc(`projects/${projectId}`).get()
  if (!project.exists || (project.data() as { status: string }).status === 'archived') {
    return err(res, 410, 'connector_disabled', 'Project archived — ingest disabled.')
  }
  if (connector.status === 'error') return err(res, 410, 'connector_disabled', 'Connector disabled.')

  // Signature against current secret, then grace-window previous secret.
  let authed = false
  const graceMs = connector.graceUntil?.toMillis() ?? 0
  try {
    authed = verifySignature(raw, await accessSecret(connector.credentialsRef), signature)
    if (!authed && connector.previousCredentialsRef && graceMs > Date.now()) {
      authed = verifySignature(raw, await accessSecret(connector.previousCredentialsRef), signature)
    }
  } catch {
    authed = false
  }
  if (!authed) {
    await connSnap.ref.update({ status: 'error' }).catch(() => undefined)
    return err(res, 401, 'bad_signature', 'Signature mismatch. Secret rotated without a code update?')
  }

  if (!checkRate(connectorId)) {
    res.setHeader('Retry-After', '60')
    return err(res, 429, 'rate_limited', 'Over 60 req/min for this connector. Check for retry loops.')
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw.toString('utf8'))
  } catch {
    return err(res, 400, 'invalid_event', 'Body must be JSON.')
  }
  const items = Array.isArray(payload) ? payload : [payload]
  if (items.length === 0 || items.length > MAX_BATCH) {
    return err(res, 400, 'invalid_event', `Batch must hold 1–${MAX_BATCH} events.`)
  }
  const now = Timestamp.now()
  const events: NormalizedEvent[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i] as Record<string, unknown>
    if (!METRIC_TYPES.includes(it.metricType as MetricType)) {
      return err(res, 400, 'invalid_event', `Event ${i}: metricType must be one of ${METRIC_TYPES.join(', ')} (unknown values are rejected, never coerced to "custom").`)
    }
    if (typeof it.key !== 'string' || !it.key) return err(res, 400, 'invalid_event', `Event ${i}: "key" must be a non-empty string.`)
    if (typeof it.value !== 'number' || Number.isNaN(it.value)) {
      return err(res, 400, 'invalid_event', `Event ${i}: "value" must be numeric.`)
    }
    let ts = now
    if (it.timestamp !== undefined) {
      const parsed = new Date(it.timestamp as string)
      if (Number.isNaN(parsed.getTime())) return err(res, 400, 'invalid_event', `Event ${i}: bad timestamp.`)
      ts = Timestamp.fromDate(parsed)
    }
    const metadata = it.metadata as Record<string, string | number | boolean> | undefined
    events.push({ projectId, connectorId, metricType: it.metricType as MetricType, key: it.key, value: it.value, timestamp: ts, metadata })
  }

  const bucketIds = await writeEventsToBuckets(events)
  // First verified event flips pending → connected (webhook healthCheck).
  if ((connSnap.data() as { status: string }).status === 'pending') {
    await connSnap.ref.update({ status: 'connected' })
  }
  // Record observed capabilities.
  const observed = [...new Set(events.map((e) => e.metricType))]
  const existing = new Set((connSnap.data() as { capabilities?: MetricType[] }).capabilities ?? [])
  const merged = [...existing, ...observed.filter((o) => !existing.has(o))]
  if (merged.length !== existing.size) await connSnap.ref.update({ capabilities: merged })

  return res.status(202).json({ accepted: events.length, bucketIds, connectorStatus: 'connected' })
})
