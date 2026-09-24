import { useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'

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
      { key: 'firebase', name: 'Firebase', blurb: 'Auth users + error logs, polled on a schedule.', state: 'live', type: 'firebase' },
      { key: 'supabase', name: 'Supabase', blurb: 'Auth users, signups, 30-day active users.', state: 'live', type: 'supabase' },
      { key: 'postgres', name: 'Postgres', blurb: 'Direct database metrics.', state: 'soon' },
      { key: 'more-db', name: 'More databases', blurb: 'Tell us what you run — the list grows with demand.', state: 'soon' },
    ],
  },
  {
    title: 'Revenue',
    blurb: 'Where the money moves.',
    items: [
      { key: 'stripe', name: 'Stripe', blurb: 'Instant charge + payout events, nightly totals.', state: 'live', type: 'stripe' },
      { key: 'flutterwave', name: 'Flutterwave', blurb: 'Collections and payouts across African payment methods.', state: 'soon' },
      { key: 'paystack', name: 'Paystack', blurb: 'Paystack collections and payouts.', state: 'soon' },
      { key: 'more-rev', name: 'More providers', blurb: 'Tell us who processes your payments.', state: 'soon' },
    ],
  },
  {
    title: 'Webhooks',
    blurb: 'Anything else, on your terms.',
    items: [
      { key: 'generic-webhook', name: 'Generic Webhook', blurb: 'Any backend pushes signed events to a unique URL.', state: 'live', type: 'generic-webhook' },
    ],
  },
]

/**
 * Grouped connector picker: collapsible brand sections, live/soon/connected
 * states. Shared by the Add flow and the project detail page so both offer
 * the same shelf.
 */
export default function ConnectorPicker(props: {
  connectedTypes: string[]
  onSelect: (type: ConnectableType) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(GROUPS.map((g) => [g.title, true])),
  )

  return (
    <div className="flex flex-col gap-3">
      {GROUPS.map((group) => {
        const isOpen = open[group.title] ?? true
        return (
          <div key={group.title} className="overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setOpen((o) => ({ ...o, [group.title]: !isOpen }))}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-2 bg-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-inset"
            >
              <span>
                <span className="block font-inter text-base font-semibold text-ink">{group.title}</span>
                <span className="block font-inter text-xs font-normal text-ink-muted">{group.blurb}</span>
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-ink-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {isOpen && (
              <ul className="flex flex-col gap-2 bg-inset p-2">
                {group.items.map((item) => {
                  const connected = !!item.type && props.connectedTypes.includes(item.type)
                  const disabled = item.state === 'soon' || connected
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => item.type && props.onSelect(item.type)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left transition-all duration-150 ${
                          disabled ? 'cursor-default opacity-90' : 'card-hover'
                        }`}
                      >
                        <span>
                          <span className="block font-inter text-sm font-semibold text-ink">{item.name}</span>
                          <span className="block font-inter text-xs font-normal text-ink-muted">{item.blurb}</span>
                        </span>
                        {connected ? (
                          <span className="badge badge-success shrink-0">Connected</span>
                        ) : item.state === 'soon' ? (
                          <span className="badge badge-highlight shrink-0">Soon</span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 font-inter text-sm font-medium text-coral-emphasis">Connect <ArrowRight size={14} aria-hidden="true" /></span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
