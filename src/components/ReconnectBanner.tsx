import { useState } from 'react'

const MIGRATION_COPY: Record<string, string> = {
  firebase: 'Upload your service-account JSON again below — it takes about a minute.',
  stripe: 'Paste your restricted key again below (and the webhook secret if you use instant events).',
  supabase: 'Paste your project URL and service-role key again below.',
  'generic-webhook': 'A fresh signing secret is generated below — update the secret where your backend sends metrics.',
  default: 'Re-enter your credentials below — it only takes a minute.',
}

/** One-time post-migration moment: credentials never transferred, so reconnect reads as expected, not broken. */
export default function ReconnectBanner(props: {
  connectorType: string
  onReconnect: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const detail = MIGRATION_COPY[props.connectorType] ?? MIGRATION_COPY.default
  return (
    <div
      role="status"
      aria-label="Connector needs reconnecting after migration"
      className="mt-2 rounded-md border border-line bg-inset px-3 py-2"
    >
      <p className="text-sm font-medium text-ink">
        Reconnect your project — your credentials didn’t carry over during our move to the new backend.
      </p>
      <p className="mt-1 text-sm text-ink-muted">{detail} Your past data and alert rules are untouched.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="btn-primary px-3 py-1.5 text-sm" onClick={props.onReconnect}>
          Reconnect
        </button>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  )
}

/** Migration placeholder marker written by the Firestore→Postgres script. */
export function needsReconnect(lastError: string | undefined): boolean {
  return (lastError ?? '').startsWith('Migrated from Firestore')
}
