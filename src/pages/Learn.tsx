import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inkwell-navy font-inter text-base font-semibold text-paper-white">
        {n}
      </span>
      <div>
        <h3 className="font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-1 flex flex-col gap-2 text-body text-slate">{children}</div>
      </div>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-inter text-body font-semibold">{q}</h3>
      <div className="mt-1 text-body-sm text-slate">{children}</div>
    </div>
  )
}

/** Lightweight docs: quickstart, connectors at a glance, short FAQ. */
export default function Learn() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav active="learn" />

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <h1 className="font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Up and running <span className="text-coral-emphasis">in minutes.</span>
        </h1>
        <p className="mt-4 text-body-lg text-slate">
          Three steps. No agents to install, no code to rewrite.
        </p>

        <div className="mt-10 flex flex-col gap-8">
          <Step n="1" title="Add your project">
            <p>
              Give it a name — that's all it takes. Add descriptions, links, and tags
              whenever you like; nothing here gates the monitoring.
            </p>
          </Step>
          <Step n="2" title="Connect live data">
            <p>
              Pick a connector right after creating the project, or any time later from
              its page. Firebase connects with a service-account key and starts polling
              on its own. Any other backend pushes small signed events to a unique URL
              we generate for you — a few lines with any HTTP client.
            </p>
          </Step>
          <Step n="3" title="Read the portfolio">
            <p>
              Your home page becomes the morning check: every project a card, color-coded
              by health, key numbers on the front. Click through for charts and history.
              Set an alert threshold and you'll hear about breakage instead of finding it.
            </p>
          </Step>
        </div>

        <h2 className="mt-16 font-inter text-heading-sm font-semibold">Connectors at a glance</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Firebase</h3>
            <p className="mt-1 text-body-sm text-slate">
              Paste a service-account key. Proxibay checks the connection immediately,
              then polls user and error metrics on a schedule. Works best with read-only
              keys. <Link to="/learn/connect#firebase" className="text-link-emphasis text-link">Step-by-step key guide →</Link>
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Generic webhook</h3>
            <p className="mt-1 text-body-sm text-slate">
              For anything else — Express, Django, Rails, a cron job. We give you a URL
              and a signing secret; your backend signs each event and posts it. The
              connector flips to connected on the first verified event. <Link to="/learn/connect#webhook" className="text-link-emphasis text-link">Signing walkthrough →</Link>
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Stripe &amp; Supabase</h3>
            <p className="mt-1 text-body-sm text-slate">
              Payments and database connectors plug into the same model: revenue events
              from charges, user and error metrics from your database. If you run either,
              tell us which project needs it first.
            </p>
          </div>
        </div>

        <h2 className="mt-16 font-inter text-heading-sm font-semibold">Questions</h2>
        <div className="mt-4 flex flex-col gap-3">
          <Faq q="Do I have to change my project code?">
            <p>For Firebase: no. For other backends: a few lines to sign and post events to your ingest URL. No agents, no SDKs to install.</p>
          </Faq>
          <Faq q="What happens to the keys I paste in?">
            <p>Secrets go straight into a dedicated secret manager. The database keeps only a reference, never the secret itself. Rotate a key any time if you're unsure.</p>
          </Faq>
          <Faq q="Can I track projects for clients or a team?">
            <p>Accounts are single-owner right now: your projects, your logins. Sharing comes later.</p>
          </Faq>
          <Faq q="How much does it cost?">
            <p>Everything is free during early access. See <Link to="/pricing" className="text-link-emphasis text-link">Pricing</Link> for the plain version.</p>
          </Faq>
        </div>

        <div className="mt-10 text-center">
          <Link to="/signin" className="btn-primary inline-block">
            Add your first project
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
