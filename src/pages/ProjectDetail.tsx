import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, limit, query, where, addDoc, deleteDoc, updateDoc, Timestamp, writeBatch, type QuerySnapshot, type DocumentData } from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import DurationPicker from '../components/ui/duration-picker'
import { api, ingestUrlFor, stripeUrlFor, ApiError, connectErrorMessage, loadErrorMessage } from '../lib/api'
import SaJsonUpload from '../components/SaJsonUpload'
import ConnectorPicker, { type ConnectableType } from '../components/ConnectorPicker'
import { getMetricsDirect, listProjectsDirect, patchProjectDirect, withFallback } from '../lib/store'
import { connectorStatus, describeRule, humanKeyLabel, metricFamilyLabel } from '../lib/format'
import { db } from '../firebase'
import type { ProjectListEntry, FirebaseConnectResult, WebhookConnectResult, StripeConnectResult, SupabaseConnectResult } from '../lib/contracts'
import type { AlertRule, ConnectorInstance, MetricType, Project } from '../types'

function timeAgo(ts: { seconds: number } | string | undefined): string | null {
  if (!ts) return null
  const ms = typeof ts === 'string' ? new Date(ts).getTime() : ts.seconds * 1000
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** "Polled 12m ago · checked 1h ago" — segments omitted when there's nothing to report. */
function connectorActivity(c: ConnectorInstance): string | null {
  const polled = timeAgo(c.lastFetchedAt as unknown as { seconds: number } | undefined)
  const checked = timeAgo(c.lastHealthCheck as unknown as { seconds: number } | undefined)
  const parts: string[] = []
  if (c.fetchMode === 'poll' && polled) parts.push(`new data ${polled}`)
  if (checked) parts.push(`last checked ${checked}`)
  return parts.length ? parts.join(' · ') : null
}

/** "Users: total, signups" from live keys, or just the family names before data arrives. */
function reportingFor(c: ConnectorInstance, keys: Array<{ metricType: MetricType; key: string }>): string {
  const fams = [...new Set(c.capabilities.map(metricFamilyLabel))]
  return fams
    .map((f) => {
      const ks = keys.filter((k) => metricFamilyLabel(k.metricType) === f).map((k) => humanKeyLabel(k.key))
      return ks.length ? `${f}: ${ks.join(', ')}` : f
    })
    .join(' · ')
}

/** Production → Production, paused → Paused. Enum values stay internal. */
function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
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
      setErr(e instanceof ApiError ? e.message : "Couldn't save that change — try again.")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div>
        <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{props.label}</dt>
        <dd>
          <button
            className="text-left text-sm hover:underline"
            title="Click to edit"
            onClick={() => { setDraft(props.value); setEditing(true) }}
          >
            {props.value || <span className="text-ink-muted">{props.placeholder ?? '+ add'}</span>}
          </button>
        </dd>
        {err && <p className="text-xs text-coral-emphasis">{err}</p>}
      </div>
    )
  }
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{props.label}</dt>
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
  const [rangeHours, setRangeHours] = useState<24 | 168 | 720>(168)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [deleteDraft, setDeleteDraft] = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
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
  const [rules, setRules] = useState<AlertRule[] | null>(null)
  const [ruleKey, setRuleKey] = useState('')
  const [ruleCondition, setRuleCondition] = useState<'above' | 'below'>('above')
  const [ruleThreshold, setRuleThreshold] = useState('')
  const [ruleWindow, setRuleWindow] = useState(15)
  const [ruleChannel, setRuleChannel] = useState<'email' | 'webhook'>('email')
  const [ruleTarget, setRuleTarget] = useState('')
  const [ruleBusy, setRuleBusy] = useState(false)
  const [ruleError, setRuleError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    const pending = sessionStorage.getItem('stackduck:just-connected')
    if (pending) {
      sessionStorage.removeItem('stackduck:just-connected')
      showToast(`${pending} connected! Your first data will show up shortly.`)
    }
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const rs = await getDocs(collection(db, 'projects', projectId, 'alertRules'))
      setRules(rs.docs.map((d) => ({ ...(d.data() as AlertRule), id: d.id })))
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
      setError(loadErrorMessage('this project', undefined))
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  // Fetch buckets for discovered keys whenever range/keys change.
  useEffect(() => {
    if (!projectId || keys.length === 0) return
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - rangeHours * 3600000).toISOString().slice(0, 10)
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
  }, [projectId, keys, rangeHours])

  async function patchProject(body: Record<string, unknown>) {    const res = await withFallback(
      () => api<{ project: Project }>(`/v1/projects/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then((r) => r.project),
      () => patchProjectDirect(projectId as string, body),
    )
    setEntry((e) => (e ? { ...e, project: { ...e.project, ...res } } : e))
  }

  async function saveName() {
    const next = nameDraft.trim()
    if (!next || next === entry?.project.name) {
      setNameEditing(false)
      return
    }
    setNameSaving(true)
    try {
      await patchProject({ name: next })
      await load()
      setNameEditing(false)
    } finally {
      setNameSaving(false)
    }
  }

  /** Hard delete: project doc + connectors + rules + metric buckets, in batches.
   *  Secret-manager credentials are orphaned (no client access) — documented. */
  async function deleteProject() {
    if (!projectId) return
    const batchDelete = async (snap: QuerySnapshot<DocumentData>) => {
      const CHUNK = 400
      for (let i = 0; i < snap.docs.length; i += CHUNK) {
        const batch = writeBatch(db)
        for (const d of snap.docs.slice(i, i + CHUNK)) batch.delete(d.ref)
        await batch.commit()
      }
    }
    const conns = await getDocs(collection(db, 'projects', projectId, 'connectors'))
    await batchDelete(conns)
    const rs = await getDocs(collection(db, 'projects', projectId, 'alertRules'))
    await batchDelete(rs)
    for (;;) {
      const buckets = await getDocs(
        query(collection(db, 'metrics'), where('projectId', '==', projectId), limit(400)),
      )
      if (buckets.docs.length === 0) break
      await batchDelete(buckets)
      if (buckets.docs.length < 400) break
    }
    await deleteDoc(doc(db, 'projects', projectId))
    navigate('/portfolio')
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
        showToast('Firebase connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
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
        showToast('Stripe connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
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
        showToast('Supabase connected! Your first data will show up shortly.')
      }
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
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
      showToast('Webhook created! Send your first update to switch it on.')
      await load()
    } catch (e) {
      setAttachError(connectErrorMessage(e))
    } finally {
      setAttachBusy(false)
    }
  }

  async function createRule() {
    if (!projectId || !ruleKey || !ruleThreshold.trim() || !ruleTarget.trim() || ruleWindow < 1) return
    const [metricType, ...keyParts] = ruleKey.split('/')
    setRuleError(null)
    setRuleBusy(true)
    try {
      const threshold = Number(ruleThreshold)
      if (Number.isNaN(threshold)) {
        setRuleError('Threshold must be a number.')
        return
      }
      await addDoc(collection(db, 'projects', projectId, 'alertRules'), {
        projectId,
        metricType,
        key: keyParts.join('/'),
        condition: ruleCondition,
        threshold,
        windowMinutes: ruleWindow,
        channel: ruleChannel,
        channelTarget: ruleTarget.trim(),
        status: 'active',
        createdAt: Timestamp.now(),
      })
      setRuleKey('')
      setRuleThreshold('')
      setRuleTarget('')
      setRuleWindow(15)
      const rs = await getDocs(collection(db, 'projects', projectId, 'alertRules'))
      setRules(rs.docs.map((d) => ({ ...(d.data() as AlertRule), id: d.id })))
    } catch {
      setRuleError('Couldn’t save the rule. Check your connection and try again.')
    } finally {
      setRuleBusy(false)
    }
  }

  async function toggleRule(rule: AlertRule) {
    if (!projectId) return
    await updateDoc(doc(db, 'projects', projectId, 'alertRules', rule.id), {
      status: rule.status === 'active' ? 'muted' : 'active',
    })
    setRules((rs) => rs?.map((r) => (r.id === rule.id ? { ...r, status: r.status === 'active' ? 'muted' : 'active' } : r)) ?? null)
  }

  async function deleteRule(rule: AlertRule) {
    if (!projectId) return
    await deleteDoc(doc(db, 'projects', projectId, 'alertRules', rule.id))
    setRules((rs) => rs?.filter((r) => r.id !== rule.id) ?? null)
  }

  async function runHealthcheck(connectorId: string) {    setHealthBusy(connectorId)
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
      <p className="mt-1 font-inter text-sm text-ink-muted">{error}</p>
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

  return (
    <div className="mt-8 flex flex-col gap-4">
      {archived && (
        <div className="card bg-butter-yellow text-inkwell-navy">
          <p className="text-sm font-medium">This project is archived. New data is paused — nothing is lost.</p>
          <button className="btn-ghost mt-2 !border-line-strong bg-paper-white text-inkwell-navy hover:!bg-paper-white" onClick={() => void patchProject({ status: 'active' }).then(load)}>
            Restore to active
          </button>
        </div>
      )}

      {/* 1. Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {nameEditing ? (
            <div className="flex items-center gap-2">
              <input
                className="input max-w-xs !text-2xl font-semibold"
                value={nameDraft}
                autoFocus
                aria-label="Project name"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveName()
                  if (e.key === 'Escape') setNameEditing(false)
                }}
              />
              <button
                className="btn-primary px-3 py-1 text-sm"
                disabled={nameSaving || !nameDraft.trim()}
                onClick={() => void saveName()}
              >
                {nameSaving ? '…' : 'Save'}
              </button>
              <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setNameEditing(false)}>Cancel</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="font-inter text-3xl font-semibold">{p.name}</h1>
              <button
                className="rounded-lg p-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
                title="Rename project"
                aria-label="Rename project"
                onClick={() => { setNameDraft(p.name); setNameEditing(true) }}
              >
                ✎
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {p.environment && <span className="badge">{titleCase(p.environment)}</span>}
            <span className={p.status === 'active' ? 'badge badge-success' : p.status === 'paused' ? 'badge badge-highlight' : 'badge'}>
              {titleCase(p.status)}
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            className="btn-ghost px-3"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Project actions"
            onClick={() => { setMenuOpen((m) => !m); setDeleteArmed(false); setDeleteDraft('') }}
          >
            ···
          </button>
          {menuOpen && !deleteArmed && (
            <div role="menu" className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-line bg-elevated p-1 shadow-sm">
              {p.status === 'paused' ? (
                <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset" onClick={() => { setMenuOpen(false); void patchProject({ status: 'active' }).then(load) }}>
                  Resume<span className="block text-xs font-normal text-ink-muted">Back to active</span>
                </button>
              ) : (
                <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset" onClick={() => { setMenuOpen(false); void patchProject({ status: 'paused' }).then(load) }}>
                  Pause<span className="block text-xs font-normal text-ink-muted">Keep everything, stop surfacing as live</span>
                </button>
              )}
              {archived ? (
                <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset" onClick={() => { setMenuOpen(false); void patchProject({ status: 'active' }).then(load) }}>
                  Restore<span className="block text-xs font-normal text-ink-muted">Back to active</span>
                </button>
              ) : (
                <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-ink transition-colors duration-150 hover:bg-inset" onClick={() => { setMenuOpen(false); void patchProject({ status: 'archived' }).then(load) }}>
                  Archive<span className="block text-xs font-normal text-ink-muted">Kept, restorable, ingest paused</span>
                </button>
              )}
              <button role="menuitem" className="w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-coral-emphasis transition-colors duration-150 hover:bg-inset" onClick={() => setDeleteArmed(true)}>
                Delete…<span className="block text-xs font-normal text-ink-muted">Permanent — needs your project name to confirm</span>
              </button>
            </div>
          )}
          {menuOpen && deleteArmed && (
            <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-line bg-elevated p-4 shadow-sm">
              <p className="font-inter text-sm font-semibold">Delete this project?</p>
              <p className="mt-1 font-inter text-xs text-ink-muted">
                Everything goes: catalog, connectors, metrics, alerts. This can’t be undone.
                Type <strong>{p.name}</strong> to confirm.
              </p>
              <input
                className="input mt-2"
                autoFocus
                aria-label="Type the project name to confirm deletion"
                placeholder={p.name}
                value={deleteDraft}
                onChange={(e) => setDeleteDraft(e.target.value)}
              />
              <div className="mt-3 flex gap-2">
                <button
                  className="btn-primary bg-coral-emphasis"
                  disabled={deleteDraft.trim() !== p.name}
                  onClick={() => void deleteProject()}
                >
                  Delete forever
                </button>
                <button className="btn-ghost" onClick={() => { setDeleteArmed(false); setDeleteDraft('') }}>Cancel</button>
              </div>
            </div>
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
        <p className="mt-3 text-xs text-ink-muted">
          {(() => {
            const t = timeAgo(p.updatedAt as unknown as { seconds: number })
            return t ? `Saved ${t}` : 'Not saved yet'
          })()}
        </p>
      </section>

      {/* 3. Connectors */}
      <section className="card" id="connectors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-inter text-lg font-semibold">Live data</h2>
            <Link to="/docs/connect" target="_blank" rel="noreferrer" className="text-link-emphasis text-link text-sm">How to get your credentials →</Link>
          </div>
          {(connectors?.length ?? 0) > 0 && (
            <div className="mt-3">
              <ConnectorPicker
                connectedTypes={(connectors ?? []).map((c) => c.type)}
                onSelect={(type: ConnectableType) => {
                  setAttach(type === 'generic-webhook' ? 'webhook' : type)
                  setWebhookSecret(null)
                  setStripeEndpoint(null)
                }}
              />
            </div>
          )}
        </div>

        {connectors === null && <p className="mt-3 text-sm text-ink-muted">Loading connectors…</p>}

        {connectors !== null && connectors.length === 0 && attach === null && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-sm font-medium">No live data yet — pick a source below. This page stays useful without it.</p>
            <div className="mt-3">
              <ConnectorPicker
                connectedTypes={[]}
                onSelect={(type: ConnectableType) => {
                  setAttach(type === 'generic-webhook' ? 'webhook' : type)
                  setWebhookSecret(null)
                  setStripeEndpoint(null)
                }}
              />
            </div>
          </div>
        )}

        <ul className="mt-3 flex flex-col gap-3">
          {connectors?.map((c) => {
            const st = connectorStatus(c.status)
            const activity = connectorActivity(c)
            const pushAddress = c.type === 'generic-webhook' ? ingestUrlFor(c.id) : c.type === 'stripe' ? stripeUrlFor(c.id) : null
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`status-dot ${st.dot}`} aria-hidden="true" />
                    <span className="text-sm font-semibold">
                      {c.type === 'firebase' ? 'Firebase' : c.type === 'stripe' ? 'Stripe' : c.type === 'supabase' ? 'Supabase' : 'Generic Webhook'}
                    </span>
                  </div>
                  {(c.type === 'firebase' || c.type === 'stripe' || c.type === 'supabase') && (
                    <button className="btn-ghost text-sm" disabled={healthBusy === c.id} onClick={() => void runHealthcheck(c.id)}>
                      {healthBusy === c.id ? 'Checking…' : 'Check again'}
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium">{st.headline}</p>
                <p className="mt-1 text-xs text-ink-muted">Reporting · {reportingFor(c, keys)}</p>
                {activity ? (
                  <p className="mt-1 text-xs text-ink-muted">{activity}</p>
                ) : (
                  <p className="mt-1 text-xs text-ink-muted">No updates yet</p>
                )}
                {c.status === 'pending' && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {c.fetchMode === 'poll'
                      ? 'Checks run about every 30 minutes — the first one will pick this up.'
                      : 'Send your first update to the address below — this switches on by itself once it arrives.'}
                  </p>
                )}
                {pushAddress && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="break-all text-xs">{pushAddress}</code>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { void navigator.clipboard.writeText(pushAddress) }}>
                      Copy address
                    </button>
                  </div>
                )}
                {c.type === 'stripe' && c.status === 'connected' && keys.length === 0 && (
                  <p className="mt-2 text-sm text-ink-muted">
                    Instant events arrive once the address above is registered in Stripe;
                    totals land on their own every night.
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        {attach === 'firebase' && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-sm font-medium">Paste the Firebase service-account JSON (read-only roles recommended). <Link to="/docs/connect/firebase" className="text-link-emphasis text-link font-normal">Where do I find this? →</Link></p>
            <details className="mt-2 rounded-lg bg-surface p-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink">What is this?</summary>
              <p className="mt-2 text-ink-muted">
                A service account is like a read-only username your Firebase project issues
                for tools like Stackduck. It can only look — it can't change or delete anything.
              </p>
            </details>
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
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-sm font-medium">
              A restricted key can only read — it can't move money. Paste it from your Stripe dashboard
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
              Webhook signing secret <span className="font-normal text-ink-muted">(optional — enables instant events)</span>
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
          <div className="mt-3 rounded-lg bg-inset p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Stripe webhook endpoint</p>
            <code className="mt-1 block break-all text-sm">{stripeEndpoint}</code>
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost" onClick={() => { void navigator.clipboard.writeText(stripeEndpoint) }}>
                Copy URL
              </button>
              <button className="btn-ghost" onClick={() => { setAttach(null); setStripeEndpoint(null); setStripeKey(''); setStripeWhSecret('') }}>Done</button>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Register this under <strong>Stripe dashboard → Developers → Webhooks</strong> for instant
              charge and payout events. Without it, nightly totals still reconcile.
            </p>
          </div>
        )}
        {attach === 'supabase' && (
          <div className="mt-3 rounded-lg bg-inset p-4">
            <div className="rounded-lg bg-butter-yellow p-3 text-sm font-medium text-inkwell-navy">
              Use the <strong>service_role</strong> secret — never the anon key. Think of it
              as a master key for your database: powerful, so keep it private.{' '}
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
          <div className="mt-3 rounded-lg bg-inset p-4">
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
                <p className="text-xs font-semibold uppercase text-ink-muted">Signing secret — shown once</p>
                <code className="mt-1 block break-all text-sm">{webhookSecret}</code>
                <button className="btn-ghost mt-2" onClick={() => { void navigator.clipboard.writeText(webhookSecret) }}>Copy secret</button>
                <button className="btn-ghost ml-2" onClick={() => { setAttach(null); setWebhookSecret(null) }}>Done</button>
              </>
            )}
          </div>
        )}
      </section>

      {/* 4. Metrics */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-inter text-lg font-semibold">What the numbers say</h2>
          <div role="group" aria-label="Time range" className="flex gap-1 rounded-lg bg-inset p-1">
            {([
              [24, '24h'],
              [168, '7d'],
              [720, '30d'],
            ] as Array<[24 | 168 | 720, string]>).map(([hours, label]) => (
              <button
                key={hours}
                onClick={() => setRangeHours(hours)}
                aria-pressed={rangeHours === hours}
                className={`rounded-md px-3 py-1 font-inter text-sm font-medium transition-colors duration-150 ${
                  rangeHours === hours ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const seen = new Set<string>()
          const hero: Array<{ family: string; label: string; value: number }> = []
          for (const k of keys) {
            const family = metricFamilyLabel(k.metricType)
            if (seen.has(family)) continue
            const data = buckets[`${k.metricType}/${k.key}`] ?? []
            const last = data.length ? data[data.length - 1].dailyAggregate?.last : undefined
            if (last === undefined) continue
            seen.add(family)
            hero.push({ family, label: humanKeyLabel(k.key), value: last })
          }
          if (hero.length === 0) return null
          return (
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
              {hero.map((h) => (
                <div key={h.family}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{h.family}</dt>
                  <dd className="font-inter text-3xl font-semibold">{h.value.toLocaleString()}</dd>
                  <dd className="text-xs text-ink-muted">{h.label}</dd>
                </div>
              ))}
            </dl>
          )
        })()}
        {keys.length === 0 && (
          <p className="mt-3 text-sm text-ink-muted">
            {(connectors?.length ?? 0) === 0 ? (
              <>
                Connect a data source above to see charts here.{' '}
                <a href="#connectors" className="text-link-emphasis text-link" onClick={(e) => { e.preventDefault(); document.getElementById('connectors')?.scrollIntoView({ behavior: 'smooth' }) }}>Go to connectors →</a>
              </>
            ) : (
              'Charts appear here automatically once your first data arrives.'
            )}
          </p>
        )}
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {keys.map((k) => {
            const id = `${k.metricType}/${k.key}`
            const data = buckets[id] ?? []
            const pts = data.flatMap((b) => b.points.map((pt) => ({ t: pt.time.slice(0, 10), v: pt.value })))
            const last = data.length ? data[data.length - 1].dailyAggregate?.last : undefined
            const rangeLabel = rangeHours === 24 ? 'last 24 hours' : rangeHours === 168 ? 'last 7 days' : 'last 30 days'
            return (
              <div key={id} className="rounded-lg border border-line p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-semibold">{humanKeyLabel(k.key)}</p>
                  {last !== undefined && <p className="text-xl font-semibold">{last.toLocaleString()}</p>}
                </div>
                <p className="text-xs text-ink-muted">{metricFamilyLabel(k.metricType)}</p>
                {pts.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">No {humanKeyLabel(k.key).toLowerCase()} in the {rangeLabel}.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={pts}>
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} stroke="var(--color-line)" minTickGap={40} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--color-ink-muted)' }} stroke="var(--color-line)" width={40} />
                      <Tooltip
                        contentStyle={{ background: 'var(--color-elevated)', border: '1px solid var(--color-line)', borderRadius: 8, color: 'var(--color-ink)' }}
                        labelStyle={{ color: 'var(--color-ink)' }}
                        itemStyle={{ color: 'var(--color-ink-muted)' }}
                      />
                      <Line type="monotone" dataKey="v" stroke="var(--color-ink)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. Alerts */}
      <section className="card">
        <h2 className="font-inter text-lg font-semibold">Alerts</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Rules you save here will start watching on their own.
        </p>

        {rules !== null && rules.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className={r.status === 'active' ? 'badge badge-success' : 'badge'}>
                    {r.status === 'active' ? 'Active' : 'Paused'}
                  </span>
                  <span className="font-medium">{describeRule(r)}</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void toggleRule(r)}>
                    {r.status === 'active' ? 'Mute' : 'Unmute'}
                  </button>
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void deleteRule(r)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 font-inter text-base font-semibold">Recent firings</h3>
        <p className="mt-1 text-sm text-ink-muted">
          No alerts have fired yet. When one does, you'll see what happened, when, and where
          it was sent — right here.
        </p>

        <div className="mt-4 rounded-lg bg-inset p-4">
          <p className="text-sm font-medium">New alert{keys.length === 0 ? ' — connect a data source first so there’s a metric to watch' : ''}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Metric
              <select className="input" value={ruleKey} onChange={(e) => setRuleKey(e.target.value)} disabled={keys.length === 0}>
                <option value="">Choose…</option>
                {keys.map((k) => (
                  <option key={`${k.metricType}/${k.key}`} value={`${k.metricType}/${k.key}`}>
                    {metricFamilyLabel(k.metricType)} — {humanKeyLabel(k.key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Condition
                <select className="input" value={ruleCondition} onChange={(e) => setRuleCondition(e.target.value as 'above' | 'below')}>
                  <option value="above">above</option>
                  <option value="below">below</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Threshold
                <input
                  className="input"
                  type="number"
                  step="any"
                  placeholder="e.g. 5"
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Evaluate over
              <DurationPicker
                value={{ hours: Math.floor(ruleWindow / 60), minutes: ruleWindow % 60 }}
                onChange={(d) => setRuleWindow(Math.max(1, d.hours * 60 + d.minutes))}
                maxHours={24}
                hoursLabel="h"
                minutesLabel="m"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Channel
                <select className="input" value={ruleChannel} onChange={(e) => setRuleChannel(e.target.value as 'email' | 'webhook')}>
                  <option value="email">Email</option>
                  <option value="webhook">Webhook</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {ruleChannel === 'email' ? 'Email address' : 'Webhook URL'}
                <input
                  className="input"
                  type={ruleChannel === 'email' ? 'email' : 'url'}
                  placeholder={ruleChannel === 'email' ? 'you@example.com' : 'https://…'}
                  value={ruleTarget}
                  onChange={(e) => setRuleTarget(e.target.value)}
                />
              </label>
            </div>
          </div>
          {ruleError && <p role="alert" className="mt-2 text-sm text-coral-emphasis">{ruleError}</p>}
          <button
            className="btn-primary mt-3"
            disabled={ruleBusy || !ruleKey || !ruleThreshold.trim() || !ruleTarget.trim() || ruleWindow < 1}
            onClick={() => void createRule()}
          >
            {ruleBusy ? 'Saving…' : 'Save alert'}
          </button>
        </div>
      </section>

      {/* 6. Recent */}
      <section className="card">
        <h2 className="font-inter text-lg font-semibold">Recent activity</h2>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {(connectors ?? []).map((c) => {
            const st = connectorStatus(c.status)
            const activity = connectorActivity(c)
            const label = c.type === 'firebase' ? 'Firebase' : c.type === 'stripe' ? 'Stripe' : c.type === 'supabase' ? 'Supabase' : 'Webhook'
            return (
              <li key={c.id} className="text-ink-muted">
                {label} — {st.headline.toLowerCase()}{activity ? ` · ${activity}` : ''}
              </li>
            )
          })}
          {(connectors?.length ?? 0) === 0 && <li className="text-ink-muted">Nothing yet — activity from your connectors will show here.</li>}
        </ul>
      </section>

      <Link to="/portfolio" className="text-link text-sm">← Back to portfolio</Link>

      {toast && (
        <div
          role="status"
          className="fade-swap fixed bottom-6 left-1/2 z-50 flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl border border-line bg-elevated p-4 shadow-sm"
        >
          <span className="status-dot status-green shrink-0" aria-hidden="true" />
          <p className="font-inter text-sm font-medium">{toast}</p>
          <button
            className="rounded-lg px-2 py-1 font-inter text-lg leading-none text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}
