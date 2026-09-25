/**
 * Shared types — mirrors src/types.ts (frontend) and the Data Model spec.
 * Kept as a copy (not a workspace import) so functions/ deploys standalone.
 */
export type MetricType =
  | 'user_metrics'
  | 'error_metrics'
  | 'revenue_metrics'
  | 'uptime_metrics'
  | 'custom'
export type ProjectStatus = 'active' | 'paused' | 'archived'
export type Environment = 'production' | 'staging' | 'development'
export type ConnectorType = 'firebase' | 'generic-webhook' | 'supabase' | 'stripe' | 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel'
export type ConnectorAuthType = 'api_key' | 'oauth' | 'service_account' | 'none'
export type ConnectorFetchMode = 'poll' | 'push' | 'both'
export type ConnectorStatus = 'connected' | 'error' | 'pending'

export interface Project {
  id: string
  ownerId: string
  name: string
  description?: string
  stackTags?: string[]
  repoUrl?: string
  liveUrl?: string
  environment?: Environment
  status: ProjectStatus
  notes?: string
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

export interface ConnectorInstance {
  id: string
  type: ConnectorType
  authType: ConnectorAuthType
  fetchMode: ConnectorFetchMode
  capabilities: MetricType[]
  credentialsRef: string
  status: ConnectorStatus
  lastHealthCheck?: FirebaseFirestore.Timestamp
  lastFetchedAt?: FirebaseFirestore.Timestamp
  createdAt: FirebaseFirestore.Timestamp
  /** push connectors only: previous secret valid until rotation grace expires */
  previousCredentialsRef?: string
  graceUntil?: FirebaseFirestore.Timestamp
  /** poll connectors only */
  pollIntervalMinutes?: number
}

export interface NormalizedEvent {
  projectId: string
  connectorId: string
  metricType: MetricType
  key: string
  value: number
  timestamp: FirebaseFirestore.Timestamp
  metadata?: Record<string, string | number | boolean>
}

export interface MetricBucket {
  projectId: string
  metricType: MetricType
  key: string
  date: string
  points: Array<{ time: FirebaseFirestore.Timestamp; value: number }>
  dailyAggregate?: { sum?: number; avg?: number; max?: number; min?: number; last?: number }
  updatedAt: FirebaseFirestore.Timestamp
}

export function metricBucketId(
  projectId: string,
  metricType: MetricType,
  key: string,
  date: string,
): string {
  return `${projectId}_${metricType}_${key}_${date}`
}

export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}
