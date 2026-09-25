import { Router } from 'express'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { AuthedRequest, err } from '../auth.js'
import { ConnectorInstance, MetricType } from '../types.js'
import { storeSecret, generateSigningSecret, accessSecret } from '../secrets.js'
import { firebaseHealthCheck } from '../firebaseConnector.js'
import { stripeHealthCheck } from '../stripeConnector.js'
import { supabaseHealthCheck } from '../supabaseConnector.js'
import { externalHealthCheck } from '../externalConnectors.js'

export const connectorsRouter = Router({ mergeParams: true })
const EXTERNAL_TYPES = ['sentry', 'github-actions', 'posthog', 'betterstack', 'vercel'] as const

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
    return res.status(422).json({
      error: { code: 'connector_unhealthy', message: healthCheck.detail },
      connector,
      healthCheck,
    })
  }
  return res.status(201).json({ connector, healthCheck })
})

/** POST /v1/projects/:projectId/connectors/supabase — URL + service-role key in, healthCheck inline. */
connectorsRouter.post('/supabase', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')

  const existing = await projectRef.collection('connectors').where('type', '==', 'supabase').get()
  if (!existing.empty) return err(res, 409, 'duplicate_connector', 'A Supabase connector already exists (1:1 in v1).')

  const { url, serviceKey } = req.body ?? {}
  if (typeof url !== 'string' || !url.trim()) {
    return err(res, 400, 'invalid_argument', '"url" (Supabase project URL) is required.')
  }
  if (typeof serviceKey !== 'string' || !serviceKey.trim()) {
    return err(res, 400, 'invalid_argument', '"serviceKey" (service_role secret) is required — the anon key cannot list users.')
  }
  const id = `conn_${Date.now().toString(36)}`
  const credentialsRef = await storeSecret(id, JSON.stringify({ url: url.trim(), serviceKey: serviceKey.trim() }))
  const healthCheck = await supabaseHealthCheck(credentialsRef)
  const now = Timestamp.now()
  const connector: ConnectorInstance = {
    id,
    type: 'supabase',
    authType: 'api_key',
    fetchMode: 'poll',
    capabilities: ['user_metrics'],
    credentialsRef,
    status: healthCheck.ok ? 'connected' : 'error',
    lastHealthCheck: now,
    createdAt: now,
    pollIntervalMinutes: 30,
  }
  await projectRef.collection('connectors').doc(id).set(connector)
  if (!healthCheck.ok) {
    return res.status(422).json({
      error: { code: 'connector_unhealthy', message: healthCheck.detail },
      connector,
      healthCheck,
    })
  }
  return res.status(201).json({ connector, healthCheck })
})

/** POST /v1/projects/:projectId/connectors/webhook — secret generated server-side. */connectorsRouter.post('/webhook', async (req: AuthedRequest, res) => {
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
  const base = process.env.PUBLIC_API_BASE ?? 'https://europe-west1-stackduck-dev.cloudfunctions.net/api'
  const ingestUrl = `${base}/v1/ingest/${id}`
  const snippet = {
    node: `const crypto = require('crypto');\nconst body = JSON.stringify({ metricType: 'user_metrics', key: 'signups', value: 3 });\nconst sig = crypto.createHmac('sha256', '${signingSecret}').update(body).digest('hex');\nawait fetch('${ingestUrl}', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Stackduck-Signature': sig }, body });`,
    curl: `curl -X POST ${ingestUrl} -H 'Content-Type: application/json' -H "X-Stackduck-Signature: $(echo -n '<body>' | openssl dgst -sha256 -hmac '${signingSecret}')" -d '<body>'`,
  }
  return res.status(201).json({ connector, ingestUrl, signingSecret, snippet })
})

/** POST /v1/projects/:projectId/connectors/stripe — restricted key in, healthCheck inline. */
connectorsRouter.post('/stripe', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const projectRef = await ownProject(uid, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')

  const existing = await projectRef.collection('connectors').where('type', '==', 'stripe').get()
  if (!existing.empty) return err(res, 409, 'duplicate_connector', 'A Stripe connector already exists (1:1 in v1).')

  const { apiKey, webhookSecret } = req.body ?? {}
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return err(res, 400, 'invalid_argument', '"apiKey" (restricted secret key) is required.')
  }
  if (webhookSecret !== undefined && typeof webhookSecret !== 'string') {
    return err(res, 400, 'invalid_argument', '"webhookSecret" must be a string when provided.')
  }
  const id = `conn_${Date.now().toString(36)}`
  const credentialsRef = await storeSecret(
    id,
    JSON.stringify({ apiKey: apiKey.trim(), ...(webhookSecret?.trim() ? { webhookSecret: webhookSecret.trim() } : {}) }),
  )
  const healthCheck = await stripeHealthCheck(credentialsRef)
  const now = Timestamp.now()
  const connector: ConnectorInstance = {
    id,
    type: 'stripe',
    authType: 'api_key',
    fetchMode: 'both',
    capabilities: ['revenue_metrics'],
    credentialsRef,
    status: healthCheck.ok ? 'connected' : 'error',
    lastHealthCheck: now,
    createdAt: now,
  }
  await projectRef.collection('connectors').doc(id).set(connector)
  const base = process.env.PUBLIC_API_BASE ?? 'https://europe-west1-stackduck-dev.cloudfunctions.net/api'
  const stripeEndpoint = `${base}/v1/stripe/${id}`
  if (!healthCheck.ok) {
    return res.status(422).json({
      error: { code: 'connector_unhealthy', message: healthCheck.detail },
      connector,
      healthCheck,
      stripeEndpoint,
    })
  }
  return res.status(201).json({ connector, healthCheck, stripeEndpoint })
})

/** POST /v1/projects/:projectId/connectors/:provider for token-based monitoring APIs. */
connectorsRouter.post('/:provider', async (req: AuthedRequest, res) => {
  const type = param(req, 'provider')
  if (!EXTERNAL_TYPES.includes(type as (typeof EXTERNAL_TYPES)[number])) {
    return err(res, 404, 'not_found', 'Unknown connector provider.')
  }
  const provider = type as (typeof EXTERNAL_TYPES)[number]
  const projectRef = await ownProject(req.uid as string, param(req, 'projectId'))
  if (!projectRef) return err(res, 404, 'not_found', 'Project not found.')
  const existing = await projectRef.collection('connectors').where('type', '==', provider).get()
  const existingConnector = existing.docs[0]
  if (existingConnector && existingConnector.get('status') !== 'error') {
    return err(res, 409, 'duplicate_connector', `A ${provider} connector already exists.`)
  }

  const body = req.body ?? {}
  if (typeof body.token !== 'string' || !body.token.trim()) {
    return err(res, 400, 'invalid_argument', 'A provider API token is required.')
  }
  let config: Record<string, string>
  let capabilities: ConnectorInstance['capabilities']
  if (provider === 'sentry') {
    if (typeof body.organization !== 'string' || typeof body.project !== 'string') {
      return err(res, 400, 'invalid_argument', 'Sentry organization and project slugs are required.')
    }
    config = { token: body.token.trim(), organization: body.organization.trim(), project: body.project.trim() }
    capabilities = ['error_metrics']
  } else if (provider === 'github-actions') {
    const snap = await projectRef.get()
    const project = snap.data() as { repoUrl?: string }
    const input = typeof body.repository === 'string' ? body.repository.trim() : project.repoUrl ?? ''
    const match = input.match(/(?:github\.com\/)?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i)
    if (!match || !/^[\w.-]+\/[\w.-]+$/.test(match[1])) {
      return err(res, 400, 'invalid_argument', 'A GitHub repository URL or owner/name is required.')
    }
    config = { token: body.token.trim(), repository: match[1] }
    capabilities = ['custom', 'error_metrics']
  } else if (provider === 'posthog') {
    if (typeof body.projectId !== 'string' || !body.projectId.trim() || !['us', 'eu'].includes(body.region)) {
      return err(res, 400, 'invalid_argument', 'PostHog project ID and region (us or eu) are required.')
    }
    config = { token: body.token.trim(), projectId: body.projectId.trim(), region: body.region }
    capabilities = ['user_metrics', 'custom']
  } else if (provider === 'betterstack') {
    if (typeof body.monitorUrl !== 'string' || !/^https:\/\//i.test(body.monitorUrl.trim())) {
      return err(res, 400, 'invalid_argument', 'An HTTPS monitor URL is required.')
    }
    config = { token: body.token.trim(), monitorUrl: body.monitorUrl.trim() }
    capabilities = ['uptime_metrics']
  } else {
    if (typeof body.projectId !== 'string' || !body.projectId.trim() || (body.teamId !== undefined && typeof body.teamId !== 'string')) {
      return err(res, 400, 'invalid_argument', 'Vercel project ID and optional team ID must be provided.')
    }
    config = { token: body.token.trim(), projectId: body.projectId.trim(), ...(body.teamId.trim() ? { teamId: body.teamId.trim() } : {}) }
    capabilities = ['custom', 'error_metrics']
  }

  const id = existingConnector?.id ?? `conn_${Date.now().toString(36)}`
  config.provider = provider
  const credentialsRef = await storeSecret(id, JSON.stringify(config))
  const healthCheck = await externalHealthCheck(provider, credentialsRef)
  const now = Timestamp.now()
  const connector: ConnectorInstance = {
    id,
    type: provider,
    authType: 'api_key',
    fetchMode: 'poll',
    capabilities,
    credentialsRef,
    status: healthCheck.ok ? 'connected' : 'error',
    lastHealthCheck: now,
    createdAt: now,
    pollIntervalMinutes: 30,
  }
  await projectRef.collection('connectors').doc(id).set(connector)
  if (!healthCheck.ok) {
    return res.status(422).json({ error: { code: 'connector_unhealthy', message: healthCheck.detail }, connector, healthCheck })
  }
  return res.status(201).json({ connector, healthCheck })
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
  if (!['firebase', 'stripe', 'supabase', ...EXTERNAL_TYPES].includes(connector.type)) {
    return err(res, 400, 'invalid_argument', 'healthCheck is only callable for API-key/poll connectors (push flips on first event).')
  }
  const healthCheck =
    connector.type === 'stripe'
      ? await stripeHealthCheck(connector.credentialsRef)
      : connector.type === 'supabase'
        ? await supabaseHealthCheck(connector.credentialsRef)
        : EXTERNAL_TYPES.includes(connector.type as (typeof EXTERNAL_TYPES)[number])
          ? await externalHealthCheck(connector.type as (typeof EXTERNAL_TYPES)[number], connector.credentialsRef)
          : await firebaseHealthCheck(connector.credentialsRef)
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
