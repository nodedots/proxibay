import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { listProjectsDirect, withFallback } from '../lib/store'
import Folder from '../components/ui/folder-component'
import {
  consumeImportPrompt,
  importSelected,
  listImportCandidates,
  type ImportItem,
  type OAuthKind,
} from '../lib/oauth'
import ImportPicker from '../components/ImportPicker'
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

/** Flap-dot fills mirror the home-status logic (DESIGN.md tokens only). */
const STATUS_FILL: Record<string, string> = {
  red: '#ff5858',
  amber: '#fedf89',
  gray: '#6d6f75',
  green: '#86e0c1',
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
  const [attempt, setAttempt] = useState(0)
  const [importMenu, setImportMenu] = useState(false)
  const [picker, setPicker] = useState<{
    kind: OAuthKind
    items: ImportItem[]
    loading: boolean
    error: string | null
  } | null>(null)

  const openImporter = useCallback(async (kind: OAuthKind) => {
    setImportMenu(false)
    setPicker({ kind, items: [], loading: true, error: null })
    try {
      const { items, redirected } = await listImportCandidates(kind)
      if (redirected) {
        setPicker(null) // resolves on return — the auto-prompt below reopens
        return
      }
      setPicker({ kind, items, loading: false, error: null })
    } catch (e) {
      const code = (e as { code?: string }).code ?? ''
      const detail = e instanceof Error ? e.message : ''
      setPicker({
        kind,
        items: [],
        loading: false,
        error:
          code === 'no-token'
            ? 'We couldn’t read your account list from that sign-in. Try again.'
            : /invalid.scope/i.test(code) || /invalid.scope/i.test(detail)
              ? 'Google hasn’t enabled this level of access for Stackduck yet (verification is pending). Email or GitHub sign-in still works — importing can wait.'
              : 'Couldn’t load anything to import. Check the connection and try again.',
      })
    }
  }, [])

  const refreshPicker = useCallback(() => {
    if (picker) void openImporter(picker.kind)
  }, [picker, openImporter])

  // Auto-opens the picker once after a social auth captured a fresh token.
  useEffect(() => {
    const kind = consumeImportPrompt()
    if (kind) void openImporter(kind)
  }, [openImporter])

  useEffect(() => {
    setEntries(null)
    setError(null)
    withFallback(
      () => api<{ projects: ProjectListEntry[] }>('/v1/projects').then((r) => r.projects),
      () => listProjectsDirect(),
    )
      .then((projects) => setEntries(projects))
      .catch((e) => setError(`Could not load projects: ${e instanceof Error ? e.message : String(e)}`))
  }, [attempt])

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
        <div className="flex items-center gap-2">
          <div className="relative">
            <button className="btn-ghost" onClick={() => setImportMenu((m) => !m)} aria-haspopup="menu" aria-expanded={importMenu}>
              Import ↓
            </button>
            {importMenu && (
              <div role="menu" className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-line bg-elevated p-1 shadow-sm">
                <button
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset"
                  onClick={() => void openImporter('github')}
                >
                  Import from GitHub
                  <span className="block text-xs font-normal text-ink-muted">Pick repos to add as projects</span>
                </button>
                <button
                  role="menuitem"
                  className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset"
                  onClick={() => void openImporter('google')}
                >
                  Import from Google Cloud
                  <span className="block text-xs font-normal text-ink-muted">Pick GCP projects to add</span>
                </button>
              </div>
            )}
          </div>
          <Link to="/projects/new" className="btn-primary">
            Add project
          </Link>
        </div>
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

      {error && (
        <div className="card mt-6 text-center">
          <p className="font-inter text-base font-semibold">Something went wrong loading your portfolio.</p>
          <p className="mt-1 font-inter text-sm text-ink-muted">{error}</p>
          <button className="btn-primary mt-4" onClick={() => setAttempt((a) => a + 1)}>
            Try again
          </button>
        </div>
      )}

      {entries === null && !error && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading projects">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card flex flex-col gap-3">
              <div className="skeleton h-6 w-2/3" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-16" />
                <div className="skeleton h-6 w-16" />
              </div>
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {entries !== null && entries.length === 0 && (
        <div className="card mt-6 text-center">
          <p className="text-lg font-medium">Register your first project</p>
          <p className="mt-1 text-sm text-ink-muted">Name-only is enough — you can connect live data right after.</p>
          <Link to="/projects/new" className="btn-primary mt-4 inline-block">
            Add project
          </Link>
        </div>
      )}

      {entries !== null && entries.length > 0 && filtered.length === 0 && (
        <p className="card mt-6 text-sm text-ink-muted">No projects match “{query}”. <button className="text-link" onClick={() => { setQuery(''); setStatusFilter('all') }}>Clear filters</button></p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => (
          <Link key={e.project.id} to={`/projects/${e.project.id}`} className="card card-hover" aria-label={`${e.project.name} — status ${e.homeStatus}`}>
            <div className="flex justify-center" aria-hidden="true">
              <Folder color="stackduck" size="sm" accent={STATUS_FILL[e.homeStatus]} />
            </div>
            <div className="mt-2 flex items-center gap-2">
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
                <p className="text-sm text-ink-muted">
                  No data connected. <span className="text-link-emphasis text-link">Connect →</span>
                </p>
              ) : (
                <dl className="flex flex-wrap gap-x-4 gap-y-1">
                  {e.keyMetrics.slice(0, 3).map((m) => (
                    <div key={`${m.metricType}/${m.key}`}>
                      <dt className="text-xs text-ink-muted">{m.key.replace(/_/g, ' ')}</dt>
                      <dd className="text-lg font-semibold">{m.value.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <p className="mt-3 text-xs text-ink-muted">
              Updated {timeAgo((e.project.updatedAt as unknown as { seconds: number }) ?? undefined)}
              {e.connectorStatuses.length > 0 && ` · ${e.connectorStatuses.join(', ')}`}
            </p>
          </Link>
        ))}
      </div>

      {picker && (
        <ImportPicker
          title={picker.kind === 'github' ? 'Import from GitHub' : 'Import from Google Cloud'}
          subtitle={
            picker.kind === 'github'
              ? 'Choose repos to add as projects. Names are editable; links come along automatically.'
              : 'Choose cloud projects to add. Their IDs are kept in the project notes.'
          }
          items={picker.items}
          loading={picker.loading}
          error={picker.error}
          onRefresh={refreshPicker}
          onImport={async (selections) => {
            await importSelected(selections)
            setAttempt((a) => a + 1)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}
