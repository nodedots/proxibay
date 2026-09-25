import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../credentials/credentials.service';
import type { ConnectorType, NormalizedEvent } from '../../common/types';

export type ExternalType = Extract<ConnectorType, 'sentry' | 'github-actions' | 'posthog' | 'betterstack' | 'vercel'>;
export type ExternalConfig =
  | { provider: 'sentry'; token: string; organization: string; project: string }
  | { provider: 'github-actions'; token: string; repository: string }
  | { provider: 'posthog'; token: string; projectId: string; region: 'us' | 'eu' }
  | { provider: 'betterstack'; token: string; monitorUrl: string }
  | { provider: 'vercel'; token: string; projectId: string; teamId?: string };

export async function requestJson(url: string, token: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Provider returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function posthogQuery(config: Extract<ExternalConfig, { provider: 'posthog' }>, sql: string): Promise<number> {
  const host = config.region === 'eu' ? 'https://eu.posthog.com' : 'https://us.posthog.com';
  const response = await fetch(`${host}/api/projects/${encodeURIComponent(config.projectId)}/query/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PostHog returned ${response.status}`);
  const data = (await response.json()) as { results?: unknown[][] };
  const value = Number(data.results?.[0]?.[0]);
  if (!Number.isFinite(value)) throw new Error('PostHog returned an unexpected query result.');
  return value;
}

export function capabilitiesFor(type: ExternalType): NormalizedEvent['metricType'][] {
  switch (type) {
    case 'sentry': return ['error_metrics'];
    case 'github-actions': return ['custom', 'error_metrics'];
    case 'posthog': return ['user_metrics', 'custom'];
    case 'betterstack': return ['uptime_metrics'];
    case 'vercel':
    default: return ['custom', 'error_metrics'];
  }
}

export function assertConfig(type: ExternalType, config: ExternalConfig): asserts config is ExternalConfig {
  const c = config as unknown as Record<string, unknown>;
  if (!c || typeof c !== 'object' || typeof c['token'] !== 'string' || !c['token']) {
    throw new Error('Connector credentials are invalid.');
  }
  if ((config as { provider: string }).provider !== type) throw new Error('Connector provider does not match its saved credentials.');
  if (type === 'sentry' && (config.provider !== 'sentry' || !config.organization || !config.project)) {
    throw new Error('Sentry organization and project are required.');
  }
  if (type === 'github-actions' && (config.provider !== 'github-actions' || !/^[\w.-]+\/[\w.-]+$/.test(config.repository))) {
    throw new Error('GitHub repository must use owner/name format.');
  }
}
