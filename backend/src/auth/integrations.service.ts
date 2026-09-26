import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

export interface ImportItem {
  key: string;
  name: string;
  subtitle: string;
  url?: string;
  externalId?: string;
}

/**
 * Import listing proxies (cutover replacement for the client-side provider
 * calls in lib/oauth.ts). Uses the encrypted provider token stored by the
 * import-time OAuth flow — the raw token never leaves the server.
 */
@Injectable()
export class IntegrationsService {
  constructor(private readonly auth: AuthService) {}

  private async token(userId: string, provider: 'github' | 'google'): Promise<string> {
    const t = await this.auth.readIntegrationToken(userId, provider);
    if (!t) {
      throw new UnauthorizedException({
        error: { code: 'no_integration', message: 'Connect that provider for import first.' },
      });
    }
    return t;
  }

  /** GET /user/repos, paginated via Link headers → picker items. */
  async githubRepos(userId: string): Promise<ImportItem[]> {
    const token = await this.token(userId, 'github');
    const items: ImportItem[] = [];
    let url: string | null = 'https://api.github.com/user/repos?per_page=100&sort=updated';
    for (let pages = 0; pages < 20 && url; pages++) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) throw new UnauthorizedException({
        error: { code: 'integration_expired', message: 'That provider connection expired — reconnect it and try again.' },
      });
      if (!res.ok) throw new UnauthorizedException({
        error: { code: 'integration_failed', message: 'Could not list repositories right now.' },
      });
      const repos = (await res.json()) as Array<{
        id: number; name: string; html_url: string; private: boolean; pushed_at: string | null;
      }>;
      for (const r of repos) {
        items.push({
          key: `gh-${r.id}`,
          name: r.name,
          subtitle: `${r.private ? 'Private' : 'Public'} · pushed ${r.pushed_at ? r.pushed_at.slice(0, 10) : 'never'}`,
          url: r.html_url,
        });
      }
      const link = res.headers.get('link') ?? '';
      url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return items;
  }

  /** Cloud Resource Manager projects.list, paginated → picker items. */
  async gcpProjects(userId: string): Promise<ImportItem[]> {
    const token = await this.token(userId, 'google');
    const items: ImportItem[] = [];
    let pageToken = '';
    for (let pages = 0; pages < 10; pages++) {
      const url =
        'https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=200' +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 401) throw new UnauthorizedException({
        error: { code: 'integration_expired', message: 'That provider connection expired — reconnect it and try again.' },
      });
      if (!res.ok) throw new UnauthorizedException({
        error: { code: 'integration_failed', message: 'Could not list Google Cloud projects right now.' },
      });
      const data = (await res.json()) as {
        projects?: Array<{ projectId: string; name: string; projectNumber: string; lifecycleState?: string }>;
        nextPageToken?: string;
      };
      for (const p of data.projects ?? []) {
        if (p.lifecycleState && p.lifecycleState !== 'ACTIVE') continue;
        items.push({
          key: `gcp-${p.projectId}`,
          name: p.name || p.projectId,
          subtitle: `GCP project ${p.projectId} · #${p.projectNumber}`,
          externalId: p.projectId,
        });
      }
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }
    return items;
  }
}
