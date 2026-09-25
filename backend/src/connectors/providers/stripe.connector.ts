import { Injectable } from '@nestjs/common';
import crypto from 'crypto';
import { CredentialsService } from '../../credentials/credentials.service';
import type { NormalizedEvent } from '../../common/types';

export interface StripeCredentials {
  apiKey: string;
  webhookSecret?: string;
}

const STRIPE_API = 'https://api.stripe.com/v1';
const basicAuth = (apiKey: string) => `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`;

async function stripeGet(apiKey: string, path: string): Promise<unknown> {
  const res = await fetch(`${STRIPE_API}${path}`, { headers: { Authorization: basicAuth(apiKey) } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Stripe API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** Stripe connector port — same normalization/capabilities/auth as functions/src/stripeConnector.ts. */
@Injectable()
export class StripeConnector {
  readonly type = 'stripe' as const;
  readonly capabilities = ['revenue_metrics'] as const;
  readonly fetchMode = 'both' as const;

  constructor(private readonly creds: CredentialsService) {}

  private read(enc: string): Partial<StripeCredentials> {
    return JSON.parse(this.creds.decrypt(enc)) as Partial<StripeCredentials>;
  }

  async healthCheck(credentialsEnc: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const c = this.read(credentialsEnc);
      if (!c.apiKey || typeof c.apiKey !== 'string') {
        return { ok: false, detail: 'Missing API key. Paste a restricted secret key from your Stripe dashboard.' };
      }
      await stripeGet(c.apiKey, '/balance');
      return { ok: true, detail: 'balance.retrieve() succeeded — key is valid and readable.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'healthCheck failed';
      if (/401/.test(msg)) {
        return { ok: false, detail: 'Stripe rejected the key (401). Check it wasn’t truncated and isn’t a publishable key.' };
      }
      return { ok: false, detail: msg };
    }
  }

  static verifySignature(rawBody: Buffer, webhookSecret: string, header: string): boolean {
    const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
    const t = Number(parts.t);
    const v1 = parts.v1 ?? '';
    if (!t || !v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
    const expected = crypto.createHmac('sha256', webhookSecret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(v1.trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  eventToNormalized(
    projectId: string,
    connectorId: string,
    now: Date,
    event: { id: string; type: string; data: { object: Record<string, unknown> } },
  ): NormalizedEvent[] {
    const obj = event.data.object;
    const currency = typeof obj.currency === 'string' ? obj.currency : undefined;
    const major = (cents: number) => Math.round((cents / 100) * 100) / 100;
    switch (event.type) {
      case 'charge.succeeded': {
        const amount = typeof obj.amount === 'number' ? obj.amount : 0;
        return [{ projectId, connectorId, metricType: 'revenue_metrics', key: 'transaction_volume', value: major(amount), timestamp: now, metadata: { ...(currency ? { currency } : {}), charge: String(obj.id ?? event.id) } }];
      }
      case 'charge.failed':
        return [{ projectId, connectorId, metricType: 'revenue_metrics', key: 'failed_payments', value: 1, timestamp: now, metadata: { ...(currency ? { currency } : {}), charge: String(obj.id ?? event.id) } }];
      case 'payout.paid': {
        const amount = typeof obj.amount === 'number' ? obj.amount : 0;
        return [{ projectId, connectorId, metricType: 'revenue_metrics', key: 'payout_volume', value: major(amount), timestamp: now, metadata: { ...(currency ? { currency } : {}), payout: String(obj.id ?? event.id) } }];
      }
      default:
        return [];
    }
  }

  async reconcile(credentialsEnc: string, projectId: string, connectorId: string): Promise<NormalizedEvent[]> {
    const c = this.read(credentialsEnc);
    if (!c.apiKey) throw new Error('missing api key');
    const now = new Date();
    const major = (cents: number) => Math.round((cents / 100) * 100) / 100;
    const since30d = Math.floor(Date.now() / 1000) - 30 * 86400;
    let revenue30d = 0;
    let startingAfter: string | undefined;
    for (let pages = 0; pages < 10; pages++) {
      const page = (await stripeGet(c.apiKey, `/charges?limit=100&created[gte]=${since30d}${startingAfter ? `&starting_after=${startingAfter}` : ''}`)) as {
        data: Array<{ id: string; amount: number; status: string }>;
        has_more: boolean;
      };
      for (const ch of page.data) if (ch.status === 'succeeded') revenue30d += ch.amount;
      if (!page.has_more || page.data.length === 0) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
    const failed = (await stripeGet(c.apiKey, `/charges?limit=100&created[gte]=${Math.floor(Date.now() / 1000) - 86400}`)) as { data: Array<{ status: string }> };
    return [
      { projectId, connectorId, metricType: 'revenue_metrics', key: 'revenue_30d', value: major(revenue30d), timestamp: now, metadata: { source: 'nightly-reconciliation' } },
      { projectId, connectorId, metricType: 'revenue_metrics', key: 'failed_24h', value: failed.data.filter((x) => x.status === 'failed').length, timestamp: now, metadata: { source: 'nightly-reconciliation' } },
    ];
  }
}
