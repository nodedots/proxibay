import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../common/audit.service';
import { CredentialsService } from '../credentials/credentials.service';
import { StripeConnector } from '../connectors/providers/stripe.connector';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';

/** Stripe signature guard: Stripe-Signature check with 5-min tolerance. */
@Injectable()
export class StripeGuard implements CanActivate {
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
      stripe?: { connector: Connector; projectId: string };
    }>();
    const signature = req.headers['stripe-signature'] ?? '';
    if (!signature || !Buffer.isBuffer(req.body)) {
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Missing Stripe-Signature header.' } });
    }
    const conn = await this.connectors.findOne({ where: { id: req.params.connectorId } });
    if (!conn || conn.type !== 'stripe') {
      throw new UnauthorizedException({ error: { code: 'unknown_connector', message: 'Unknown connector.' } });
    }
    const project = await this.projects.findOne({ where: { id: conn.projectId } });
    if (!project || project.status === 'archived' || conn.status === 'error') {
      throw new UnauthorizedException({ error: { code: 'connector_disabled', message: 'Connector disabled.' } });
    }
    let webhookSecret: string | undefined;
    try {
      webhookSecret = (JSON.parse(this.creds.decrypt(conn.credentialsEnc)) as { webhookSecret?: string }).webhookSecret;
    } catch {
      webhookSecret = undefined;
    }
    if (!webhookSecret) {
      throw new UnauthorizedException({ error: { code: 'invalid_argument', message: 'No webhook secret saved on this connector — push is not configured (poll still runs).' } });
    }
    if (!StripeConnector.verifySignature(req.body, webhookSecret, signature)) {
      this.audit.event('connector.ingest.rejected', {
        connector_id: conn.id, project_id: conn.projectId, reason: 'stripe_signature',
      });
      throw new UnauthorizedException({ error: { code: 'bad_signature', message: 'Signature mismatch. Check the endpoint secret matches Stripe’s dashboard.' } });
    }
    req.stripe = { connector: conn, projectId: conn.projectId };
    return true;
  }
}
