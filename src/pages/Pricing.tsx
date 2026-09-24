import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check as CheckIcon } from 'lucide-react'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { Reveal } from '../components/Reveal'
import { auth } from '../firebase'
import { getPlans, startCheckout, type PlanOffer } from '../lib/billing'

/** Intended prices, shown until the server publishes live ones. */
const FALLBACK_PRICES = { monthly: 9.99, yearly: 107.89 } as const

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="card text-left">
      <h3 className="font-inter text-body font-semibold">{q}</h3>
      <div className="mt-1 text-body-sm text-ink-muted">{children}</div>
    </div>
  )
}

function Check() {
  return <CheckIcon size={16} aria-hidden="true" className="inline-block" />
}

/** Pricing: free during early access, Pro flat-rate cards, comparison, FAQ. */
export default function Pricing() {
  const navigate = useNavigate()
  const [offers, setOffers] = useState<PlanOffer[] | null>(null)
  const [teamsNote, setTeamsNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'monthly' | 'yearly' | null>(null)

  useEffect(() => {
    void getPlans().then((r) => {
      setOffers(r.plans)
      setTeamsNote(r.teamsNote)
    })
  }, [])

  const offered = (period: 'monthly' | 'yearly') =>
    offers?.find((o) => o.period === period)?.offered ?? false
  const price = (period: 'monthly' | 'yearly') =>
    offers?.find((o) => o.period === period)?.price ?? FALLBACK_PRICES[period]

  async function upgrade(period: 'monthly' | 'yearly') {
    if (!auth.currentUser) {
      navigate('/signin')
      return
    }
    setError(null)
    setBusy(period)
    try {
      await startCheckout(period)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t start checkout. Try again in a minute.')
    } finally {
      setBusy(null)
    }
  }

  const rows: Array<{ label: string; free: string; pro: string }> = [
    { label: 'Price', free: '$0', pro: '$9.99/mo or $107.89/yr' },
    { label: 'Projects', free: 'Unlimited', pro: 'Unlimited' },
    { label: 'Connectors', free: 'All four', pro: 'All four' },
    { label: 'Charts & history', free: 'Full access', pro: 'Full access' },
    { label: 'Alerts', free: 'Email + webhook', pro: 'Email + webhook' },
    { label: 'Support', free: 'Community (Issues)', pro: 'Priority' },
  ]

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="pricing" />

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 text-center sm:pb-28 sm:pt-20">
        <p className="badge badge-success">Early access</p>
        <h1 className="mt-4 font-display font-bold text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Free <span className="text-coral-emphasis">for now.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-body-lg text-ink-muted">
          Everything Stackduck does is free during early access — every project,
          every connector, every alert. Pro switches on when paid plans publish.
        </p>

        <Reveal>
        <div className="card mt-10 text-left">
          <h2 className="font-inter text-subheading font-semibold">What's included free</h2>
          <ul className="mt-3 flex flex-col gap-2 text-body text-ink-secondary">
            <li>· Unlimited projects in your portfolio</li>
            <li>· Firebase, Stripe, Supabase + webhook connectors</li>
            <li>· Metric charts and history</li>
            <li>· Threshold alerts by email and webhook</li>
          </ul>
        </div>
        </Reveal>

        <Reveal delay={0.06}>
        <h2 className="mt-14 font-inter text-heading-sm font-semibold">Pro — flat rate</h2>
        <p className="mx-auto mt-2 max-w-lg text-body text-ink-muted">
          One price per account, not per seat. Same product, higher limits,
          priority support.
        </p>
        {error && (
          <p role="alert" className="mx-auto mt-4 max-w-lg font-inter text-sm text-coral-emphasis">
            {error}
          </p>
        )}
        <div className="mt-6 grid gap-4 text-left sm:grid-cols-2">
          {(['monthly', 'yearly'] as const).map((period) => {
            const isOffered = offered(period)
            const amount = price(period)
            return (
              <div key={period} className="card text-left">
                <h3 className="font-inter text-body font-semibold capitalize">{period}</h3>
                <p className="mt-1">
                  <span className="font-inter text-heading font-semibold">
                    ${amount.toFixed(2)}
                  </span>{' '}
                  <span className="font-inter text-sm text-ink-muted">
                    / {period === 'yearly' ? 'year' : 'month'}
                  </span>
                </p>
                {period === 'yearly' && (
                  <p className="badge badge-success mt-2">10% off vs monthly</p>
                )}
                <button
                  className="btn-primary mt-4 w-full"
                  disabled={!isOffered || busy !== null}
                  title={isOffered ? `Upgrade to Pro ${period}` : 'Coming soon — plans aren’t published yet'}
                  onClick={() => void upgrade(period)}
                >
                  {busy === period ? 'Starting checkout…' : isOffered ? `Upgrade ${period}` : 'Coming soon'}
                </button>
              </div>
            )
          })}
        </div>

        </Reveal>

        <Reveal delay={0.06}>
        <h2 className="mt-14 font-inter text-heading-sm font-semibold">Free vs Pro</h2>
        <div className="card mt-4 overflow-x-auto p-0 text-left">
          <table className="w-full min-w-[420px] border-collapse font-inter text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="p-4 text-left font-medium text-ink-muted" scope="col">
                  <span className="sr-only">Feature</span>
                </th>
                <th className="p-4 text-center font-semibold" scope="col">Free</th>
                <th className="p-4 text-center font-semibold" scope="col">Pro</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-0">
                  <th className="p-4 text-left font-medium text-ink" scope="row">{r.label}</th>
                  <td className="p-4 text-center text-ink-secondary">{r.free}</td>
                  <td className="p-4 text-center font-medium">{r.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 flex items-center justify-center gap-1 text-body-sm text-ink-muted">
          <span className="text-mint-pulse"><Check /></span>
          Early users keep a free tier that covers small portfolios. No surprises.
        </p>
        </Reveal>

        <Reveal delay={0.06}>
        <div className="card mt-10 bg-feature text-left">
          <h2 className="font-inter text-subheading font-semibold text-paper-white">Running a team?</h2>
          <p className="mt-2 text-body text-paper-white/70">
            {teamsNote || 'Teams and Enterprise plans — shared portfolios, per-seat pricing — are coming soon.'}
          </p>
          <Link to="/feedback" className="text-link-emphasis text-link mt-3 inline-block text-sm">
            Tell us what your team needs <ArrowRight size={14} className="ml-1 inline" aria-hidden="true" />
          </Link>
        </div>
        </Reveal>

        <Reveal delay={0.06}>
        <h2 className="mt-14 font-inter text-heading-sm font-semibold">Questions</h2>
        <div className="mt-4 flex flex-col gap-3 text-left">
          <Faq q="When will I actually be charged?">
            <p>Not yet. Checkout opens the moment plans publish — until then the buttons above stay on Coming soon and everything is free.</p>
          </Faq>
          <Faq q="What happens if I cancel Pro?">
            <p>You keep your account and all your data. Paid features switch off at the end of the billing period; your projects and history stay readable on the free tier.</p>
          </Faq>
          <Faq q="Can I switch between monthly and yearly?">
            <p>Yes — switch anytime from the billing portal. Yearly works out 10% cheaper than twelve monthly payments.</p>
          </Faq>
        </div>
        </Reveal>

        <Link to="/signin" className="btn-primary mt-10 inline-block">
          Add your first project
        </Link>
      </main>

      <SiteFooter />
    </div>
  )
}
