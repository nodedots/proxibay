import { ArrowRight, CreditCard, Database, Radio } from 'lucide-react'

export type ConnectableType = 'firebase' | 'stripe' | 'supabase' | 'generic-webhook'

interface CatalogItem {
  key: string
  name: string
  blurb: string
  state: 'live' | 'soon'
  type?: ConnectableType
}

interface CatalogGroup {
  title: string
  blurb: string
  items: CatalogItem[]
}

const GROUPS: CatalogGroup[] = [
  {
    title: 'Database',
    blurb: 'Where your users and app data live.',
    items: [
      { key: 'firebase', name: 'Firebase', blurb: 'Auth users and error logs.', state: 'live', type: 'firebase' },
      { key: 'supabase', name: 'Supabase', blurb: 'Users, signups and active users.', state: 'live', type: 'supabase' },
      { key: 'postgres', name: 'Postgres', blurb: 'Direct database metrics.', state: 'soon' },
      { key: 'more-db', name: 'More databases', blurb: 'Tell us what you run.', state: 'soon' },
    ],
  },
  {
    title: 'Revenue',
    blurb: 'Where the money moves.',
    items: [
      { key: 'stripe', name: 'Stripe', blurb: 'Charges, payouts and revenue.', state: 'live', type: 'stripe' },
      { key: 'flutterwave', name: 'Flutterwave', blurb: 'Collections and payouts.', state: 'soon' },
      { key: 'paystack', name: 'Paystack', blurb: 'Paystack collections and payouts.', state: 'soon' },
      { key: 'more-rev', name: 'More providers', blurb: 'Tell us who processes your payments.', state: 'soon' },
    ],
  },
  {
    title: 'Webhooks',
    blurb: 'Anything else, on your terms.',
    items: [
      { key: 'generic-webhook', name: 'Generic Webhook', blurb: 'Send signed events from your backend.', state: 'live', type: 'generic-webhook' },
    ],
  },
]

const ICONS = {
  firebase: Database,
  supabase: Database,
  stripe: CreditCard,
  'generic-webhook': Radio,
}

/** Compact connector chooser shared by project setup and project details. */
export default function ConnectorPicker(props: {
  connectedTypes: string[]
  onSelect: (type: ConnectableType) => void
}) {
  const available = GROUPS.flatMap((group) => group.items.filter((item) => item.state === 'live'))
  const comingSoon = GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.state === 'soon') }))
    .filter((group) => group.items.length > 0)

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h3 className="font-inter text-sm font-semibold text-ink">Available now</h3>
          <p className="mt-0.5 font-inter text-xs text-ink-muted">Choose a source to connect to this project.</p>
        </div>
        <span className="font-inter text-xs text-ink-muted">{available.length} connectors</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {available.map((item) => {
          const connected = !!item.type && props.connectedTypes.includes(item.type)
          const Icon = item.type ? ICONS[item.type] : Database
          return (
            <li key={item.key}>
              <button
                type="button"
                disabled={connected}
                onClick={() => item.type && props.onSelect(item.type)}
                className="flex min-h-[76px] w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-3 text-left transition-colors hover:border-line-strong hover:bg-inset disabled:cursor-default"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-inset text-ink-muted">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-inter text-sm font-semibold text-ink">{item.name}</span>
                  <span className="mt-0.5 block font-inter text-xs text-ink-muted">{item.blurb}</span>
                </span>
                {connected ? <span className="badge badge-success shrink-0">Connected</span> : <ArrowRight size={16} className="shrink-0 text-ink-muted" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
      <details className="mt-3 rounded-lg border border-line bg-surface px-3 py-2.5">
        <summary className="cursor-pointer list-none font-inter text-sm font-medium text-ink-muted marker:hidden">
          <span className="flex items-center justify-between">Coming soon <span className="text-xs">{comingSoon.reduce((sum, group) => sum + group.items.length, 0)} integrations</span></span>
        </summary>
        <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          {comingSoon.map((group) => (
            <div key={group.title}>
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">{group.title}</p>
              <ul className="mt-1 space-y-1">
                {group.items.map((item) => <li key={item.key} className="flex items-center justify-between gap-2 font-inter text-sm text-ink-secondary"><span>{item.name}</span><span className="text-xs text-ink-muted">Soon</span></li>)}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
