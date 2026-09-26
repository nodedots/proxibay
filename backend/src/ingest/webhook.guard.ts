import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { CredentialsService } from '../credentials/credentials.service';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';

/**
 * Generic-webhook guard: verifies the timestamped HMAC
 * (X-Stackduck-Timestamp + X-Stackduck-Signature over `${t}.${body}`) with a
 * 5-minute window, then the stored secret, honoring the 24h rotation grace.
 * Attaches { connector, projectId } to the request.
 *
 * Order matters: the window check runs first (cheap, and refuses replayed
 * payloads even when the signature is still mathematically valid), the MAC
 * second. Only a MAC failure flips the connector to `error` — a stale
 * timestamp means a late or replayed sender, not a broken secret.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly creds: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      params: { connectorId: string };
      headers: Record<string, string | undefined>;
      body: Buffer;
      webhook?: { connector: Connector; projectId: string };
    }>();
    const signature = req.headers['x-stackduck-signature'] ?? req.headers['x-proxibay-signature'] ?? '';
    const timestamp = req.headers['x-stackduck-timestamp'];
    if (!signature || !Buffer.isBuffer(req.body)) {
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Missing X-Stackduck-Signature header.' } });
    }
    const conn = await this.connectors.findOne({ where: { id: req.params.connectorId } });
    if (!conn || conn.type !== 'generic-webhook') {
      throw new UnauthorizedException({ error: { code: 'unknown_connector', message: 'Unknown connector.' } });
    }

    // Window check first — before trusting any secret material.
    const windowCheck = CredentialsService.checkTimestampWindow(timestamp);
    if (windowCheck !== 'ok') {
      this.audit.event('connector.ingest.rejected', {
        connector_id: conn.id, project_id: conn.projectId, reason: windowCheck,
      });
      throw new UnauthorizedException({
        error: {
          code: windowCheck === 'missing_timestamp' ? 'timestamp_required' : 'stale_timestamp',
          message: windowCheck === 'missing_timestamp'
            ? 'Missing X-Stackduck-Timestamp header — sign `${timestamp}.${body}` with your signing secret.'
            : 'Timestamp outside the 5-minute window — rejected to prevent replay. Check your server clock and retry.',
        },
      });
    }

    const project = await this.projects.findOne({ where: { id: conn.projectId } });
    if (!project || project.status === 'archived' || conn.status === 'error') {
      throw new UnauthorizedException({ error: { code: 'connector_disabled', message: 'Connector disabled.' } });
    }

    let ok = false;
    try {
      ok = CredentialsService.verifyWebhookSignature(timestamp, req.body, this.creds.decrypt(conn.credentialsEnc), signature) === 'ok';
      if (!ok && conn.previousCredentialsEnc && conn.graceUntil && conn.graceUntil.getTime() > Date.now()) {
        ok = CredentialsService.verifyWebhookSignature(timestamp, req.body, this.creds.decrypt(conn.previousCredentialsEnc), signature) === 'ok';
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      this.audit.event('connector.ingest.rejected', {
        connector_id: conn.id, project_id: conn.projectId, reason: 'bad_signature',
      });
      await this.connectors.update({ id: conn.id }, { status: 'error' }).catch(() => undefined);
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Signature mismatch. Secret rotated without a code update?' } });
    }
    req.webhook = { connector: conn, projectId: conn.projectId };
    return true;
  }
}
