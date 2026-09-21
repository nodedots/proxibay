import { Router } from 'express'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { err } from '../auth.js'
import { accessSecret } from '../secrets.js'
import { stripeEventToNormalized, verifyStripeSignature } from '../stripeConnector.js'
import { writeEventsToBuckets } from '../buckets.js'

export const stripeRouter = Router()

/**
 * POST /v1/stripe/:connectorId — PUBLIC, Stripe-signature-gated.
 * Raw body required (express.raw middleware). Unknown event types
 * (incl. refunds/disputes — deferred) are acknowledged, not errored.
 */
stripeRouter.post('/:connectorId', async (req, res) => {
  const connectorId = req.params.connectorId as string
  const raw = req.body as Buffer
  const signature = req.header('Stripe-Signature') ?? ''
  if (!signature) return err(res, 401, 'bad_signature', 'Missing Stripe-Signature header.')

  const db = getFirestore()
  const matches = await db.collectionGroup('connectors').where('id', '==', connectorId).get()
  if (matches.empty) return err(res, 404, 'unknown_connector', 'Unknown connector.')
  const connSnap = matches.docs[0]
  const connector = connSnap.data() as {
    type: string; status: string; credentialsRef: string
  }
  if (connector.type !== 'stripe') return err(res, 404, 'unknown_connector', 'Unknown connector.')
  const projectId = connSnap.ref.parent.parent?.id
  if (!projectId) return err(res, 404, 'unknown_connector', 'Unknown connector.')
  const project = await db.doc(`projects/${projectId}`).get()
  if (!project.exists || (project.data() as { status: string }).status === 'archived') {
    return err(res, 410, 'connector_disabled', 'Project archived — ingest disabled.')
  }
  if (connector.status === 'error') return err(res, 410, 'connector_disabled', 'Connector disabled.')

  let creds: { webhookSecret?: string }
  try {
    creds = JSON.parse(await accessSecret(connector.credentialsRef)) as { webhookSecret?: string }
  } catch {
    return err(res, 500, 'internal', 'Could not read connector credentials.')
  }
  if (!creds.webhookSecret) {
    return err(res, 400, 'invalid_argument', 'No webhook secret saved on this connector — push is not configured (poll still runs).')
  }
  if (!verifyStripeSignature(raw, creds.webhookSecret, signature)) {
    return err(res, 401, 'bad_signature', 'Signature mismatch. Check the endpoint secret matches Stripe’s dashboard.')
  }

  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(raw.toString('utf8')) as typeof event
  } catch {
    return err(res, 400, 'invalid_event', 'Body must be JSON.')
  }
  const events = stripeEventToNormalized(projectId, connectorId, Timestamp.now(), event)
  const bucketIds = events.length ? await writeEventsToBuckets(events) : []
  await connSnap.ref.update({ lastFetchedAt: Timestamp.now() })
  return res.status(202).json({ accepted: events.length, bucketIds, ignored: event.type && events.length === 0 })
})
