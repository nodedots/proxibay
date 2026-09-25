import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectorStatus, ConnectorType, MetricType, NormalizedEvent } from '../common/types';
import { Connector } from '../entities/connector.entity';
import { FirebaseConnector } from './providers/firebase.connector';
import { StripeConnector } from './providers/stripe.connector';
import { SupabaseConnector } from './providers/supabase.connector';
import { ExternalConnector } from './providers/external.connector';
import { ExternalFetch } from './providers/external-fetch';
import { ExternalType, capabilitiesFor } from './providers/external-config';

export const EXTERNAL: ConnectorType[] = ['sentry', 'github-actions', 'posthog', 'betterstack', 'vercel'];

/** Connector registry — Nest provider glue around the ported connector logic. */
@Injectable()
export class ConnectorsRegistry {
  constructor(
    private readonly firebase: FirebaseConnector,
    private readonly stripe: StripeConnector,
    private readonly supabase: SupabaseConnector,
    private readonly external: ExternalConnector,
    private readonly externalFetch: ExternalFetch,
    @InjectRepository(Connector) private readonly repo: Repository<Connector>,
  ) {}

  capabilitiesFor(type: ConnectorType): MetricType[] {
    switch (type) {
      case 'firebase': return [...this.firebase.capabilities];
      case 'stripe': return [...this.stripe.capabilities];
      case 'supabase': return [...this.supabase.capabilities];
      case 'generic-webhook': return [];
      default: return capabilitiesFor(type as ExternalType);
    }
  }

  async healthCheck(type: ConnectorType, credentialsEnc: string): Promise<{ ok: boolean; detail: string }> {
    switch (type) {
      case 'firebase': return this.firebase.healthCheck(credentialsEnc);
      case 'stripe': return this.stripe.healthCheck(credentialsEnc);
      case 'supabase': return this.supabase.healthCheck(credentialsEnc);
      case 'generic-webhook': return { ok: true, detail: 'Webhook flips pending → connected on first verified event.' };
      default: return this.external.healthCheck(type as ExternalType, credentialsEnc);
    }
  }

  async pollConnector(conn: Connector, now = new Date()): Promise<NormalizedEvent[]> {
    const since = conn.lastFetchedAt ?? new Date(now.getTime() - 86400000);
    switch (conn.type) {
      case 'firebase':
        return this.firebase.fetchMetrics(conn.credentialsEnc, conn.projectId, conn.id, since);
      case 'stripe':
        return this.stripe.reconcile(conn.credentialsEnc, conn.projectId, conn.id);
      case 'supabase':
        return this.supabase.fetchMetrics(conn.credentialsEnc, conn.projectId, conn.id, since);
      case 'generic-webhook':
        return [];
      default:
        return this.externalFetch.fetchMetrics(conn.type as ExternalType, conn.credentialsEnc, conn.projectId, conn.id);
    }
  }

  async markFetched(id: string, ok: boolean, detail?: string) {
    const patch: Partial<Connector> = ok
      ? { status: 'connected' as ConnectorStatus, lastError: null, lastFetchedAt: new Date(), lastHealthCheck: new Date() }
      : { status: 'error' as ConnectorStatus, lastError: detail ?? 'Automatic sync failed. Check the provider connection and permissions.' };
    await this.repo.update({ id }, patch);
  }
}

