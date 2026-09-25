import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CredentialsService } from '../credentials/credentials.service';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';

/**
 * Generic-webhook HMAC guard: verifies X-Stackduck-Signature (or the legacy
 * X-Proxibay-Signature) against the stored secret, honoring the 24h rotation
 * grace window. Attaches { connector, projectId } to the request.
 */
@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    private readonly creds: CredentialsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      params: { connectorId: string };
      headers: Record<string, string | undefined>;
      body: Buffer;
      webhook?: { connector: Connector; projectId: string };
    }>();
    const signature = req.headers['x-stackduck-signature'] ?? req.headers['x-proxibay-signature'] ?? '';
    if (!signature || !Buffer.isBuffer(req.body)) {
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Missing X-Stackduck-Signature header.' } });
    }
    const conn = await this.connectors.findOne({ where: { id: req.params.connectorId } });
    if (!conn || conn.type !== 'generic-webhook') {
      throw new UnauthorizedException({ error: { code: 'unknown_connector', message: 'Unknown connector.' } });
    }
    const project = await this.projects.findOne({ where: { id: conn.projectId } });
    if (!project || project.status === 'archived' || conn.status === 'error') {
      throw new UnauthorizedException({ error: { code: 'connector_disabled', message: 'Connector disabled.' } });
    }
    let ok = false;
    try {
      ok = CredentialsService.verifyHmac(req.body, this.creds.decrypt(conn.credentialsEnc), signature);
      if (!ok && conn.previousCredentialsEnc && conn.graceUntil && conn.graceUntil.getTime() > Date.now()) {
        ok = CredentialsService.verifyHmac(req.body, this.creds.decrypt(conn.previousCredentialsEnc), signature);
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      await this.connectors.update({ id: conn.id }, { status: 'error' }).catch(() => undefined);
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Signature mismatch. Secret rotated without a code update?' } });
    }
    req.webhook = { connector: conn, projectId: conn.projectId };
    return true;
  }
}
