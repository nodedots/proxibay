import { Link } from 'react-router-dom'
import { GuideShell, Trouble } from '../components/ConnectDocs'

const GUIDES = [
  {
    to: '/docs/connect/firebase',
    tag: 'Firebase',
    title: 'The service-account key',
    blurb: 'Generate a JSON key, lock it to read-only roles, paste it in. Health check runs on the spot.',
  },
  {
    to: '/docs/connect/stripe',
    tag: 'Stripe',
    title: 'The restricted key',
    blurb: 'Scoped to reading charges and payouts, verified instantly. Register the webhook for live events.',
  },
  {
    to: '/docs/connect/supabase',
    tag: 'Supabase',
    title: 'URL + service key',
    blurb: 'Project URL plus the service_role secret (never anon). Polls user totals, signups, and active users.',
  },
  {
    to: '/docs/connect/webhook',
    tag: 'Generic webhook',
    title: 'The signed webhook',
    blurb: 'A private URL plus a signing secret. Your backend signs each event; no SDKs, no agents.',
  },
]

/** Connection guide index: one card per connector, each with its own page. */
export default function ConnectGuide() {
  return (
    <GuideShell
      badge="Connection guide"
      title={<>Get your project <span className="text-coral-emphasis">plugged in.</span></>}
      intro="Every connector needs one thing from you before Proxibay can read it. Pick yours below — each guide is its own page, written assuming no cloud experience."
    >
      <div className="mt-8 flex flex-col gap-3">
        {GUIDES.map((g) => (
          <Link key={g.to} to={g.to} className="card card-hover">
            <p className="badge bg-paper-white">{g.tag}</p>
            <h2 className="mt-2 font-inter text-subheading font-semibold">{g.title}</h2>
            <p className="mt-1 text-body text-slate">{g.blurb}</p>
            <p className="text-link-emphasis text-link mt-2 text-sm">Read the guide →</p>
          </Link>
        ))}
      </div>
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="“Could not create” / connector won't generate">
          Proxibay couldn't reach its own services — usually you're offline or the request
          timed out. Check your connection and try again; nothing is half-created, so it's
          safe to retry. Each connector's own page covers what comes next.
        </Trouble>
      </div>
    </GuideShell>
  )
}
