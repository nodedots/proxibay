import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { auth } from '../firebase'
import { getPlans, startCheckout, type PlanOffer } from '../lib/billing'

/** Pricing: free during early access, with Pro monthly/yearly waiting on published plans. */
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
    offers?.find((o) => o.period === period)?.price

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

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="pricing" />

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10 text-center">
        <p className="badge badge-success">Early access</p>
        <h1 className="mt-4 font-grifter text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Free <span className="text-coral-emphasis">for now.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-body-lg text-ink-muted">
          Simple pricing is coming. Until then, everything Stackduck does is free —
          every project, every connector, every alert.
        </p>

        <div className="card mt-10 text-left">
          <h2 className="font-inter text-subheading font-semibold">What's included</h2>
          <ul className="mt-3 flex flex-col gap-2 text-body text-ink-secondary">
            <li>· Unlimited projects in your portfolio</li>
            <li>· Firebase and webhook connectors</li>
            <li>· Metric charts and history</li>
            <li>· Threshold alerts by email and webhook</li>
          </ul>
        </div>
        <p className="mt-6 text-body-sm text-ink-muted">
          When paid plans arrive, early users will keep a free tier that covers
          small portfolios. No surprises.
        </p>

        <h2 className="mt-14 font-inter text-heading-sm font-semibold">Pro — flat rate</h2>
        <p className="mx-auto mt-2 max-w-lg text-body text-ink-muted">
          For portfolios that have outgrown the free tier. Same product, higher
          limits, priority support.
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
                    {amount !== undefined ? `$${amount.toFixed(2)}` : '$—'}
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
        {teamsNote ? (
          <p className="mt-4 text-body-sm text-ink-muted">{teamsNote}</p>
        ) : (
          <p className="mt-4 text-body-sm text-ink-muted">Teams and Enterprise plans are coming soon.</p>
        )}
        <Link to="/signin" className="btn-primary mt-8 inline-block">
          Add your first project
        </Link>
      </main>

      <SiteFooter />
    </div>
  )
}
