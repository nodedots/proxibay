import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlertsService } from '../alerts/alerts.service';
import { ConnectorsRegistry } from '../connectors/connectors-registry.service';
import { Connector } from '../entities/connector.entity';
import { MetricsService } from '../metrics/metrics.service';
import { Project } from '../entities/project.entity';

/**
 * Scheduled jobs (@nestjs/schedule):
 * - Firebase / Supabase / external polling every 30 min (D7)
 * - Stripe reconciliation every 24h (D23)
 * - Alert evaluation every 5 min (Alerting Model §3)
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    @InjectRepository(Connector) private readonly connectors: Repository<Connector>,
    private readonly registry: ConnectorsRegistry,
    private readonly metrics: MetricsService,
    private readonly alerts: AlertsService,
  ) {}

  private async activeProjectIds(): Promise<string[]> {
    const rows = await this.projects.find({
      where: { status: In(['active', 'paused']) },
      select: ['id'],
    });
    return rows.map((r) => r.id);
  }

  private async pollTypes(types: Connector['type'][]) {
    const ids = await this.activeProjectIds();
    if (!ids.length) return { polled: 0, failed: 0 };
    let polled = 0;
    let failed = 0;
    for (const projectId of ids) {
      const conns = await this.connectors.find({ where: { projectId } });
      for (const conn of conns.filter((c) => types.includes(c.type))) {
        try {
          const events = await this.registry.pollConnector(conn);
          if (events.length) await this.metrics.writeEvents(events);
          await this.registry.markFetched(conn.id, true);
          polled += 1;
        } catch (e) {
          this.logger.warn(`poll failed ${projectId}/${conn.id}: ${(e as Error).message}`);
          await this.registry.markFetched(conn.id, false);
          failed += 1;
        }
      }
    }
    return { polled, failed };
  }

  @Cron('*/30 * * * *')
  async pollProviders() {
    const r = await this.pollTypes(['firebase', 'supabase', 'sentry', 'github-actions', 'posthog', 'betterstack', 'vercel']);
    this.logger.log(`provider poll: ${r.polled} ok, ${r.failed} failed`);
  }

  @Cron('0 2 * * *')
  async reconcileStripe() {
    const r = await this.pollTypes(['stripe']);
    this.logger.log(`stripe reconcile: ${r.polled} ok, ${r.failed} failed`);
  }

  @Cron('*/5 * * * *')
  async evaluateAlerts() {
    const r = await this.alerts.evaluateAll();
    if (r.triggered) this.logger.log(`alerts: ${r.evaluated} evaluated, ${r.triggered} triggered`);
  }
}
