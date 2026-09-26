import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../common/audit.service';
import { err } from '../common/errors';
import { ConnectorType } from '../common/types';
import { CredentialsService } from '../credentials/credentials.service';
import { Connector } from '../entities/connector.entity';
import { Project } from '../entities/project.entity';
import { ConnectorsRegistry, EXTERNAL } from './connectors-registry.service';
import { SupabaseConnector } from './providers/supabase.connector';
import { ExternalBody, FirebaseBody, StripeBody, SupabaseBody, WebhookBody, newConnectorId } from './dto';

const EXTERNAL_SET = new Set<string>(EXTERNAL);

@Controller('v1/projects/:projectId/connectors')
@UseGuards(JwtAuthGuard)
export class ConnectorsController {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    private readonly registry: ConnectorsRegistry,
    private readonly creds: CredentialsService,
    private readonly audit: AuditService,
  ) {}

  async ownProject(userId: string, projectId: string): Promise<Project | null> {
    const p = await this.projects.findOne({ where: { id: projectId } });
    return p && p.ownerId === userId ? p : null;
  }

  sanitize(c: Connector) {
    const { credentialsEnc, previousCredentialsEnc, ...rest } = c;
    void credentialsEnc;
    void previousCredentialsEnc;
    return rest;
  }

  async create(
    userId: string, projectId: string, type: ConnectorType,
    authType: Connector['authType'], fetchMode: Connector['fetchMode'],
    secretPayload: string, pollInterval?: number,
  ) {
    const project = await this.ownProject(userId, projectId);
    if (!project) return err(404, 'not_found', 'Project not found.');
    const dup = await this.connectors.findOne({ where: { projectId, type } });
    if (dup) return err(409, 'duplicate_connector', `A ${type} connector already exists (1:1 in v1).`);
    const id = newConnectorId();
    const credentialsEnc = this.creds.encrypt(secretPayload);
    const healthCheck = await this.registry.healthCheck(type, credentialsEnc);
    const conn = await this.connectors.save(this.connectors.create({
      id, projectId, type, authType, fetchMode,
      capabilities: this.registry.capabilitiesFor(type),
      credentialsEnc,
      status: healthCheck.ok ? 'connected' : type === 'generic-webhook' ? 'pending' : 'error',
      lastError: healthCheck.ok ? null : healthCheck.detail,
      lastHealthCheck: new Date(),
      pollIntervalMinutes: pollInterval ?? 30,
    }));
    // Connection event only — credentials are never part of the log line.
    this.audit.event('connector.created', {
      connector_id: id, project_id: projectId, owner_id: userId, type,
      health: healthCheck.ok ? 'ok' : 'failed',
    });
    const base = process.env.PUBLIC_API_BASE ?? `http://localhost:${process.env.PORT ?? 3001}`;
    const extra = type === 'generic-webhook'
      ? { signingSecret: secretPayload, ingestUrl: `${base}/v1/ingest/${id}` }
      : type === 'stripe' ? { stripeEndpoint: `${base}/v1/stripe/${id}` } : {};
    if (!healthCheck.ok) {
      return { statusCode: 422 as const, body: { error: { code: 'connector_unhealthy', message: healthCheck.detail }, connector: this.sanitize(conn), healthCheck, ...extra } };
    }
    return { statusCode: 201 as const, body: { connector: this.sanitize(conn), healthCheck, ...extra } };
  }

  @Post('firebase')
  async firebase(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() body: FirebaseBody) {
    if (!body.serviceAccountJson || typeof body.serviceAccountJson !== 'object') {
      return err(400, 'invalid_argument', '"serviceAccountJson" object is required.');
    }
    const r = await this.create(req.user.userId, projectId, 'firebase', 'service_account', 'poll', JSON.stringify(body.serviceAccountJson), body.pollIntervalMinutes);
    return r.body;
  }

  @Post('supabase')
  async supabase(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() body: SupabaseBody) {
    const url = SupabaseConnector.normalizeUrl(body.url ?? '');
    if (!url) return err(400, 'invalid_argument', 'That doesn’t look like a Supabase project URL.');
    if (!body.serviceKey) return err(400, 'invalid_argument', 'Missing service-role key.');
    const p = JSON.stringify({ url, serviceKey: body.serviceKey.trim() });
    const r = await this.create(req.user.userId, projectId, 'supabase', 'api_key', 'poll', p, body.pollIntervalMinutes);
    return r.body;
  }

  @Post('stripe')
  async stripe(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() body: StripeBody) {
    if (!body.apiKey) return err(400, 'invalid_argument', 'Missing API key.');
    const pl = JSON.stringify({ apiKey: body.apiKey, ...(body.webhookSecret ? { webhookSecret: body.webhookSecret } : {}) });
    const r = await this.create(req.user.userId, projectId, 'stripe', 'api_key', 'both', pl, body.pollIntervalMinutes);
    return r.body;
  }

  @Post('generic-webhook')
  async webhook(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Body() body: WebhookBody) {
    const secret = CredentialsService.generateSigningSecret();
    const r = await this.create(req.user.userId, projectId, 'generic-webhook', 'none', 'push', secret, body.pollIntervalMinutes);
    return r.body;
  }

  @Post(':provider')
  async external(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Param('provider') provider: string, @Body() body: ExternalBody) {
    if (!EXTERNAL_SET.has(provider)) return err(404, 'not_found', 'Unknown connector provider.');
    if (!body.token) return err(400, 'invalid_argument', '"token" is required.');
    const payload = JSON.stringify({
      provider, token: body.token,
      ...(body.organization ? { organization: body.organization } : {}),
      ...(body.project ? { project: body.project } : {}),
      ...(body.repository ? { repository: body.repository } : {}),
      ...(body.projectId ? { projectId: body.projectId } : {}),
      ...(body.region ? { region: body.region } : {}),
      ...(body.monitorUrl ? { monitorUrl: body.monitorUrl } : {}),
      ...(body.teamId ? { teamId: body.teamId } : {}),
    });
    const r = await this.create(req.user.userId, projectId, provider as ConnectorType, 'api_key', 'poll', payload, body.pollIntervalMinutes);
    return r.body;
  }

  @Post(':connectorId/healthcheck')
  async healthcheck(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Param('connectorId') connectorIdParam: string) {
    const project = await this.ownProject(req.user.userId, projectId);
    if (!project) return err(404, 'not_found', 'Project not found.');
    const conn = await this.connectors.findOne({ where: { id: connectorIdParam, projectId } });
    if (!conn) return err(404, 'not_found', 'Connector not found.');
    if (conn.type === 'generic-webhook') {
      return err(400, 'invalid_argument', 'healthCheck is only callable for API-key/poll connectors.');
    }
    const healthCheck = await this.registry.healthCheck(conn.type, conn.credentialsEnc);
    this.audit.event('connector.healthcheck', {
      connector_id: conn.id, project_id: projectId, type: conn.type, ok: healthCheck.ok,
    });
    await this.connectors.update({ id: conn.id }, {
      status: healthCheck.ok ? 'connected' : 'error',
      lastError: healthCheck.ok ? null : healthCheck.detail, lastHealthCheck: new Date(),
    });
    const after = await this.connectors.findOneOrFail({ where: { id: conn.id } });
    return { connector: this.sanitize(after), healthCheck };
  }

  @Post(':connectorId/rotate-secret')
  async rotate(@Req() req: { user: { userId: string } }, @Param('projectId') projectId: string, @Param('connectorId') connectorIdParam: string) {
    const project = await this.ownProject(req.user.userId, projectId);
    if (!project) return err(404, 'not_found', 'Project not found.');
    const conn = await this.connectors.findOne({ where: { id: connectorIdParam, projectId } });
    if (!conn) return err(404, 'not_found', 'Connector not found.');
    if (conn.type !== 'generic-webhook') {
      return err(400, 'invalid_argument', 'Only webhook connectors have a signing secret.');
    }
    const newSecret = CredentialsService.generateSigningSecret();
    const graceUntil = new Date(Date.now() + 86400000);
    await this.connectors.update({ id: conn.id }, {
      previousCredentialsEnc: conn.credentialsEnc,
      credentialsEnc: this.creds.encrypt(newSecret), graceUntil,
    });
    this.audit.event('connector.secret_rotated', { connector_id: conn.id, project_id: projectId });
    return { signingSecret: newSecret, graceUntil: graceUntil.toISOString() };
  }
}

