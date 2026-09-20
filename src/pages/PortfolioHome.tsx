import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { listProjectsDirect, withFallback } from '../lib/store'
import type { ProjectListEntry } from '../lib/contracts'

function timeAgo(iso: { seconds: number } | string | undefined): string {
  if (!iso) return 'never'
  const ms = typeof iso === 'string' ? new Date(iso).getTime() : iso.seconds * 1000
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const STATUS_DOT: Record<string, string> = {
  red: 'status-dot status-red',
  amber: 'status-dot status-amber',
  gray: 'status-dot status-gray',
  green: 'status-dot status-green',
}

/**
 * Portfolio Home View (per spec): card grid, status color logic, search/filter,
 * empty state. No inline card actions — click through to detail.
 */
export default function PortfolioHome() {
  const [entries, setEntries] = useState<ProjectListEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'archived'>('all')

  useEffect(() => {
    withFallback(
      () => api<{ projects: ProjectListEntry[] }>('/v1/projects').then((r) => r.projects),
      () => listProjectsDirect(),
    )
      .then((projects) => setEntries(projects))
      .catch((e) => setError(`Could not load projects: ${e instanceof Error ? e.message : String(e)}`))
  }, [])

  const filtered = useMemo(() => {
    if (!entries) return []
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (statusFilter !== 'all' && e.project.status !== statusFilter) return false
      if (!q) return true
      const tags = (e.project.stackTags ?? []).join(' ').toLowerCase()
      return e.project.name.toLowerCase().includes(q) || tags.includes(q) || e.project.status.includes(q)
    })
  }, [entries, query, statusFilter])

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-inter text-3xl font-semibold">Portfolio</h1>
        <Link to="/projects/new" className="btn-primary">
          Add project
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by name, stack tag, or status…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="archived">archived</option>
        </select>
      </div>

      {error && <p className="card mt-6 text-sm text-coral-emphasis">{error}</p>}

      {entries === null && !error && <p className="mt-6 text-slate">Loading…</p>}

      {entries !== null && entries.length === 0 && (
        <div className="card mt-6 text-center">
          <p className="text-lg font-medium">Register your first project</p>
          <p className="mt-1 text-sm text-slate">Name-only is enough — you can connect live data right after.</p>
          <Link to="/projects/new" className="btn-primary mt-4 inline-block">
            Add project
          </Link>
        </div>
      )}

      {entries !== null && entries.length > 0 && filtered.length === 0 && (
        <p className="card mt-6 text-sm text-slate">No projects match “{query}”. <button className="text-link" onClick={() => { setQuery(''); setStatusFilter('all') }}>Clear filters</button></p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => (
          <Link key={e.project.id} to={`/projects/${e.project.id}`} className="card hover:shadow-sm">
            <div className="flex items-center gap-2">
              <span className={STATUS_DOT[e.homeStatus]} title={e.homeStatus} />
              <h2 className="font-inter text-lg font-semibold">{e.project.name}</h2>
            </div>
            {(e.project.stackTags?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {e.project.stackTags!.map((t) => (
                  <span key={t} className="badge">{t}</span>
                ))}
              </div>
            )}
            <div className="mt-3">
              {e.keyMetrics.length === 0 ? (
                <p className="text-sm text-slate">
                  No data connected. <span className="text-link-emphasis text-link">Connect →</span>
                </p>
              ) : (
                <dl className="flex flex-wrap gap-x-4 gap-y-1">
                  {e.keyMetrics.slice(0, 3).map((m) => (
                    <div key={`${m.metricType}/${m.key}`}>
                      <dt className="text-xs text-slate">{m.key.replace(/_/g, ' ')}</dt>
                      <dd className="text-lg font-semibold">{m.value.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <p className="mt-3 text-xs text-slate">
              Updated {timeAgo((e.project.updatedAt as unknown as { seconds: number }) ?? undefined)}
              {e.connectorStatuses.length > 0 && ` · ${e.connectorStatuses.join(', ')}`}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
