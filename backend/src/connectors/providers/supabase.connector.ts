import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../credentials/credentials.service';
import type { NormalizedEvent } from '../../common/types';

export interface SupabaseCredentials {
  url: string;
  serviceKey: string;
}

interface SupabaseAuthUser {
  id: string;
  created_at: string;
  last_sign_in_at: string | null;
}

/** Supabase connector port — user_metrics only (D24), 30d active window. */
@Injectable()
export class SupabaseConnector {
  readonly type = 'supabase' as const;
  readonly capabilities = ['user_metrics'] as const;
  readonly fetchMode = 'poll' as const;

  constructor(private readonly creds: CredentialsService) {}

  static normalizeUrl(raw: string): string | null {
    const trimmed = raw.trim().replace(/\/+$/, '');
    if (!/^https:\/\/[^/]+\.[^/]+/.test(trimmed)) return null;
    return trimmed;
  }

  private read(enc: string): SupabaseCredentials {
    return JSON.parse(this.creds.decrypt(enc)) as SupabaseCredentials;
  }

  private async adminListUsers(url: string, key: string, page: number, perPage: number): Promise<SupabaseAuthUser[]> {
    const res = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.status === 401 || res.status === 403) throw new Error('auth-denied');
    if (!res.ok) throw new Error(`Supabase API ${res.status}`);
    const data = (await res.json()) as { users?: SupabaseAuthUser[] } | SupabaseAuthUser[];
    return Array.isArray(data) ? data : (data.users ?? []);
  }

  async healthCheck(credentialsEnc: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const c = this.read(credentialsEnc);
      const url = c.url ? SupabaseConnector.normalizeUrl(c.url) : null;
      if (!url) return { ok: false, detail: 'That doesn’t look like a Supabase project URL (https://xyzcompany.supabase.co).' };
      if (!c.serviceKey || typeof c.serviceKey !== 'string') {
        return { ok: false, detail: 'Missing service-role key. Use the service_role secret, not the anon key.' };
      }
      try {
        await this.adminListUsers(url, c.serviceKey.trim(), 1, 1);
      } catch (e) {
        if (e instanceof Error && e.message === 'auth-denied') {
          return { ok: false, detail: 'Supabase rejected the key. You probably pasted the anon key — reconnect with the service_role secret.' };
        }
        throw e;
      }
      return { ok: true, detail: 'Admin user lookup succeeded — URL and service-role key are valid.' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'healthCheck failed' };
    }
  }

  static usersToEvents(
    users: SupabaseAuthUser[],
    projectId: string,
    connectorId: string,
    since: Date,
    now: Date,
    activeWindowDays = 30,
  ): NormalizedEvent[] {
    let total = 0;
    let signups = 0;
    let active = 0;
    const cutoff = now.getTime() - activeWindowDays * 86400000;
    for (const u of users) {
      total += 1;
      if (new Date(u.created_at) > since) signups += 1;
      if (u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() > cutoff) active += 1;
    }
    return [
      { projectId, connectorId, metricType: 'user_metrics', key: 'total_users', value: total, timestamp: now },
      { projectId, connectorId, metricType: 'user_metrics', key: 'signups', value: signups, timestamp: now },
      { projectId, connectorId, metricType: 'user_metrics', key: 'active_users', value: active, timestamp: now, metadata: { window: '30d', source: 'last_sign_in_at' } },
    ];
  }

  async fetchMetrics(credentialsEnc: string, projectId: string, connectorId: string, since: Date): Promise<NormalizedEvent[]> {
    const c = this.read(credentialsEnc);
    const url = SupabaseConnector.normalizeUrl(c.url) as string;
    const key = c.serviceKey.trim();
    const now = new Date();
    const all: SupabaseAuthUser[] = [];
    let page = 1;
    for (;;) {
      const users = await this.adminListUsers(url, key, page, 1000);
      if (users.length === 0) break;
      all.push(...users);
      if (users.length < 1000 || page >= 50) break;
      page += 1;
    }
    return SupabaseConnector.usersToEvents(all, projectId, connectorId, since, now);
  }
}
