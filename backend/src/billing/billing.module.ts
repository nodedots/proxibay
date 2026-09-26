import { Body, Controller, Get, Logger, Module, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsString } from 'class-validator';
import { Kelviq, environmentFromEnv, validateEvent, WebhookVerificationError } from '@kelviq/node-sdk';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from '../common/audit.service';
import { err } from '../common/errors';
import { User } from '../entities/user.entity';

type Period = 'monthly' | 'yearly';

const MONTHLY_PRICE = 9.99;
const YEARLY_PRICE = Math.round(MONTHLY_PRICE * 12 * 0.9 * 100) / 100; // 107.89

class CheckoutDto {
  @IsString() tier!: string;
  @IsIn(['monthly', 'yearly']) period!: Period;
}

/**
 * Kelviq (merchant of record) billing — sandbox until go-live. Port of
 * functions/src/routes/billing.ts. Secrets server-side only; customerId is
 * ALWAYS our users.id from the JWT, never a request field.
 */
@Controller('v1/billing')
export class BillingController {
  private readonly logger = new Logger(BillingController.name);
  private client: Kelviq | null = null;
  private readonly seenEvents = new Set<string>();

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private kelviq(): Kelviq {
    if (this.client) return this.client;
    const key = (this.config.get<string>('KELVIQ_SERVER_API_KEY') ?? '').trim();
    if (!key) throw new Error('KELVIQ_SERVER_API_KEY is not set');
    this.client = new Kelviq({ accessToken: key, environment: environmentFromEnv(this.config.get<string>('KELVIQ_ENV')) });
    return this.client;
  }

  private offers() {
    const monthly = (this.config.get<string>('KELVIQ_PLAN_PRO_MONTHLY') ?? '').trim();
    const yearly = (this.config.get<string>('KELVIQ_PLAN_PRO_YEARLY') ?? '').trim();
    return [
      { tier: 'pro', period: 'monthly' as Period, price: MONTHLY_PRICE, identifier: monthly, offered: !!monthly },
      { tier: 'pro', period: 'yearly' as Period, price: YEARLY_PRICE, identifier: yearly, offered: !!yearly },
    ];
  }

  private appUrl(): string {
    return (this.config.get<string>('PUBLIC_APP_URL') ?? '').trim().replace(/\/+$/, '');
  }

  private async ensureCustomer(userId: string): Promise<string> {
    const user = await this.users.findOneOrFail({ where: { id: userId } });
    if (!user.email) throw new Error('no-email');
    try {
      await this.kelviq().customers.create({ customerId: userId, email: user.email });
    } catch (e) {
      this.logger.warn(`customer ensure ${userId}: ${(e as Error).message}`);
    }
    return user.email;
  }

  /** GET /v1/billing/plans — PUBLIC display catalog (no identifiers leak). */
  @Get('plans')
  plans() {
    return {
      currency: 'USD',
      teamsNote: 'Teams/Enterprise plans are coming soon.',
      plans: this.offers().map(({ tier, period, price, offered }) => ({ tier, period, price, offered })),
    };
  }

  /** POST /v1/billing/checkout {tier, period} → {checkoutUrl}. */
  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async checkout(@Req() req: { user: { userId: string } }, @Body() dto: CheckoutDto) {
    const offer = this.offers().find((o) => o.tier === dto.tier && o.period === dto.period);
    if (!offer) return err(400, 'invalid_argument', 'Unknown plan or period.');
    if (!offer.offered) {
      return err(409, 'plan-not-published', 'This plan isn’t on sale yet. Everything is free during early access.');
    }
    try {
      await this.ensureCustomer(req.user.userId);
      const session = await this.kelviq().checkout.createSession({
        planIdentifier: offer.identifier,
        chargePeriod: dto.period === 'monthly' ? 'MONTHLY' : 'YEARLY',
        customerId: req.user.userId,
        successUrl: `${this.appUrl()}/billing/success`,
      });
      this.audit.event('billing.checkout.started', { user_id: req.user.userId, period: dto.period });
      return { checkoutUrl: session.checkoutUrl };
    } catch (e) {
      this.logger.error(`checkout ${req.user.userId}: ${(e as Error).message}`);
      return err(500, 'internal', 'Couldn’t start checkout. Try again in a minute.');
    }
  }

  /** POST /v1/billing/portal → {portalUrl}. Handles the no-email 400, never 500s it. */
  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async portal(@Req() req: { user: { userId: string } }) {
    try {
      const session = await this.kelviq().portal.createSession({ customerId: req.user.userId });
      return { portalUrl: `${session.customerPortalUrl}?token=${session.token}` };
    } catch {
      try {
        await this.ensureCustomer(req.user.userId);
        const retry = await this.kelviq().portal.createSession({ customerId: req.user.userId });
        return { portalUrl: `${retry.customerPortalUrl}?token=${retry.token}` };
      } catch (second) {
        if (second instanceof Error && second.message === 'no-email') {
          return err(400, 'no-email', 'Your account has no email address, so there’s no billing portal to open.');
        }
        this.logger.warn(`portal ${req.user.userId} (retry): ${(second as Error).message}`);
        return err(400, 'portal-unavailable', 'Billing portal isn’t available for this account yet.');
      }
    }
  }

  /**
   * POST /v1/billing/webhooks — PUBLIC, Kelviq-signature-gated. Raw body
   * required (main.ts wires express.raw for this route). 403 on bad
   * signature; event handlers are TODOs until provisioning is designed.
   */
  @Post('webhooks')
  async webhooks(@Req() req: { body: Buffer; headers: Record<string, string | undefined> }) {
    const secret = (this.config.get<string>('KELVIQ_WEBHOOK_SECRET') ?? '').trim();
    if (!secret) {
      this.logger.error('KELVIQ_WEBHOOK_SECRET is not set');
      return err(500, 'internal', 'Billing webhooks are not configured.');
    }
    if (!Buffer.isBuffer(req.body)) {
      return err(400, 'invalid_event', 'Malformed webhook payload.');
    }
    let event: Record<string, unknown>;
    try {
      event = validateEvent(req.body, req.headers as Record<string, string | undefined>, secret) as Record<string, unknown>;
    } catch (e) {
      if (e instanceof WebhookVerificationError) return err(403, 'bad_signature', 'Invalid webhook signature.');
      return err(400, 'invalid_event', 'Malformed webhook payload.');
    }
    const id = [event['id'], event['event_id'], event['eventId']].find((v) => typeof v === 'string') as string | undefined;
    if (id) {
      if (this.seenEvents.has(id)) return { received: true, duplicate: true };
      this.seenEvents.add(id);
    }
    const type = typeof event['type'] === 'string' ? event['type'] : 'unknown';
    this.audit.event('billing.webhook.received', { type, event_id: id ?? '-' });
    this.logger.log(`kelviq webhook ${type} ${id ?? 'no-id'} — logged, no handler yet`);
    return { received: true };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [BillingController],
})
export class BillingModule {}
