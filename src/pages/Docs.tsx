import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import { Code, LinkWithArrow } from '../components/ConnectDocs'

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-inter text-base font-semibold text-on-primary">
        {n}
      </span>
      <div>
        <h3 className="font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-1 flex flex-col gap-2 text-body text-ink-muted">{children}</div>
      </div>
    </div>
  )
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-inter text-body font-semibold">{q}</h3>
      <div className="mt-1 text-body-sm text-ink-muted">{children}</div>
    </div>
  )
}

/** Full documentation: concepts, quickstart, connectors, self-hosting, FAQ. */
export default function Docs() {
  // Client-side hash links (e.g. /docs#quickstart) don't auto-scroll under
  // plain routing, so scroll to the anchor on arrival.
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.querySelector(hash)?.scrollIntoView()
  }, [hash])

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="docs" />

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pb-28 sm:pt-20">
        <h1 className="font-display font-bold text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Up and running <span className="text-coral-emphasis">in minutes.</span>
        </h1>
        <p className="mt-4 text-body-lg text-ink-muted">
          Concepts first, then the three-step quickstart. No agents to install, no code to rewrite.
        </p>

        <nav aria-label="On this page" className="card mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">On this page</p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 font-inter text-sm font-medium">
            <a href="#concepts" className="text-link">Core concepts</a>
            <a href="#quickstart" className="text-link">Quickstart</a>
            <a href="#connectors" className="text-link">Connectors</a>
            <a href="#self-hosting" className="text-link">Self-hosting & contributing</a>
            <a href="#faq" className="text-link">Questions</a>
          </div>
        </nav>

        <h2 id="concepts" className="mt-14 scroll-mt-6 font-inter text-heading-sm font-semibold">Core concepts</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Project — your catalog entry</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              A project is the thing you run: a name plus whatever context you care about —
              description, stack tags, repo and live links, environment. Only the name is
              required. The catalog never gates monitoring; it's the label everything else hangs off.
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Connector — how data gets in</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              A connector authenticates against one of your backends and translates what it finds
              into a common shape. Poll connectors (Firebase, Stripe reconciliation, Supabase) fetch
              on a schedule; push connectors (generic webhook, Stripe events) receive data your
              systems send. Each one reports its own status — receiving updates, having trouble,
              or waiting for first data — independently of the project's status.
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Metric — what you actually read</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Every data point lands in one of five buckets: users, errors, revenue, uptime, or
              custom. Points are stored as daily aggregates per project, which is why a year of
              charts loads as fast as a week. Cards show the latest numbers; detail pages chart
              the history.
            </p>
          </div>
        </div>

        <h2 id="quickstart" className="mt-14 scroll-mt-6 font-inter text-heading-sm font-semibold">Quickstart</h2>

        <h3 className="mt-6 font-inter text-body font-semibold">Run your own copy</h3>
        <div className="mt-3 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            Everything below runs on your machine. You need Node 20+ and a Firebase
            project with Authentication, Firestore, and Functions enabled.
          </p>
        </div>
        <div className="mt-3">
          <Code>{`npx degit nodedots/stackduck my-stackduck
cd my-stackduck
npm install
cp .env.example .env   # paste your Firebase web config`}</Code>
        </div>
        <div className="mt-3 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            Then point the app at your Firebase project: create it in the{' '}
            <strong>Firebase console</strong>, enable <strong>Email/Password</strong>{' '}
            sign-in plus <strong>Firestore</strong>, and paste the web SDK config into{' '}
            <code>.env</code>. Run <code>firebase init</code> once and select Firestore
            + Hosting so deploys have somewhere to go, then:
          </p>
        </div>
        <div className="mt-3">
          <Code>{`npm run dev   # the whole UI on Auth + Firestore alone`}</Code>
        </div>

        <h3 className="mt-8 font-inter text-body font-semibold">Your first project</h3>
        <div className="mt-4 flex flex-col gap-8">
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

        <h2 id="connectors" className="mt-16 scroll-mt-6 font-inter text-heading-sm font-semibold">Connectors at a glance</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Firebase</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste a service-account key. Stackduck checks the connection immediately,
              then polls user and error metrics on a schedule. Works best with read-only
              keys. <Link to="/docs/connect/firebase" className="text-link-emphasis text-link">Step-by-step key guide →</Link>
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Generic webhook</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              For anything else — Express, Django, Rails, a cron job. We give you a URL
              and a signing secret; your backend signs each event and posts it. The
              connector flips to connected on the first verified event. <Link to="/docs/connect/webhook" className="text-link-emphasis text-link">Signing walkthrough →</Link>
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Stripe</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste a restricted secret key and Stackduck checks it on the spot. Register
              the endpoint URL we give you in your Stripe dashboard for instant charge and
              payout events — or skip it and get nightly revenue totals instead.{' '}
              <Link to="/docs/connect/stripe" className="text-link-emphasis text-link">Step-by-step key guide →</Link>
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Supabase</h3>
            <p className="mt-1 text-body-sm text-ink-muted">
              Paste your project URL plus the service_role secret and Stackduck checks it
              on the spot, then polls user totals, signups, and 30-day active users. The
              anon key can't list users, so the health check tells you immediately if you
              pasted the wrong one.{' '}
              <Link to="/docs/connect/supabase" className="text-link-emphasis text-link"><LinkWithArrow>Step-by-step key guide</LinkWithArrow></Link>
            </p>
          </div>
        </div>

        <h2 id="self-hosting" className="mt-16 scroll-mt-6 font-inter text-heading-sm font-semibold">Self-hosting & contributing</h2>
        <div className="mt-4 flex flex-col gap-3 text-body text-ink-muted">
          <p>
            Stackduck is MIT licensed and lives at{' '}
            <a
              href="https://github.com/nodedots/stackduck"
              target="_blank"
              rel="noreferrer"
              className="text-link-emphasis text-link"
            >
              github.com/nodedots/stackduck
            </a>
            . To run your own copy, follow <a href="#quickstart" className="text-link-emphasis text-link">Quickstart</a> above;
            a few notes that only matter once you're running it: deploying{' '}
            <code>functions/</code> needs the Blaze plan (Secret Manager + scheduled
            polling live there), while Auth + Firestore alone is enough to explore the
            whole UI. The API contract lives in <code>API_CONTRACT.md</code> and every
            open question gets logged in <code>DECISIONS.md</code>.
          </p>
          <p>
            Bugs and ideas belong in{' '}
            <a
              href="https://github.com/nodedots/stackduck/issues"
              target="_blank"
              rel="noreferrer"
              className="text-link-emphasis text-link"
            >
              GitHub Issues
            </a>
            , pull requests are welcome. A new connector is one file in{' '}
            <code>functions/src/*Connector.ts</code> plus a card in the Add flow — the
            existing four are the template.
          </p>
        </div>

        <h2 id="faq" className="mt-16 scroll-mt-6 font-inter text-heading-sm font-semibold">Questions</h2>        <div className="mt-4 flex flex-col gap-3">
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
