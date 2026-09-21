import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api, ingestUrlFor, ApiError } from '../lib/api'
import SaJsonUpload from '../components/SaJsonUpload'
import { archiveProjectDirect, getMetricsDirect, listProjectsDirect, patchProjectDirect, withFallback } from '../lib/store'
import { db } from '../firebase'
import type { ProjectListEntry, FirebaseConnectResult, WebhookConnectResult, StripeConnectResult, SupabaseConnectResult } from '../lib/contracts'
import type { ConnectorInstance, MetricType, Project } from '../types'

function timeAgo(ts: { seconds: number } | string | undefined): string {
  if (!ts) return 'never'
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts.seconds * 1000
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

const CONN_PILL: Record<string, string> = {
  connected: 'badge badge-success',
  error: 'badge badge-alert',
  pending: 'badge',
}

interface BucketPoint { time: string; value: number }
interface BucketResp { date: string; points: BucketPoint[]; dailyAggregate?: { sum?: number; last?: number } }

/** Click-to-edit field: text → input on click, Enter/blur saves, Esc cancels. */
function Editable(props: {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  onSave: (v: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(props.value)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    if (draft === props.value) {
      setEditing(false)
      return
    }
    setSaving(true)
    setErr(null)
    try {
      await props.onSave(draft)
      setEditing(false)
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-slate">{props.label}</dt>
        <dd>
          <button
            className="text-left text-sm hover:underline"
            title="Click to edit"
            onClick={() => { setDraft(props.value); setEditing(true) }}
          >
            {props.value || <span className="text-slate">{props.placeholder ?? '+ add'}</span>}
          </button>
        </dd>
        {err && <p className="text-xs text-coral-emphasis">{err}</p>}
      </div>
    )
  }
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate">{props.label}</dt>
      <dd className="flex gap-2">
        {props.multiline ? (
          <textarea className="input" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false) }} autoFocus />
        ) : (
          <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }} autoFocus />
        )}
        <div className="flex flex-col gap-1">
          <button className="btn-primary px-3 py-1 text-sm" disabled={saving} onClick={() => void save()}>
            {saving ? '…' : 'Save'}
          </button>
          <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </dd>
      {err && <p className="text-xs text-coral-emphasis">{err}</p>}
    </div>
  )
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<ProjectListEntry | null>(null)
  const [connectors, setConnectors] = useState<ConnectorInstance[] | null>(null)
  const [keys, setKeys] = useState<Array<{ metricType: MetricType; key: string }>>([])
  const [buckets, setBuckets] = useState<Record<string, BucketResp[]>>({})
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [attach, setAttach] = useState<'firebase' | 'stripe' | 'supabase' | 'webhook' | null>(null)
  const [stripeKey, setStripeKey] = useState('')
  const [stripeWhSecret, setStripeWhSecret] = useState('')
  const [stripeEndpoint, setStripeEndpoint] = useState<string | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [saJson, setSaJson] = useState('')
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null)
  const [healthBusy, setHealthBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setError(null)
    try {
      const list = await withFallback(
        () => api<{ projects: ProjectListEntry[] }>('/v1/projects?status=active').then((r) => r.projects),
        () => listProjectsDirect(),
      )
      const found = list.find((p) => p.project.id === projectId)
      if (!found) {
        // Maybe paused/archived — fetch the doc directly.
        const snap = await getDoc(doc(db, 'projects', projectId))
        if (!snap.exists()) {
          setError('not-found')
          return
        }
        const p = snap.data() as Project
        setEntry({ project: p, connectorStatuses: [], keyMetrics: [], homeStatus: 'gray' })
      } else {
        // Refresh full project doc for catalog fields (list omits some).
        const snap = await getDoc(doc(db, 'projects', projectId))
        if (snap.exists()) found.project = { ...(snap.data() as Project), id: projectId }
        setEntry(found)
      }
      const conns = await getDocs(collection(db, 'projects', projectId, 'connectors'))
      setConnectors(conns.docs.map((d) => d.data() as ConnectorInstance))
      const m = await getDocs(
        query(collection(db, 'metrics'), where('projectId', '==', projectId), limit(100)),
      )
      const byDate = m.docs
        .map((d) => d.data() as { metricType: MetricType; key: string; date: string })
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, 60)
      const seen = new Set<string>()
      const discovered: Array<{ metricType: MetricType; key: string }> = []
      for (const data of byDate) {
        const k = `${data.metricType}/${data.key}`
        if (!seen.has(k)) {
          seen.add(k)
          discovered.push({ metricType: data.metricType, key: data.key })
        }
      }
      setKeys(discovered)
    } catch {
      setError('Failed to load project. Check your connection and Firebase config.')
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  // Fetch buckets for discovered keys whenever range/keys change.
  useEffect(() => {
    if (!projectId || keys.length === 0) return
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10)
    let cancelled = false
    void (async () => {
      const next: Record<string, BucketResp[]> = {}
      for (const k of keys) {
        try {
          const r = await withFallback(
            () => api<{ buckets: BucketResp[] }>(
              `/v1/projects/${projectId}/metrics?metricType=${k.metricType}&key=${encodeURIComponent(k.key)}&from=${from}&to=${to}`,
            ).then((res) => res.buckets),
            () => getMetricsDirect(projectId, k.metricType, k.key, from, to),
          )
          next[`${k.metricType}/${k.key}`] = r
        } catch {
          next[`${k.metricType}/${k.key}`] = []
        }
      }
      if (!cancelled) setBuckets(next)
    })()
    return () => { cancelled = true }
  }, [projectId, keys, range])

  async function patchProject(body: Record<string, unknown>) {
    const res = await withFallback(
      () => api<{ project: Project }>(`/v1/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then((r) => r.project),
      () => patchProjectDirect(projectId as string, body),
    )
    setEntry((e) => (e ? { ...e, project: { ...e.project, ...res } } : e))
  }

  async function attachFirebase() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const parsed = JSON.parse(saJson) as unknown
      const res = await api<FirebaseConnectResult>(`/v1/projects/${projectId}/connectors/firebase`, {
        method: 'POST',
        body: JSON.stringify({ serviceAccountJson: parsed }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setAttach(null)
        setSaJson('')
      }
      await load()
    } catch (e) {
      if (e instanceof SyntaxError) setAttachError('Not valid JSON — paste the full service-account file.')
      else setAttachError(e instanceof ApiError ? e.message : 'Connection failed.')
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachStripe() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<StripeConnectResult>(`/v1/projects/${projectId}/connectors/stripe`, {
        method: 'POST',
        body: JSON.stringify({
          apiKey: stripeKey.trim(),
          ...(stripeWhSecret.trim() ? { webhookSecret: stripeWhSecret.trim() } : {}),
        }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setStripeEndpoint(res.stripeEndpoint)
      }
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setAttachError(e.message)
        return
      }
      setAttachError(e instanceof ApiError ? e.message : 'Connection failed.')
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachSupabase() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<SupabaseConnectResult>(`/v1/projects/${projectId}/connectors/supabase`, {
        method: 'POST',
        body: JSON.stringify({ url: supabaseUrl.trim(), serviceKey: supabaseKey.trim() }),
      })
      if (!res.healthCheck.ok) {
        setAttachError(`Saved but unhealthy: ${res.healthCheck.detail}`)
      } else {
        setAttach(null)
        setSupabaseUrl('')
        setSupabaseKey('')
      }
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setAttachError(e.message)
        return
      }
      setAttachError(e instanceof ApiError ? e.message : 'Connection failed.')
    } finally {
      setAttachBusy(false)
    }
  }

  async function attachWebhook() {
    setAttachError(null)
    setAttachBusy(true)
    try {
      const res = await api<WebhookConnectResult>(`/v1/projects/${projectId}/connectors/webhook`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setWebhookSecret(res.signingSecret)
      await load()
    } catch (e) {
      setAttachError(e instanceof ApiError ? e.message : 'Could not create webhook.')
    } finally {
      setAttachBusy(false)
    }
  }

  async function runHealthcheck(connectorId: string) {
    setHealthBusy(connectorId)
    try {
      await api(`/v1/projects/${projectId}/connectors/${connectorId}/healthcheck`, { method: 'POST' })
      await load()
    } finally {
      setHealthBusy(null)
    }
  }

  if (error === 'not-found') {
    return (
      <div className="card mt-8 text-center">
        <p className="text-lg font-medium">Project not found</p>
        <Link to="/portfolio" className="text-link-emphasis text-link mt-2 inline-block">← Back to portfolio</Link>
      </div>
    )
  }
  if (error) return (
    <div className="card mt-8 text-center">
      <p className="font-inter text-base font-semibold">Something went wrong loading this project.</p>
      <p className="mt-1 font-inter text-sm text-slate">{error}</p>
      <button className="btn-primary mt-4" onClick={() => void load()}>
        Try again
      </button>
    </div>
  )
  if (!entry) return (
    <div className="mt-8 flex flex-col gap-4" aria-label="Loading project">
      <div className="skeleton h-9 w-1/3" />
      <div className="card flex flex-col gap-3">
        <div className="skeleton h-6 w-1/4" />
        <div className="skeleton h-16 w-full" />
      </div>
      <div className="card flex flex-col gap-3">
        <div className="skeleton h-6 w-1/4" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-12 w-full" />
      </div>
      <div className="card flex flex-col gap-3">
        <div className="skeleton h-6 w-1/4" />
        <div className="skeleton h-44 w-full" />
      </div>
    </div>
  )

  const p = entry.project
  const archived = p.status === 'archived'
  const hasFirebase = (connectors ?? []).some((c) => c.type === 'firebase')
  const hasStripe = (connectors ?? []).some((c) => c.type === 'stripe')
  const hasSupabase = (connectors ?? []).some((c) => c.type === 'supabase')

  return (
    <div className="mt-8 flex flex-col gap-4">
      {archived && (
        <div className="card bg-butter-yellow">
          <p className="text-sm font-medium">This project is archived. Ingest disabled (URLs return 410).</p>
          <button className="btn-ghost mt-2 bg-paper-white" onClick={() => void patchProject({ status: 'active' }).then(load)}>
            Restore to active
          </button>
        </div>
      )}

      {/* 1. Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-inter text-3xl font-semibold">{p.name}</h1>
          {p.environment && <span className="badge">{p.environment}</span>}
          <span className={p.status === 'active' ? 'badge badge-success' : p.status === 'paused' ? 'badge badge-highlight' : 'badge'}>
            {p.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={p.status}
            onChange={(e) => { void patchProject({ status: e.target.value }).then(load) }}
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="archived">archived</option>
          </select>
          {!deleteConfirm ? (
            <button className="btn-ghost" onClick={() => setDeleteConfirm(true)}>Archive…</button>
          ) : (
            <>
              <button
                className="btn-primary bg-coral-emphasis"
                onClick={() => {
                  void withFallback(
                    () => api(`/v1/projects/${projectId}`, { method: 'DELETE' }),
                    () => archiveProjectDirect(projectId as string),
                  ).then(() => navigate('/portfolio'))
                }}
              >
                Confirm archive
              </button>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>

      {/* 2. About */}
      <section className="card">
        <h2 className="font-inter text-lg font-semibold">About</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <Editable label="Name" value={p.name} onSave={(v) => patchProject({ name: v })} />
          <Editable label="Description" value={p.description ?? ''} multiline onSave={(v) => patchProject({ description: v || null })} />
          <Editable label="Stack tags (comma-separated)" value={(p.stackTags ?? []).join(', ')}
            onSave={(v) => patchProject({ stackTags: v.split(',').map((t) => t.trim()).filter(Boolean) })} />
          <Editable label="Environment" value={p.environment ?? ''} placeholder="+ add (production/staging/development)"
            onSave={(v) => patchProject({ environment: v || null })} />
          <Editable label="Repo URL" value={p.repoUrl ?? ''} onSave={(v) => patchProject({ repoUrl: v || null })} />
          <Editable label="Live URL" value={p.liveUrl ?? ''} onSave={(v) => patchProject({ liveUrl: v || null })} />
          <div className="sm:col-span-2">
            <Editable label="Notes" value={p.notes ?? ''} multiline onSave={(v) => patchProject({ notes: v || null })} />
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate">Saved {timeAgo(p.updatedAt as unknown as { seconds: number })}</p>
      </section>

      {/* 3. Connectors */}
      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-inter text-lg font-semibold">Live data</h2>
            <Link to="/docs/connect" target="_blank" rel="noreferrer" className="text-link-emphasis text-link text-sm">How to get your credentials →</Link>
          </div>
          {(connectors?.length ?? 0) > 0 && (
            <div className="flex gap-2">
              {!hasFirebase && <button className="btn-ghost" onClick={() => { setAttach('firebase'); setWebhookSecret(null); setStripeEndpoint(null) }}>+ Firebase</button>}
              {!hasStripe && <button className="btn-ghost" onClick={() => { setAttach('stripe'); setWebhookSecret(null); setStripeEndpoint(null) }}>+ Stripe</button>}
              {!hasSupabase && <button className="btn-ghost" onClick={() => { setAttach('supabase'); setWebhookSecret(null); setStripeEndpoint(null) }}>+ Supabase</button>}
              <button className="btn-ghost" onClick={() => { setAttach('webhook'); setWebhookSecret(null) }}>+ Webhook</button>
            </div>
          )}
        </div>

        {connectors === null && <p className="mt-3 text-sm text-slate">Loading connectors…</p>}

        {connectors !== null && connectors.length === 0 && attach === null && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            <p className="text-sm font-medium">No live data yet — this page stays useful without it.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-primary" onClick={() => setAttach('firebase')}>Connect Firebase</button>
              {!hasStripe && <button className="btn-ghost" onClick={() => setAttach('stripe')}>Connect Stripe</button>}
              {!hasSupabase && <button className="btn-ghost" onClick={() => setAttach('supabase')}>Connect Supabase</button>}
              <button className="btn-ghost" onClick={() => setAttach('webhook')}>Create webhook URL</button>
            </div>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-3">
          {connectors?.map((c) => (
            <li key={c.id} className="rounded-lg border border-warm-stone p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{c.type === 'firebase' ? 'Firebase' : c.type === 'stripe' ? 'Stripe' : c.type === 'supabase' ? 'Supabase' : 'Generic Webhook'}</span>
                  <span className={CONN_PILL[c.status]}>{c.status}</span>
                  {c.capabilities.map((cap) => (
                    <span key={cap} className="badge">{cap}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  {(c.type === 'firebase' || c.type === 'stripe' || c.type === 'supabase') && (
                    <button className="btn-ghost text-sm" disabled={healthBusy === c.id} onClick={() => void runHealthcheck(c.id)}>
                      {healthBusy === c.id ? 'Checking…' : 'Run health check'}
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate">
                {c.fetchMode === 'poll'
                  ? `Polled ${timeAgo(c.lastFetchedAt as unknown as { seconds: number } | undefined)} · checked ${timeAgo(c.lastHealthCheck as unknown as { seconds: number } | undefined)}`
                  : `Last check ${timeAgo(c.lastHealthCheck as unknown as { seconds: number } | undefined)}`}
              </p>
              {c.status === 'pending' && (
                <p className="mt-2 text-sm text-slate">
                  Waiting for first data — send a signed POST to <code className="break-all">{ingestUrlFor(c.id)}</code>, then this flips to connected automatically.
                </p>
              )}
              {c.status === 'connected' && c.fetchMode === 'poll' && keys.length === 0 && (
                <p className="mt-2 text-sm text-slate">Connected — waiting for the next poll (~30 min) to deliver the first points.</p>
              )}
              {c.status === 'connected' && c.type === 'stripe' && keys.length === 0 && (
                <p className="mt-2 text-sm text-slate">
                  Connected — instant events arrive once the endpoint below is registered in Stripe;
                  nightly totals reconcile automatically.
                </p>
              )}
              {c.type === 'generic-webhook' && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="break-all text-xs">{ingestUrlFor(c.id)}</code>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { void navigator.clipboard.writeText(ingestUrlFor(c.id)) }}>
                    Copy URL
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {attach === 'firebase' && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            <p className="text-sm font-medium">Paste the Firebase service-account JSON (read-only roles recommended). <Link to="/docs/connect/firebase" className="text-link-emphasis text-link font-normal">Where do I find this? →</Link></p>
            <div className="mt-2">
              <SaJsonUpload
                disabled={attachBusy}
                onInvalid={(m) => setAttachError(m)}
                onLoaded={(text) => {
                  setSaJson(text)
                  if (text) setAttachError(null)
                }}
              />
            </div>
            <textarea className="input mt-2 font-mono text-xs" rows={6} value={saJson} onChange={(e) => setSaJson(e.target.value)} />
            {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !saJson.trim()} onClick={() => void attachFirebase()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {attach === 'stripe' && !stripeEndpoint && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            <p className="text-sm font-medium">
              Paste a <strong>restricted secret key</strong> from your Stripe dashboard
              (Developers → API keys, read access to charges, balance, payouts).{' '}
              <Link to="/docs/connect/stripe" className="text-link-emphasis text-link font-normal">Where do I find this? →</Link>
            </p>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Restricted secret key *
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="rk_live_… or rk_test_…"
                value={stripeKey}
                onChange={(e) => setStripeKey(e.target.value)}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Webhook signing secret <span className="font-normal text-slate">(optional — enables instant events)</span>
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="whsec_… (skip for nightly totals only)"
                value={stripeWhSecret}
                onChange={(e) => setStripeWhSecret(e.target.value)}
              />
            </label>
            {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !stripeKey.trim()} onClick={() => void attachStripe()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {stripeEndpoint && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate">Stripe webhook endpoint</p>
            <code className="mt-1 block break-all text-sm">{stripeEndpoint}</code>
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost" onClick={() => { void navigator.clipboard.writeText(stripeEndpoint) }}>
                Copy URL
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setStripeEndpoint(null); setStripeKey(''); setStripeWhSecret('') }}>Done</button>
            </div>
            <p className="mt-2 text-sm text-slate">
              Register this under <strong>Stripe dashboard → Developers → Webhooks</strong> for instant
              charge and payout events. Without it, nightly totals still reconcile.
            </p>
          </div>
        )}
        {attach === 'supabase' && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            <div className="rounded-lg bg-butter-yellow p-3 text-sm font-medium text-inkwell-navy">
              Use the <strong>service_role</strong> secret — never the anon key.{' '}
              <Link to="/docs/connect/supabase" className="text-link-emphasis text-link">Where do I find this? →</Link>
            </div>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              Project URL *
              <input
                className="input font-mono text-xs"
                type="url"
                autoComplete="off"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
              service_role secret *
              <input
                className="input font-mono text-xs"
                type="password"
                autoComplete="off"
                placeholder="eyJ…"
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
              />
            </label>
            {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
            <div className="mt-2 flex gap-2">
              <button className="btn-primary" disabled={attachBusy || !supabaseUrl.trim() || !supabaseKey.trim()} onClick={() => void attachSupabase()}>
                {attachBusy ? 'Checking…' : 'Connect + run health check'}
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
            </div>
          </div>
        )}
        {attach === 'webhook' && (
          <div className="mt-3 rounded-lg bg-ash-canvas p-4">
            {!webhookSecret ? (
              <>
                <p className="text-sm">Generate a unique ingest URL + signing secret for this project. <Link to="/docs/connect/webhook" className="text-link-emphasis text-link">How to sign events →</Link></p>
                {attachError && <p className="mt-2 text-sm text-coral-emphasis">{attachError}</p>}
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary" disabled={attachBusy} onClick={() => void attachWebhook()}>
                    {attachBusy ? 'Generating…' : 'Generate URL + secret'}
                  </button>
                  <button className="btn-ghost" onClick={() => { setAttach(null); setAttachError(null) }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase text-slate">Signing secret — shown once</p>
                <code className="mt-1 block break-all text-sm">{webhookSecret}</code>
                <button className="btn-ghost mt-2" onClick={() => { void navigator.clipboard.writeText(webhookSecret) }}>Copy secret</button>
                <button className="btn-ghost ml-2" onClick={() => { setAttach(null); setWebhookSecret(null) }}>Done</button>
              </>
            )}
          </div>
        )}
      </section>

      {/* 4. Charts */}
      <section className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-inter text-lg font-semibold">Metrics</h2>
          <select className="input w-auto" value={range} onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}>
            <option value={7}>7d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
          </select>
        </div>
        {keys.length === 0 && (
          <p className="mt-3 text-sm text-slate">
            {(connectors?.length ?? 0) === 0
              ? 'Connect a data source above to see charts here.'
              : 'Waiting for first data — charts appear automatically once events arrive.'}
          </p>
        )}
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {keys.map((k) => {
            const id = `${k.metricType}/${k.key}`
            const data = buckets[id] ?? []
            const pts = data.flatMap((b) => b.points.map((pt) => ({ t: pt.time.slice(0, 10), v: pt.value })))
            const last = data.length ? data[data.length - 1].dailyAggregate?.last : undefined
            return (
              <div key={id} className="rounded-lg border border-warm-stone p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold capitalize">{k.key.replace(/_/g, ' ')}</p>
                  {last !== undefined && <p className="text-xl font-semibold">{last.toLocaleString()}</p>}
                </div>
                <p className="text-xs text-slate">{k.metricType}</p>
                {pts.length === 0 ? (
                  <p className="mt-2 text-sm text-slate">No points in range.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={pts}>
                      <XAxis dataKey="t" tick={{ fontSize: 10 }} minTickGap={40} />
                      <YAxis tick={{ fontSize: 10 }} width={40} />
                      <Tooltip />
                      <Line type="monotone" dataKey="v" stroke="#151b31" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. Recent */}
      <section className="card">
        <h2 className="font-inter text-lg font-semibold">Recent</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {(connectors ?? []).map((c) => (
            <li key={c.id} className="text-slate">
              {c.type} · {c.status}
              {c.fetchMode === 'poll' && <> · polled {timeAgo(c.lastFetchedAt as unknown as { seconds: number } | undefined)}</>}
              <> · checked {timeAgo(c.lastHealthCheck as unknown as { seconds: number } | undefined)}</>
            </li>
          ))}
          {(connectors?.length ?? 0) === 0 && <li className="text-slate">Nothing yet — activity from polls and webhook receipts will show here.</li>}
        </ul>
        <p className="mt-2 text-xs text-slate">Alert firings land here in Phase 2.</p>
      </section>

      <Link to="/portfolio" className="text-link text-sm">← Back to portfolio</Link>
    </div>
  )
}
