import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

/** Pricing: free during early access. Exists as a page, not priced out yet. */
export default function Pricing() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav active="pricing" />

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10 text-center">
        <p className="badge badge-success">Early access</p>
        <h1 className="mt-4 font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Free <span className="text-coral-emphasis">for now.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-body-lg text-slate">
          Simple pricing is coming. Until then, everything Proxibay does is free —
          every project, every connector, every alert.
        </p>

        <div className="card mt-10 text-left">
          <h2 className="font-inter text-subheading font-semibold">What's included</h2>
          <ul className="mt-3 flex flex-col gap-2 text-body text-graphite">
            <li>· Unlimited projects in your portfolio</li>
            <li>· Firebase and webhook connectors</li>
            <li>· Metric charts and history</li>
            <li>· Threshold alerts by email and webhook</li>
          </ul>
        </div>
        <p className="mt-6 text-body-sm text-slate">
          When paid plans arrive, early users will keep a free tier that covers
          small portfolios. No surprises.
        </p>
        <Link to="/signin" className="btn-primary mt-8 inline-block">
          Add your first project
        </Link>
      </main>

      <SiteFooter />
    </div>
  )
}
