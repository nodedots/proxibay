import type { AlertRule, ConnectorStatus } from '../types'

/**
 * Plain-language presentation layer (PLAIN_LANGUAGE_AUDIT.md).
 * Technical enum names stay in storage/API; every rendered string goes
 * through these helpers so a non-developer never meets an enum.
 */

/** user_metrics → Users, error_metrics → Errors, … */
export function metricFamilyLabel(metricType: string): string {
  switch (metricType) {
    case 'user_metrics':
      return 'Users'
    case 'error_metrics':
      return 'Errors'
    case 'revenue_metrics':
      return 'Revenue'
    case 'uptime_metrics':
      return 'Uptime'
    default:
      return 'Custom'
  }
}

/** signups → Signups, error_count → Error count, … (fallback: title-case). */
export function humanKeyLabel(key: string): string {
  const known: Record<string, string> = {
    signups: 'Signups',
    total_users: 'Total users',
    active_users: 'Active users',
    error_count: 'Error count',
    error_rate: 'Error rate',
    transaction_volume: 'Transaction volume',
    failed_payments: 'Failed payments',
    payout_volume: 'Payouts',
    revenue_30d: 'Revenue, last 30 days',
    failed_24h: 'Failed payments, last 24h',
    events_received_24h: 'Error events, last 24 hours',
    events_24h: 'Events, last 24 hours',
    workflow_runs_24h: 'Workflow runs, last 24 hours',
    failed_workflow_runs_24h: 'Failed workflow runs, last 24 hours',
    in_progress_workflow_runs: 'Workflow runs in progress',
    availability_percent: 'Availability',
    deployments_24h: 'Deployments, last 24 hours',
    failed_deployments_24h: 'Failed deployments, last 24 hours',
    ready_deployments_24h: 'Ready deployments, last 24 hours',
    active_deployments: 'Deployments in progress',
    status: 'Status',
    latency_ms: 'Latency',
    mrr: 'Monthly revenue',
  }
  if (known[key]) return known[key]
  return key
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/** Connector status → dot class suffix + plain headline (single source). */
export function connectorStatus(status: ConnectorStatus): { dot: string; headline: string } {
  switch (status) {
    case 'connected':
      return { dot: 'status-green', headline: 'Receiving updates' }
    case 'error':
      return { dot: 'status-red', headline: 'Having trouble connecting' }
    case 'pending':
      return { dot: 'status-gray', headline: 'Waiting for first data' }
  }
}

/** Portfolio home status → plain screen-reader label. */
export function homeStatusLabel(status: string): string {
  switch (status) {
    case 'red':
      return 'needs attention'
    case 'amber':
      return 'a connector needs attention'
    case 'gray':
      return 'waiting for data'
    default:
      return 'healthy'
  }
}

function formatWindow(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

/** Alert rule → full plain sentence (rule list now, feed later). */
export function describeRule(rule: Pick<AlertRule, 'key' | 'condition' | 'threshold' | 'windowMinutes' | 'channel' | 'channelTarget'>): string {
  const what = humanKeyLabel(rule.key)
  const over = `over ${formatWindow(rule.windowMinutes)}`
  const where = rule.channel === 'email' ? `email ${rule.channelTarget}` : rule.channelTarget
  return `Tell me when ${what.toLowerCase()} goes ${rule.condition} ${rule.threshold} ${over} → ${where}`
}
