/**
 * Proxibay data layer — mirrors Data Model & Schema Spec exactly.
 * Single source of truth shared by frontend + Cloud Functions
 * (functions/ has its own copy until a monorepo workspace is set up).
 */

export type MetricType =
  | 'user_metrics'
  | 'error_metrics'
  | 'revenue_metrics'
  | 'uptime_metrics'
  | 'custom'

export type ProjectStatus = 'active' | 'paused' | 'archived'
export type Environment = 'production' | 'staging' | 'development'

/** Firestore: `projects/{projectId}` */
export interface Project {
  id: string
  /** uid that registered it — single-owner, no teams (PRD non-goal) */
  ownerId: string
  /** required — only mandatory field */
  name: string
  description?: string
  /** e.g. ["firebase", "react", "typescript"] */
  stackTags?: string[]
  repoUrl?: string
  liveUrl?: string
  environment?: Environment
  status: ProjectStatus
  /** free-text, docs links etc. */
  notes?: string
  createdAt: FirebaseTimestamp
  updatedAt: FirebaseTimestamp
}

export type ConnectorType = 'firebase' | 'generic-webhook' | 'supabase' | 'stripe'
export type ConnectorAuthType = 'api_key' | 'oauth' | 'service_account' | 'none'
export type ConnectorFetchMode = 'poll' | 'push' | 'both'
export type ConnectorStatus = 'connected' | 'error' | 'pending'

/** Firestore: `projects/{projectId}/connectors/{connectorId}` */
export interface ConnectorInstance {
  id: string
  type: ConnectorType
  authType: ConnectorAuthType
  fetchMode: ConnectorFetchMode
  /** what this instance actually reports */
  capabilities: MetricType[]
  /** pointer to Secret Manager — NEVER a raw secret */
  credentialsRef: string
  status: ConnectorStatus
  lastHealthCheck?: FirebaseTimestamp
  /** poll-mode only */
  lastFetchedAt?: FirebaseTimestamp
  createdAt: FirebaseTimestamp
}

/** Pre-storage output of every connector — never stored 1:1, always bucketed. */
export interface NormalizedEvent {
  projectId: string
  connectorId: string
  metricType: MetricType
  /** e.g. "signups", "active_users", "error_rate", "mrr" */
  key: string
  value: number
  timestamp: FirebaseTimestamp
  metadata?: Record<string, string | number | boolean>
}

/** Firestore: `metrics/{projectId}_{metricType}_{key}_{YYYY-MM-DD}` */
export interface MetricBucket {
  projectId: string
  metricType: MetricType
  key: string
  /** "2026-09-20" */
  date: string
  /** intraday points for this key/day */
  points: Array<{ time: FirebaseTimestamp; value: number }>
  dailyAggregate?: {
    sum?: number
    avg?: number
    max?: number
    min?: number
    /** useful for gauge-like metrics (e.g. current uptime status) */
    last?: number
  }
  updatedAt: FirebaseTimestamp
}

/** Minimal Timestamp shape — Firestore Timestamp at runtime. */
export interface FirebaseTimestamp {
  seconds: number
  nanoseconds: number
}

/** Doc-ID helper — must stay in sync with functions/src/metrics.ts */
export function metricBucketId(
  projectId: string,
  metricType: MetricType,
  key: string,
  date: string,
): string {
  return `${projectId}_${metricType}_${key}_${date}`
}

/** Portfolio Home status color logic (spec § status): alerts deferred to Phase 2. */
export type HomeStatus = 'red' | 'amber' | 'gray' | 'green'
export function projectHomeStatus(args: {
  hasTriggeredUnresolvedAlert: boolean
  connectorStatuses: ConnectorStatus[]
}): HomeStatus {
  if (args.hasTriggeredUnresolvedAlert) return 'red'
  if (args.connectorStatuses.includes('error')) return 'amber'
  if (args.connectorStatuses.includes('pending')) return 'gray'
  return 'green'
}
