import { Timestamp } from 'firebase-admin/firestore'
import { accessSecret } from './secrets.js'
import { ConnectorType, NormalizedEvent } from './types.js'

type ExternalType = Extract<ConnectorType, 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel'>
type Config =
  | { provider: 'sentry'; token: string; organization: string; project: string }
  | { provider: 'github-actions'; token: string; repository: string }
  | { provider: 'posthog'; token: string; projectId: string; region: 'us' | 'eu' }
  | { provider: 'betterstack'; token: string; monitorUrl: string }
  | { provider: 'vercel'; token: string; projectId: string; teamId?: string }

async function readConfig(ref: string): Promise<Config> {
  return JSON.parse(await accessSecret(ref)) as Config
}

async function requestJson(url: string, token: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Provider returned ${response.status}`)
  return response.json() as Promise<unknown>
}

async function posthogQuery(config: Extract<Config, { provider: 'posthog' }>, sql: string): Promise<number> {
  const host = config.region === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com'
  const response = await fetch(`${host}/api/projects/${encodeURIComponent(config.projectId)}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`PostHog returned ${response.status}`)
  const data = await response.json() as { results?: unknown[][] }
  const value = Number(data.results?.[0]?.[0])
  if (!Number.isFinite(value)) throw new Error('PostHog returned an unexpected query result.')
  return value
}

function assertConfig(type: ExternalType, config: Config): asserts config is Config {
  if (!config || typeof config !== 'object' || typeof config.token !== 'string' || !config.token) {
    throw new Error('Connector credentials are invalid.')
  }
  if (config.provider !== type) throw new Error('Connector provider does not match its saved credentials.')
  if (type === 'sentry' && (config.provider !== 'sentry' || !config.organization || !config.project)) {
    throw new Error('Sentry organization and project are required.')
  }
  if (type === 'github-actions' && (config.provider !== 'github-actions' || !/^[\w.-]+\/[\w.-]+$/.test(config.repository))) {
    throw new Error('GitHub repository must use owner/name format.')
  }
  if (type === 'posthog' && (config.provider !== 'posthog' || !config.projectId || !['us', 'eu'].includes(config.region))) {
    throw new Error('PostHog project ID and region are required.')
  }
  if (type === 'betterstack' && (config.provider !== 'betterstack' || !config.monitorUrl)) {
    throw new Error('Better Stack monitor URL is required.')
  }
  if (type === 'vercel' && (config.provider !== 'vercel' || !config.projectId)) {
    throw new Error('Vercel project ID is required.')
  }
}

export async function externalHealthCheck(type: ExternalType, credentialsRef: string) {
  try {
    const config = await readConfig(credentialsRef)
    assertConfig(type, config)
    if (type === 'sentry' && config.provider === 'sentry') {
      await requestJson(`https://sentry.io/api/0/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/`, config.token)
    } else if (type === 'github-actions' && config.provider === 'github-actions') {
      await requestJson(`https://api.github.com/repos/${config.repository}`, config.token, { 'X-GitHub-Api-Version': '2022-11-28' })
    } else if (type === 'posthog' && config.provider === 'posthog') {
      const host = config.region === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com'
      await requestJson(`${host}/api/projects/${encodeURIComponent(config.projectId)}/`, config.token)
      await posthogQuery(config, 'SELECT 1')
    } else if (type === 'betterstack' && config.provider === 'betterstack') {
      const url = `https://uptime.betterstack.com/api/v2/monitors?url=${encodeURIComponent(config.monitorUrl)}`
      const payload = await requestJson(url, config.token) as { data?: Array<{ attributes?: { url?: string } }> }
      if (!(payload.data ?? []).some((monitor) => monitor.attributes?.url === config.monitorUrl)) {
        throw new Error('No Better Stack monitor matches that URL.')
      }
    } else if (type === 'vercel' && config.provider === 'vercel') {
      const query = new URLSearchParams({ projectId: config.projectId, limit: '1' })
      if (config.teamId) query.set('teamId', config.teamId)
      await requestJson(`https://api.vercel.com/v6/deployments?${query}`, config.token)
    }
    return { ok: true, detail: 'Credentials verified.' }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'Could not verify provider credentials.' }
  }
}

export async function externalFetchMetrics(
  type: ExternalType,
  credentialsRef: string,
  projectId: string,
  connectorId: string,
): Promise<NormalizedEvent[]> {
  const config = await readConfig(credentialsRef)
  assertConfig(type, config)
  const now = new Date()
  const timestamp = Timestamp.fromDate(now)
  const make = (metricType: NormalizedEvent['metricType'], key: string, value: number): NormalizedEvent => ({
    projectId, connectorId, metricType, key, value, timestamp,
  })

  if (type === 'sentry' && config.provider === 'sentry') {
    const since = Math.floor((now.getTime() - 24 * 60 * 60 * 1000) / 1000)
    const until = Math.floor(now.getTime() / 1000)
    const rows = await requestJson(
      `https://sentry.io/api/0/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/stats/?stat=received&since=${since}&until=${until}&resolution=1h`,
      config.token,
    ) as Array<[number, number]>
    const events = rows.reduce((sum, row) => sum + (Number(row[1]) || 0), 0)
    return [make('error_metrics', 'events_received_24h', events)]
  }

  if (type === 'github-actions' && config.provider === 'github-actions') {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const payload = await requestJson(
      `https://api.github.com/repos/${config.repository}/actions/runs?per_page=100&created=%3E%3D${encodeURIComponent(since)}`,
      config.token,
      { 'X-GitHub-Api-Version': '2022-11-28' },
    ) as { total_count?: number; workflow_runs?: Array<{ conclusion: string | null; status: string }> }
    const runs = payload.workflow_runs ?? []
    const failed = runs.filter((run) => run.conclusion === 'failure').length
    return [
      make('custom', 'workflow_runs_24h', Number(payload.total_count ?? runs.length)),
      make('error_metrics', 'failed_workflow_runs_24h', failed),
      make('custom', 'in_progress_workflow_runs', runs.filter((run) => run.status !== 'completed').length),
    ]
  }

  if (type === 'posthog' && config.provider === 'posthog') {
    const [users, events] = await Promise.all([
      posthogQuery(config, "SELECT count(DISTINCT person_id) FROM events WHERE timestamp >= now() - INTERVAL 30 DAY"),
      posthogQuery(config, "SELECT count() FROM events WHERE timestamp >= now() - INTERVAL 24 HOUR"),
    ])
    return [make('user_metrics', 'active_users_30d', users), make('custom', 'events_24h', events)]
  }

  if (type === 'betterstack' && config.provider === 'betterstack') {
    const payload = await requestJson(
      `https://uptime.betterstack.com/api/v2/monitors?url=${encodeURIComponent(config.monitorUrl)}`,
      config.token,
    ) as { data?: Array<{ attributes?: { url?: string; status?: string } }> }
    const monitor = (payload.data ?? []).find((item) => item.attributes?.url === config.monitorUrl)
    const status = monitor?.attributes?.status
    if (!status) throw new Error('The matching Better Stack monitor is unavailable.')
    if (status !== 'up' && status !== 'down' && status !== 'validating') return []
    return [make('uptime_metrics', 'availability_percent', status === 'down' ? 0 : 100)]
  }

  if (type === 'vercel' && config.provider === 'vercel') {
    const since = Date.now() - 24 * 60 * 60 * 1000
    const query = new URLSearchParams({ projectId: config.projectId, limit: '100', since: String(since) })
    if (config.teamId) query.set('teamId', config.teamId)
    const payload = await requestJson(`https://api.vercel.com/v6/deployments?${query}`, config.token) as {
      deployments?: Array<{ state?: string; readyState?: string }>
    }
    const deployments = payload.deployments ?? []
    const states = deployments.map((deployment) => (deployment.readyState ?? deployment.state ?? '').toUpperCase())
    return [
      make('custom', 'deployments_24h', deployments.length),
      make('error_metrics', 'failed_deployments_24h', states.filter((state) => state === 'ERROR' || state === 'CANCELED').length),
      make('custom', 'ready_deployments_24h', states.filter((state) => state === 'READY').length),
      make('custom', 'active_deployments', states.filter((state) => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(state)).length),
    ]
  }

  return []
}
