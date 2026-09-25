import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule } from '../entities/alert-rule.entity';
import { MetricsService } from '../metrics/metrics.service';

/**
 * Alert evaluation (Alerting Model §3–§5): scheduled every 5 minutes.
 * Sum for count-like keys, latest value for gauge-like keys. Cooldown
 * enforced via lastTriggeredAt + cooldownMinutes. Delivery: email is
 * logged (plug in SendGrid/etc. later); webhook POSTs JSON to the target.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);
  constructor(
    @InjectRepository(AlertRule) private readonly rules: Repository<AlertRule>,
    private readonly metrics: MetricsService,
  ) {}

  isGauge(metricType: string, key: string): boolean {
    return (
      /^(active_|total_|availability_|ready_|revenue_30d)/.test(key) ||
      ['availability_percent', 'active_deployments', 'in_progress_workflow_runs'].includes(key) ||
      metricType === 'uptime_metrics'
    );
  }

  async evaluateAll(now = new Date()): Promise<{ evaluated: number; triggered: number }> {
    const rules = await this.rules.find({ where: { status: 'active' } });
    let triggered = 0;
    for (const rule of rules) {
      try {
        if (await this.evaluateOne(rule, now)) triggered += 1;
      } catch (e) {
        this.logger.warn(`alert ${rule.id} failed: ${(e as Error).message}`);
      }
    }
    return { evaluated: rules.length, triggered };
  }

  async evaluateOne(rule: AlertRule, now = new Date()): Promise<boolean> {
    const since = new Date(now.getTime() - rule.windowMinutes * 60000);
    const agg = await this.metrics.windowAggregate(rule.projectId, rule.metricType, rule.key, since);
    const value = this.isGauge(rule.metricType, rule.key) ? agg.last : agg.sum;
    const fires = rule.condition === 'above' ? value > rule.threshold : value < rule.threshold;
    if (!fires) return false; // resolves silently (Alerting Model §4)
    if (rule.lastTriggeredAt && now.getTime() - rule.lastTriggeredAt.getTime() < rule.cooldownMinutes * 60000) {
      return false; // in cooldown
    }
    await this.deliver(rule, value);
    await this.rules.update({ id: rule.id }, { lastTriggeredAt: now });
    return true;
  }

  private async deliver(rule: AlertRule, value: number): Promise<void> {
    const payload = {
      ruleId: rule.id, projectId: rule.projectId,
      metricType: rule.metricType, key: rule.key,
      condition: rule.condition, threshold: rule.threshold,
      value, at: new Date().toISOString(),
    };
    if (rule.channel === 'webhook') {
      const res = await fetch(rule.channelTarget, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`webhook delivery ${res.status}`);
    } else {
      // v1: log email alerts; wire SendGrid/SES before Phase 4 cutover.
      this.logger.log(`EMAIL alert to ${rule.channelTarget}: ${JSON.stringify(payload)}`);
    }
  }
}
