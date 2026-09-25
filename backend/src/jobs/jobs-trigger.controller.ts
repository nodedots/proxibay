import { Controller, Post, UseGuards } from '@nestjs/common';
import { AlertsService } from '../alerts/alerts.service';
import { JobsService } from './jobs.service';
import { JobsTriggerGuard } from './jobs-trigger.guard';

/**
 * Manual job triggers for verification (staging/dev only — see guard).
 * Lets the shakedown assert "alert fires" and "cooldown blocks re-fire"
 * deterministically instead of waiting on the 5-minute cron twice.
 */
@Controller('v1/internal/jobs')
@UseGuards(JobsTriggerGuard)
export class JobsTriggerController {
  constructor(
    private readonly jobs: JobsService,
    private readonly alerts: AlertsService,
  ) {}

  @Post('poll-providers')
  async pollProviders() {
    await this.jobs.pollProviders();
    return { ok: true };
  }

  @Post('reconcile-stripe')
  async reconcileStripe() {
    await this.jobs.reconcileStripe();
    return { ok: true };
  }

  @Post('evaluate-alerts')
  async evaluateAlerts() {
    return this.alerts.evaluateAll();
  }
}
