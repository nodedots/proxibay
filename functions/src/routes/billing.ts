import { Router } from 'express'
import { Kelviq, environmentFromEnv, validateEvent, WebhookVerificationError } from '@kelviq/node-sdk'
import { getAuth } from 'firebase-admin/auth'
import { AuthedRequest, err } from '../auth.js'

/**
 * Kelviq (merchant of record) billing — sandbox until go-live.
 * All secrets server-side only. customerId is ALWAYS the Firebase UID from
 * the verified ID token, never a request field.
 */

type Period = 'monthly' | 'yearly'

const MONTHLY_PER_SEAT = 9.99
const YEARLY_DISCOUNT = 0.1
const YEARLY_PER_SEAT = Math.round(MONTHLY_PER_SEAT * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100 // 107.89
const SEATS_FEATURE = process.env.KELVIQ_SEATS_FEATURE_ID ?? 'seats'

interface PlanOffer {
  tier: 'pro'
  period: Period
  perSeat: number
  identifier: string
  offered: boolean
}

function planOffers(): PlanOffer[] {
  return [
    {
      tier: 'pro',
      period: 'monthly',
      perSeat: MONTHLY_PER_SEAT,
      identifier: process.env.KELVIQ_PLAN_PRO_MONTHLY ?? '',
      offered: !!(process.env.KELVIQ_PLAN_PRO_MONTHLY ?? '').trim(),
    },
    {
      tier: 'pro',
      period: 'yearly',
      perSeat: YEARLY_PER_SEAT,
      identifier: process.env.KELVIQ_PLAN_PRO_YEARLY ?? '',
      offered: !!(process.env.KELVIQ_PLAN_PRO_YEARLY ?? '').trim(),
    },
  ]
}

let client: Kelviq | null = null

function kelviq(): Kelviq {
  if (client) return client
  const key = (process.env.KELVIQ_SERVER_API_KEY ?? '').trim()
  if (!key) throw new Error('KELVIQ_SERVER_API_KEY is not set')
  client = new Kelviq({ accessToken: key, environment: environmentFromEnv(process.env.KELVIQ_ENV) })
  return client
}

function appUrl(): string {
  const base = (process.env.PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '')
  if (!base) throw new Error('PUBLIC_APP_URL is not set')
  return base
}

/** Fail-closed entitlement check for later gates (unused by routes yet). */
export async function hasFeature(customerId: string, featureId: string): Promise<boolean> {
  try {
    return await kelviq().entitlements.hasAccess({ customerId, featureId })
  } catch (e) {
    console.error(`entitlement check failed ${customerId}/${featureId}`, e)
    return false
  }
}

async function ensureCustomer(uid: string): Promise<string> {
  const user = await getAuth().getUser(uid)
  if (!user.email) throw new Error('no-email')
  try {
    await kelviq().customers.create({ customerId: uid, email: user.email })
  } catch (e) {
    // Already exists (or race) — checkout/portal work either way.
    console.error(`customer ensure ${uid}`, e instanceof Error ? e.message : e)
  }
  return user.email
}

export const billingRouter = Router()

/** GET /v1/billing/plans — PUBLIC display catalog (no identifiers leak). */
billingRouter.get('/plans', (_req, res) => {
  const offers = planOffers().map(({ tier, period, perSeat, offered }) => ({ tier, period, perSeat, offered }))
  return res.json({
    currency: 'USD',
    seatFeature: SEATS_FEATURE,
    teamsNote: 'Teams/Enterprise plans are coming soon.',
    plans: offers,
  })
})

/** POST /v1/billing/checkout {tier, period, seats?} → {checkoutUrl}. */
billingRouter.post('/checkout', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const { tier, period, seats } = (req.body ?? {}) as { tier?: string; period?: string; seats?: number }
  const offer = planOffers().find((o) => o.tier === tier && o.period === period)
  if (!offer) return err(res, 400, 'invalid_argument', 'Unknown plan or period.')
  if (!offer.offered) {
    return err(res, 409, 'plan-not-published', 'This plan isn’t on sale yet. Everything is free during early access.')
  }
  const quantity = seats === undefined ? 1 : Math.max(1, Math.floor(Number(seats) || 1))
  try {
    await ensureCustomer(uid)
    const session = await kelviq().checkout.createSession({
      planIdentifier: offer.identifier,
      chargePeriod: period === 'monthly' ? 'MONTHLY' : 'YEARLY',
      customerId: uid,
      successUrl: `${appUrl()}/billing/success`,
      features: [{ identifier: SEATS_FEATURE, quantity }],
    })
    return res.json({ checkoutUrl: session.checkoutUrl })
  } catch (e) {
    console.error(`checkout ${uid}/${tier}/${period}`, e instanceof Error ? e.message : e)
    return err(res, 500, 'internal', 'Couldn’t start checkout. Try again in a minute.')
  }
})

/** POST /v1/billing/portal → {portalUrl}. Handles the no-email 400, never 500s it. */
billingRouter.post('/portal', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  try {
    const session = await kelviq().portal.createSession({ customerId: uid })
    return res.json({ portalUrl: `${session.customerPortalUrl}?token=${session.token}` })
  } catch {
    // Most likely cause: Kelviq has no customer record with an email yet.
    try {
      await ensureCustomer(uid)
      const retry = await kelviq().portal.createSession({ customerId: uid })
      return res.json({ portalUrl: `${retry.customerPortalUrl}?token=${retry.token}` })
    } catch (second) {
      if (second instanceof Error && second.message === 'no-email') {
        return err(res, 400, 'no-email', 'Your account has no email address, so there’s no billing portal to open.')
      }
      console.error(`portal ${uid} (retry)`, second instanceof Error ? second.message : second)
      return err(res, 400, 'portal-unavailable', 'Billing portal isn’t available for this account yet.')
    }
  }
})

/** Seen event IDs (single-instance; move to Redis/a store before scaling out). */
const seenEvents = new Set<string>()

export const billingWebhookRouter = Router()

/**
 * POST /v1/billing/webhooks — PUBLIC, Kelviq-signature-gated.
 * Raw body required. 403 on bad signature, 200 + TODOs otherwise.
 */
billingWebhookRouter.post('/', async (req, res) => {
  const secret = (process.env.KELVIQ_WEBHOOK_SECRET ?? '').trim()
  if (!secret) {
    console.error('KELVIQ_WEBHOOK_SECRET is not set')
    return err(res, 500, 'internal', 'Billing webhooks are not configured.')
  }
  const raw = req.body as Buffer
  let event: Record<string, unknown>
  try {
    event = validateEvent(raw, req.headers as Record<string, string | undefined>, secret)
  } catch (e) {
    if (e instanceof WebhookVerificationError) return err(res, 403, 'bad_signature', 'Invalid webhook signature.')
    return err(res, 400, 'invalid_event', 'Malformed webhook payload.')
  }
  const id = [event.id, event.event_id, event.eventId].find((v) => typeof v === 'string') as string | undefined
  if (id) {
    if (seenEvents.has(id)) return res.json({ received: true, duplicate: true })
    seenEvents.add(id)
  }
  const type = typeof event.type === 'string' ? event.type : 'unknown'
  switch (type) {
    case 'checkout.completed':
      // TODO: confirm provisioning trigger (plan → projects/entitlements sync).
      break
    case 'invoice.payment_failed':
      // TODO: failed-renewal handling (notify user, grace window).
      break
    case 'subscription.created':
      // TODO: record active subscription start.
      break
    case 'subscription.updated':
      // TODO: apply seat/plan changes.
      break
    case 'subscription.plan_changed':
      // TODO: apply tier/period change.
      break
    case 'subscription.cancelled':
      // TODO: end-of-subscription cleanup (fires when it actually ends, not on schedule).
      break
    default:
      break
  }
  console.log(`kelviq webhook ${type} ${id ?? 'no-id'} — logged, no handler yet`)
  return res.json({ received: true })
})
