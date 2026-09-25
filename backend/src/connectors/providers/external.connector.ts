import { Injectable } from '@nestjs/common';
import { CredentialsService } from '../../credentials/credentials.service';
import type { NormalizedEvent } from '../../common/types';
import { ExternalConfig, ExternalType, assertConfig, posthogQuery, requestJson } from './external-config';

/** Port of functions/src/externalConnectors.ts — same normalization + auth. */
@Injectable()
export class ExternalConnector {
  constructor(private readonly creds: CredentialsService) {}

  private read(enc: string): ExternalConfig {
    return JSON.parse(this.creds.decrypt(enc)) as ExternalConfig;
  }

  async healthCheck(type: ExternalType, credentialsEnc: string): Promise<{ ok: boolean; detail: string }> {
    try {
      const config = this.read(credentialsEnc);
      assertConfig(type, config);
      if (type === 'sentry' && config.provider === 'sentry') {
        await requestJson(
          `https://sentry.io/api/0/projects/${encodeURIComponent(config.organization)}/${encodeURIComponent(config.project)}/`,
          config.token,
        );
      } else if (type === 'github-actions' && config.provider === 'github-actions') {
        await requestJson(`https://api.github.com/repos/${config.repository}`, config.token, { 'X-GitHub-Api-Version': '2022-11-28' });
      } else if (type === 'posthog' && config.provider === 'posthog') {
        await posthogQuery(config, 'SELECT 1');
      } else if (type === 'betterstack' && config.provider === 'betterstack') {
        await requestJson('https://uptime.betterstack.com/api/v2/monitors', config.token);
      } else if (type === 'vercel' && config.provider === 'vercel') {
        await requestJson('https://api.vercel.com/v2/user', config.token);
      }
      return { ok: true, detail: 'Provider connection check succeeded.' };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : 'healthCheck failed' };
    }
  }
}
