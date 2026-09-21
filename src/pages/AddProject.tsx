import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { createProjectDirect, withFallback } from '../lib/store'
import SaJsonUpload from '../components/SaJsonUpload'
import type { CreatedProject, FirebaseConnectResult, WebhookConnectResult } from '../lib/contracts'
import type { Project } from '../types'

type Phase = 'create' | 'connect'

/**
 * Add Project flow (per spec):
 * Step 1 — name only required, rest optional.
 * Step 2 — immediate optional connector prompt (Firebase / Webhook / do later).
 */
export default function AddProject() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('create')
  const [project, setProject] = useState<Project | null>(null)

  // Step 1 fields
  const [name, setName] = useState('')
  const [showOptional, setShowOptional] = useState(false)
  const [description, setDescription] = useState('')
  const [stackTags, setStackTags] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [liveUrl, setLiveUrl] = useState('')
  const [environment, setEnvironment] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Step 2 state
  const [connectorChoice, setConnectorChoice] = useState<'firebase' | 'webhook' | null>(null)
  const [saJson, setSaJson] = useState('')
  const [step2Error, setStep2Error] = useState<string | null>(null)
  const [step2Busy, setStep2Busy] = useState(false)
  const [webhookResult, setWebhookResult] = useState<WebhookConnectResult | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)

  async function onCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const body: Record<string, unknown> = { name: name.trim() }
      if (description.trim()) body.description = description.trim()
      if (stackTags.trim()) body.stackTags = stackTags.split(',').map((t) => t.trim()).filter(Boolean)
      if (repoUrl.trim()) body.repoUrl = repoUrl.trim()
      if (liveUrl.trim()) body.liveUrl = liveUrl.trim()
      if (environment) body.environment = environment
      if (notes.trim()) body.notes = notes.trim()
      const res = await withFallback(
        () => api<CreatedProject>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
        async () => ({ project: await createProjectDirect(body as Parameters<typeof createProjectDirect>[0]) }),
      )
      setProject(res.project)
      setPhase('connect')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create project.')
    } finally {
      setBusy(false)
    }
  }

  async function connectFirebase() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const parsed = JSON.parse(saJson) as unknown
      const res = await api<FirebaseConnectResult>(`/v1/projects/${project!.id}/connectors/firebase`, {
        method: 'POST',
        body: JSON.stringify({ serviceAccountJson: parsed }),
      })
      if (!res.healthCheck.ok) {
        setStep2Error(`Connected with a warning: ${res.healthCheck.detail}`)
        return
      }
      navigate(`/projects/${project!.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setStep2Error(err.message)
        return
      }
      if (err instanceof SyntaxError) {
        setStep2Error('That is not valid JSON — paste the full service-account file contents.')
        return
      }
      setStep2Error(err instanceof ApiError ? err.message : 'Connection failed.')
    } finally {
      setStep2Busy(false)
    }
  }

  async function connectWebhook() {
    setStep2Error(null)
    setStep2Busy(true)
    try {
      const res = await api<WebhookConnectResult>(`/v1/projects/${project!.id}/connectors/webhook`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setWebhookResult(res)
    } catch (err) {
      setStep2Error(err instanceof ApiError ? err.message : 'Could not create webhook connector.')
    } finally {
      setStep2Busy(false)
    }
  }

  if (phase === 'connect' && project) {
    return (
      <div className="mx-auto mt-8 max-w-2xl">
        <div className="card">
          <p className="badge badge-success">Project created</p>
          <h1 className="mt-3 font-inter text-2xl font-semibold">Want to connect live data?</h1>
          <p className="mt-1 text-sm text-slate">
            {project.name} is registered. Attach a connector now, or do it later — name-only is a valid end state.{' '}
            <Link to="/learn/connect" className="text-link-emphasis text-link">Where do the credentials come from? →</Link>
          </p>

          {!connectorChoice && !webhookResult && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button className="card card-hover text-left" onClick={() => setConnectorChoice('firebase')}>
                <p className="font-medium">Firebase</p>
                <p className="mt-1 text-sm text-slate">Service-account JSON · health check runs immediately · polls user + error metrics.</p>
              </button>
              <button className="card card-hover text-left" onClick={() => { setConnectorChoice('webhook'); void connectWebhook() }}>
                <p className="font-medium">Generic Webhook</p>
                <p className="mt-1 text-sm text-slate">Any backend pushes signed events to a unique ingest URL.</p>
              </button>
            </div>
          )}

          {connectorChoice === 'firebase' && (
            <div className="mt-6">
              <SaJsonUpload
                disabled={step2Busy}
                onInvalid={(m) => setStep2Error(m)}
                onLoaded={(text) => {
                  setSaJson(text)
                  if (text) setStep2Error(null)
                }}
              />
              <label className="mt-3 flex flex-col gap-1 text-sm font-medium">
                Service-account JSON (read-only roles recommended){' '}
                <Link to="/learn/connect#firebase" className="text-link-emphasis text-link font-normal">
                  Where do I find this? →
                </Link>
                <textarea
                  className="input font-mono text-xs"
                  rows={8}
                  placeholder='Paste the full service-account JSON file…'
                  value={saJson}
                  onChange={(e) => setSaJson(e.target.value)}
                />
              </label>
              {step2Error && <p className="mt-2 text-sm text-coral-emphasis">{step2Error}</p>}
              <div className="mt-4 flex gap-3">
                <button className="btn-primary" disabled={step2Busy || !saJson.trim()} onClick={() => void connectFirebase()}>
                  {step2Busy ? 'Checking…' : 'Connect + run health check'}
                </button>
                <button className="btn-ghost" onClick={() => setConnectorChoice(null)}>Back</button>
              </div>
            </div>
          )}

          {(connectorChoice === 'webhook' || webhookResult) && (
            <div className="mt-6">
              {step2Busy && !webhookResult && <p className="text-sm text-slate">Generating ingest URL…</p>}
              {webhookResult && (
                <>
                  <div className="rounded-lg bg-ash-canvas p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate">Ingest URL</p>
                    <code className="mt-1 block break-all text-sm">{webhookResult.ingestUrl}</code>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate">Signing secret — shown once</p>
                    <code className="mt-1 block break-all text-sm">{webhookResult.signingSecret}</code>
                    <button
                      className="btn-ghost mt-2"
                      onClick={() => {
                        void navigator.clipboard.writeText(webhookResult.signingSecret)
                        setSecretCopied(true)
                      }}
                    >
                      {secretCopied ? 'Copied ✓' : 'Copy secret'}
                    </button>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-inkwell-navy p-4 text-xs text-paper-white">
                    {webhookResult.snippet.node}
                  </pre>
                  <p className="mt-2 text-sm text-slate">
                    Status is <span className="badge">pending</span> until the first verified event arrives — then it flips to connected automatically.{' '}
                    <Link to="/learn/connect#webhook" className="text-link-emphasis text-link">How to sign events →</Link>
                  </p>
                </>
              )}
              {step2Error && <p className="mt-2 text-sm text-coral-emphasis">{step2Error}</p>}
            </div>
          )}

          <div className="mt-6 border-t border-warm-stone pt-4">
            <Link to={project ? `/projects/${project.id}` : '/'} className="text-link">
              {webhookResult ? 'Done — open project dashboard →' : 'Skip for now — open project dashboard →'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-8 max-w-xl">
      <div className="card">
        <h1 className="font-inter text-2xl font-semibold">Add project</h1>
        <p className="mt-1 text-sm text-slate">Only the name is required. Everything else can be filled in later.</p>
        <form onSubmit={(e) => void onCreate(e)} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name *
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tabmeet" />
          </label>
          <button type="button" className="text-link self-start text-sm" onClick={() => setShowOptional((s) => !s)}>
            {showOptional ? 'Hide optional fields −' : 'Add details (optional) +'}
          </button>
          {showOptional && (
            <>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Description
                <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Stack tags (comma-separated)
                <input className="input" value={stackTags} onChange={(e) => setStackTags(e.target.value)} placeholder="firebase, react, typescript" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Repo URL
                  <input className="input" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Live URL
                  <input className="input" value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Environment
                <select className="input" value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                  <option value="">—</option>
                  <option value="production">production</option>
                  <option value="staging">staging</option>
                  <option value="development">development</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
            </>
          )}
          {error && <p className="text-sm text-coral-emphasis">{error}</p>}
          <button className="btn-primary" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Create project'}
          </button>
          <p className="text-sm text-slate">
            Not sure what to connect? <Link to="/learn/connect" className="text-link-emphasis text-link">How connecting works →</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
