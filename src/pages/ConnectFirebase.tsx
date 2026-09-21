import { Link } from 'react-router-dom'
import { GuideShell, Step, Path, Trouble } from '../components/ConnectDocs'

/** Firebase service-account key: where it comes from, how to lock it down. */
export default function ConnectFirebase() {
  return (
    <GuideShell
      badge="Connection guide · Firebase"
      title={<>Firebase: the <span className="text-coral-emphasis">service-account key.</span></>}
      intro="A service account is like a read-only username your Firebase project issues for tools like Proxibay. It arrives as a JSON file — you paste its contents into Proxibay once, and we use it to count users and read error logs. We never write or delete anything with it."
    >
      <div className="mt-8 flex flex-col gap-8">
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
            Firebase connector box — or use the <strong>Upload JSON file</strong> button to
            load it straight from disk. Proxibay runs a <strong>health check on the spot</strong> —
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
      <h2 className="mt-12 font-inter text-heading-sm font-semibold">If something fails</h2>
      <div className="mt-4 flex flex-col gap-3">
        <Trouble title="Health check fails">
          The key is pasted incompletely, belongs to a different project, or its roles were
          trimmed too far (it needs the two read roles above). The error message says which —
          fix that and retry in place.
        </Trouble>
        <Trouble title="Connected, but no data yet">
          Polling runs about every 30 minutes — give it one full cycle before worrying.
        </Trouble>
      </div>
      <p className="mt-8 text-body-sm text-slate">
        Connecting something else? <Link to="/learn/connect" className="text-link-emphasis text-link">All connection guides →</Link>
      </p>
    </GuideShell>
  )
}
