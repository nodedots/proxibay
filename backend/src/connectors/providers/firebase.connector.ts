import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../credentials/credentials.service';
import type { NormalizedEvent } from '../../common/types';

interface ServiceAccountJson {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Firebase connector port — normalization logic, capability declarations,
 * and auth handling unchanged from functions/src/firebaseConnector.ts; only
 * the surrounding glue (secret access) moved to CredentialsService.
 */
@Injectable()
export class FirebaseConnector {
  readonly type = 'firebase' as const;
  readonly capabilities = ['user_metrics', 'error_metrics'] as const;
  readonly fetchMode = 'poll' as const;

  constructor(private readonly creds: CredentialsService) {}

  private readSecret(enc: string): ServiceAccountJson {
    return JSON.parse(this.creds.decrypt(enc)) as ServiceAccountJson;
  }

  async healthCheck(credentialsEnc: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const sa = this.readSecret(credentialsEnc);
      if (!sa.project_id || !sa.client_email || !sa.private_key) {
        return { ok: false, detail: 'Service account JSON is missing project_id, client_email or private_key.' };
      }
      const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
      const { getAuth } = await import('firebase-admin/auth');
      const name = `healthcheck-${Date.now()}`;
      const sub = initializeApp({ credential: cert(sa as never) }, name);
      try {
        await getAuth(sub).listUsers(1);
        return { ok: true, detail: 'listUsers(1) succeeded — service account has read access.' };
      } finally {
        await deleteApp(sub);
      }
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'healthCheck failed' };
    }
  }

  async fetchMetrics(
    credentialsEnc: string,
    projectId: string,
    connectorId: string,
    since: Date,
  ): Promise<NormalizedEvent[]> {
    const sa = this.readSecret(credentialsEnc);
    const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const name = `poll-${connectorId}-${Date.now()}`;
    const sub = initializeApp({ credential: cert(sa as never) }, name);
    const now = new Date();
    try {
      const auth = getAuth(sub);
      let total = 0;
      let signups = 0;
      let pageToken: string | undefined;
      do {
        const page = await auth.listUsers(1000, pageToken);
        for (const u of page.users) {
          total += 1;
          if (new Date(u.metadata.creationTime) > since) signups += 1;
        }
        pageToken = page.pageToken;
      } while (pageToken);
      const events: NormalizedEvent[] = [
        { projectId, connectorId, metricType: 'user_metrics', key: 'total_users', value: total, timestamp: now },
        { projectId, connectorId, metricType: 'user_metrics', key: 'signups', value: signups, timestamp: now },
      ];
      let errorCount = 0;
      let source = 'cloud-logging';
      try {
        errorCount = await this.queryLoggingErrorCount(sa, since);
      } catch {
        source = 'unavailable-logging-api';
      }
      events.push({
        projectId, connectorId, metricType: 'error_metrics', key: 'error_count',
        value: errorCount, timestamp: now, metadata: { source },
      });
      return events;
    } finally {
      await deleteApp(sub);
    }
  }

  private async queryLoggingErrorCount(sa: ServiceAccountJson, since: Date): Promise<number> {
    const { JWT } = await import('google-auth-library').catch(() => ({ JWT: null as never }));
    if (!JWT) throw new Error('google-auth-library not installed');
    const jwt = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/logging.read'],
    });
    const token = await jwt.getAccessToken();
    const accessToken = (token as { token?: string }).token ?? (token as unknown as string);
    const res = await fetch('https://logging.googleapis.com/v2/entries:list', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceNames: [`projects/${sa.project_id}`],
        filter: `severity>=ERROR timestamp>="${since.toISOString()}"`,
        pageSize: 1000,
      }),
    });
    if (!res.ok) throw new Error(`Logging API ${res.status}`);
    const data = (await res.json()) as { entries?: unknown[] };
    return data.entries?.length ?? 0;
  }
}
