import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inkwell-navy font-inter text-base font-semibold text-paper-white">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-1 flex flex-col gap-2 text-body text-slate">{children}</div>
      </div>
    </div>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-inkwell-navy p-4 font-mono text-xs leading-relaxed text-paper-white">
      {children}
    </pre>
  )
}

function Path({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-paper-white px-3 py-2 font-inter text-sm font-medium text-inkwell-navy">{children}</p>
}

/**
 * Connection guide: where every credential Proxibay asks for comes from,
 * written for people who have never opened a cloud console before.
 */
export default function ConnectGuide() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav active="learn" />

      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <p className="badge bg-paper-white">Connection guide</p>
        <h1 className="mt-3 font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Get your project <span className="text-coral-emphasis">plugged in.</span>
        </h1>
        <p className="mt-4 text-body-lg text-slate">
          Every connector needs one thing from you before Proxibay can read it.
          Here's exactly where to find each one — no cloud experience assumed.
        </p>

        {/* FIREBASE */}
        <h2 id="firebase" className="mt-14 scroll-mt-6 font-inter text-heading-sm font-semibold">
          Firebase: the service-account key
        </h2>
        <p className="mt-2 text-body text-slate">
          A service account is like a read-only username your Firebase project issues
          for tools like Proxibay. It arrives as a <strong>JSON file</strong> — you paste
          its contents into Proxibay once, and we use it to count users and read error
          logs. We never write or delete anything with it.
        </p>
        <div className="mt-6 flex flex-col gap-8">
          <Step n="1" title="Open your Firebase project settings">
            <Path>console.firebase.google.com → your project → ⚙️ Project settings → Service accounts tab</Path>
            <p>Click <strong>Generate new private key</strong> and confirm. A JSON file downloads to your computer.</p>
          </Step>
          <Step n="2" title="Lock the key down to read-only (recommended)">
            <p>
              Fresh keys arrive with the powerful <strong>Editor</strong> role. Proxibay only
              reads, so shrink it: open{' '}
              <strong>console.cloud.google.com → IAM &amp; Admin → IAM</strong>, find the new
              service account in the list, edit its roles — remove Editor and add{' '}
              <strong>Firebase Authentication Admin</strong> (lets us list users) plus{' '}
              <strong>Logs Viewer</strong> (lets us read error logs). Nothing else is needed.
            </p>
          </Step>
          <Step n="3" title="Paste it into Proxibay">
            <p>
              Open the JSON file in any text editor, copy everything, and paste it into the
              Firebase connector box. Proxibay runs a <strong>health check on the spot</strong> —
              if the key works you'll see it connect immediately; if not, you'll get a plain
              explanation and can retry without losing your place.
            </p>
          </Step>
        </div>
        <div className="card mt-6">
          <h3 className="font-inter text-body font-semibold">Keep this key safe</h3>
          <ul className="mt-1 list-disc pl-5 text-body-sm text-slate">
            <li>Never commit the JSON file to git or paste it into a chat.</li>
            <li>Use one key per project, so you can revoke them independently.</li>
            <li>If a key ever leaks, delete it under the same Service accounts tab and generate a fresh one.</li>
          </ul>
        </div>

        {/* WEBHOOK */}
        <h2 id="webhook" className="mt-14 scroll-mt-6 font-inter text-heading-sm font-semibold">
          Any other backend: the signed webhook
        </h2>
        <p className="mt-2 text-body text-slate">
          If your project isn't on Firebase, it can still report in: Proxibay gives that
          project a <strong>private ingest URL</strong> plus a <strong>signing secret</strong>.
          Your backend signs each event with the secret and posts it. The signature proves
          the event came from you — no login, no API keys in your code.
        </p>
        <div className="mt-6 flex flex-col gap-8">
          <Step n="1" title="Generate the URL and secret in Proxibay">
            <p>
              On your project page, choose <strong>Generic Webhook → Generate URL + secret</strong>.
              Copy both somewhere safe — the <strong>secret is shown once</strong> and never again.
              (Lost it? You can rotate it from the same place; the old one keeps working for 24 hours
              while you update your backend.)
            </p>
          </Step>
          <Step n="2" title="Send a signed event from your backend">
            <p>
              Compute an HMAC-SHA256 signature of the raw request body with your secret, and send
              it in the <strong>X-Proxibay-Signature</strong> header. In Node.js:
            </p>
            <Code>{`const crypto = require('crypto');

const body = JSON.stringify({
  metricType: 'user_metrics',   // one of: user_metrics, error_metrics,
  key: 'signups',               //   revenue_metrics, uptime_metrics, custom
  value: 3,                     // must be a number
  // timestamp is optional — omitted means "right now"
});

const signature = crypto
  .createHmac('sha256', process.env.PROXIBAY_SIGNING_SECRET)
  .update(body)
  .digest('hex');

await fetch(process.env.PROXIBAY_INGEST_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Proxibay-Signature': signature,
  },
  body,
});`}</Code>
            <p>Quick test from a terminal (replace the placeholders):</p>
            <Code>{`BODY='{"metricType":"user_metrics","key":"signups","value":1}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$PROXIBAY_SIGNING_SECRET")
curl -X POST "$PROXIBAY_INGEST_URL" \\
  -H 'Content-Type: application/json' \\
  -H "X-Proxibay-Signature: $SIG" \\
  -d "$BODY"`}</Code>
          </Step>
          <Step n="3" title="Watch it flip to connected">
            <p>
              The connector starts as <strong>pending</strong> and flips to{' '}
              <strong>connected</strong> automatically when the first verified event arrives —
              no health check to run, no page to refresh. You can send up to 500 events per
              request as a JSON array; sustained traffic is capped at 60 requests a minute
              per connector (a retry loop gone wild gets a polite 429, not a bill shock).
            </p>
          </Step>
        </div>

        {/* TROUBLESHOOTING */}
        <h2 className="mt-14 font-inter text-heading-sm font-semibold">If something fails</h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="card">
            <h3 className="font-inter text-body font-semibold">“Could not create” / connector won't generate</h3>
            <p className="mt-1 text-body-sm text-slate">
              Proxibay couldn't reach its own services — usually you're offline or the request
              timed out. Check your connection and try again; nothing is half-created, so it's
              safe to retry.
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Firebase health check fails</h3>
            <p className="mt-1 text-body-sm text-slate">
              The key is pasted incompletely, belongs to a different project, or its roles were
              trimmed too far (it needs the two read roles above). The error message says which —
              fix that and retry in place.
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Webhook events rejected (401)</h3>
            <p className="mt-1 text-body-sm text-slate">
              Signature mismatch. The usual suspects: signing a pretty-printed body but sending
              a compact one (sign the exact bytes you send), an extra newline, or a rotated secret
              that never made it into your backend's environment.
            </p>
          </div>
          <div className="card">
            <h3 className="font-inter text-body font-semibold">Connector still “pending”</h3>
            <p className="mt-1 text-body-sm text-slate">
              No verified event has arrived yet. For Firebase, polling runs about every 30 minutes —
              give it one cycle. For webhooks, send the test event above and check the response code.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link to="/signin" className="btn-primary inline-block">
            Connect a project now
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
