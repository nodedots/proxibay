import { Link } from 'react-router-dom'

/** Post-checkout landing. Kelviq redirects here via successUrl. */
export default function BillingSuccess() {
  return (
    <div className="mx-auto mt-16 max-w-md pb-16">
      <div className="card text-center">
        <p className="badge badge-success">Payment successful</p>
        <h1 className="mt-3 font-inter text-2xl font-semibold text-ink">
          You’re on Pro.
        </h1>
        <p className="mt-2 font-inter text-sm text-ink-muted">
          Your subscription is active. It can take a minute for everything to
          sync — then manage it anytime from the billing portal.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/portfolio" className="btn-primary">
            Open portfolio
          </Link>
          <Link to="/pricing" className="btn-ghost">
            Back to pricing
          </Link>
        </div>
      </div>
    </div>
  )
}
