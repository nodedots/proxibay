import { Router } from 'express'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { AuthedRequest, err } from '../auth.js'
import { ConnectorInstance, MetricType } from '../types.js'
import { storeSecret, generateSigningSecret, accessSecret } from '../secrets.js'
import { firebaseHealthCheck } from '../firebaseConnector.js'

export const connectorsRouter = Router({ mergeParams: true })

async function ownProject(uid: string, projectIdParam: string | string[]) {
  const projectId = Array.isArray(projectIdParam) ? projectIdParam[0] : projectIdParam
  const ref = getFirestore().doc(`projects/${projectId}`)
  const snap = await ref.get()
  if (!snap.exists || (snap.data() as { ownerId: string }).ownerId !== uid) return null
  return ref
}

function param(req: AuthedRequest, name: string): string {
  const v = req.params[name] as string | string[]
  return Array.isArray(v) ? v[0] : v
}

/** POST /v1/projects/:projectId/connectors/firebase — SA JSON in, healthCheck inline. */
connectorsRouter.post('/firebase', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')

  const existing = await projectRef.collection('connectors').where('type', '==', 'firebase').get()
  if (!existing.empty) return err(res, 409, 'duplicate_connector', 'A Firebase connector already exists (1:1 in v1).')

  const { serviceAccountJson, pollIntervalMinutes } = req.body ?? {}
  if (typeof serviceAccountJson !== 'object' || serviceAccountJson === null) {
    return err(res, 400, 'invalid_argument', '"serviceAccountJson" object is required.')
  }
  const id = `conn_${Date.now().toString(36)}`
  const credentialsRef = await storeSecret(id, JSON.stringify(serviceAccountJson))
  const healthCheck = await firebaseHealthCheck(credentialsRef)
  const now = Timestamp.now()
  const connector: ConnectorInstance = {
    id,
    type: 'firebase',
    authType: 'service_account',
    fetchMode: 'poll',
    capabilities: ['user_metrics', 'error_metrics'],
    credentialsRef,
    status: healthCheck.ok ? 'connected' : 'error',
    lastHealthCheck: now,
    createdAt: now,
    pollIntervalMinutes: typeof pollIntervalMinutes === 'number' ? pollIntervalMinutes : 30,
  }
  await projectRef.collection('connectors').doc(id).set(connector)
  if (!healthCheck.ok) {
    return res.status(422).json({ connector, healthCheck })
  }
  return res.status(201).json({ connector, healthCheck })
})

/** POST /v1/projects/:projectId/connectors/webhook — secret generated server-side. */
connectorsRouter.post('/webhook', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')

  const id = `conn_${Date.now().toString(36)}`
  const signingSecret = generateSigningSecret()
  const credentialsRef = await storeSecret(id, signingSecret)
  const now = Timestamp.now()
  const connector: ConnectorInstance = {
    id,
    type: 'generic-webhook',
    authType: 'none',
    fetchMode: 'push',
    capabilities: [] as MetricType[],
    credentialsRef,
    status: 'pending',
    createdAt: now,
  }
  await projectRef.collection('connectors').doc(id).set(connector)
  const base = process.env.PUBLIC_API_BASE ?? 'https://europe-west1-proxibay-dev.cloudfunctions.net/api'
  const ingestUrl = `${base}/v1/ingest/${id}`
  const snippet = {
    node: `const crypto = require('crypto');\nconst body = JSON.stringify({ metricType: 'user_metrics', key: 'signups', value: 3 });\nconst sig = crypto.createHmac('sha256', '${signingSecret}').update(body).digest('hex');\nawait fetch('${ingestUrl}', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Proxibay-Signature': sig }, body });`,
    curl: `curl -X POST ${ingestUrl} -H 'Content-Type: application/json' -H "X-Proxibay-Signature: $(echo -n '<body>' | openssl dgst -sha256 -hmac '${signingSecret}')" -d '<body>'`,
  }
  return res.status(201).json({ connector, ingestUrl, signingSecret, snippet })
})

/** POST /v1/projects/:projectId/connectors/:connectorId/healthcheck — manual re-check. */
connectorsRouter.post('/:connectorId/healthcheck', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')
  const ref = projectRef.collection('connectors').doc(param(req, 'connectorId'))
  const snap = await ref.get()
  if (!snap.exists) return err(res, 404, 'not_found', 'Connector not found.')
  const connector = snap.data() as ConnectorInstance
  if (connector.type !== 'firebase') {
    return err(res, 400, 'invalid_argument', 'healthCheck is only callable for poll connectors (push flips on first event).')
  }
  const healthCheck = await firebaseHealthCheck(connector.credentialsRef)
  await ref.update({ status: healthCheck.ok ? 'connected' : 'error', lastHealthCheck: Timestamp.now() })
  const after = await ref.get()
  return res.json({ connector: after.data(), healthCheck })
})

/** POST /v1/projects/:projectId/connectors/:connectorId/rotate-secret — 24h grace. */
connectorsRouter.post('/:connectorId/rotate-secret', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')
  const ref = projectRef.collection('connectors').doc(param(req, 'connectorId'))
  const snap = await ref.get()
  if (!snap.exists) return err(res, 404, 'not_found', 'Connector not found.')
  const connector = snap.data() as ConnectorInstance
  if (connector.type !== 'generic-webhook') {
    return err(res, 400, 'invalid_argument', 'Only webhook connectors have a signing secret.')
  }
  const newSecret = generateSigningSecret()
  const newRef = await storeSecret(`${connector.id}-rotated-${Date.now()}`, newSecret)
  const graceUntil = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000)
  await ref.update({ previousCredentialsRef: connector.credentialsRef, credentialsRef: newRef, graceUntil })
  // Keep the secret value accessible for the grace check without re-reading Secret Manager:
  await accessSecret(newRef).catch(() => undefined)
  return res.json({ signingSecret: newSecret, graceUntil: graceUntil.toDate().toISOString() })
})
