import { Link } from 'react-router-dom'
import { GuideShell, Step, Code, Trouble } from '../components/ConnectDocs'

/** Generic webhook: generate URL + secret, sign events, watch it connect. */
export default function ConnectWebhook() {
  return (
    <GuideShell
      badge="Connection guide · Webhook"
      title={<>Any backend: the <span className="text-coral-emphasis">signed webhook.</span></>}
      intro="If your project isn't on Firebase, it can still report in: Proxibay gives that project a private ingest URL plus a signing secret. Your backend signs each event with the secret and posts it. The signature proves the event came from you — no login, no API keys in your code."
    >
      <div className="mt-8 flex flex-col gap-8">
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
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Events rejected (401)">
          Signature mismatch. The usual suspects: signing a pretty-printed body but sending
          a compact one (sign the exact bytes you send), an extra newline, or a rotated secret
          that never made it into your backend's environment.
        </Trouble>
        <Trouble title="Connector still “pending”">
          No verified event has arrived yet. Send the test event above and check the
          response code.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-slate">
        Connecting something else? <Link to="/docs/connect" className="text-link-emphasis text-link">All connection guides →</Link>
      </p>
    </GuideShell>
  )
}
