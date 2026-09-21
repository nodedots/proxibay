import {
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  linkWithRedirect,
  signInWithPopup,
  signInWithRedirect,
  type UserCredential,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { api } from './api'
import { createProjectDirect, withFallback } from './store'
import type { CreatedProject } from './contracts'

export type OAuthKind = 'github' | 'google'

export interface ImportItem {
  /** stable id (repo id / GCP project id) */
  key: string
  /** default project name (editable in the picker) */
  name: string
  /** second line: "Private · updated 2d ago" / "Project 123…" */
  subtitle: string
  /** pre-filled repoUrl (GitHub) — undefined for GCP */
  url?: string
  /** GCP project id for catalog notes — undefined for GitHub */
  externalId?: string
}

/** Popup on desktop, redirect on small viewports (popup-blocker guidance). */
export function prefersRedirect(): boolean {
  return window.matchMedia('(max-width: 640px)').matches;
}

export function buildProvider(kind: OAuthKind) {
  return kind === 'github' ? new GithubAuthProvider() : new GoogleAuthProvider()
}

/**
 * Import-time providers with the extra data scopes. Requested LAZILY (never at
 * sign-in): Google rejects restricted scopes on a plain login with
 * `invalid_scope`, which would break sign-in entirely. Incremental auth at
 * import time keeps login working while verification is pending.
 */
export function buildImportProvider(kind: OAuthKind) {
  if (kind === 'github') {
    // `repo` scope: list private repos too, not just public ones.
    const p = new GithubAuthProvider()
    p.addScope('repo')
    return p
  }
  // Restricted scope: GCP project listing. Test-users-only until Google verifies.
  const p = new GoogleAuthProvider()
  p.addScope('https://www.googleapis.com/auth/cloudplatform.read-only')
  return p
}

/** Pulls the OAuth access token out of a completed sign-in. */
export function tokenFromResult(kind: OAuthKind, result: UserCredential): string | null {
  const cred =
    kind === 'github'
      ? GithubAuthProvider.credentialFromResult(result)
      : GoogleAuthProvider.credentialFromResult(result)
  return cred?.accessToken ?? null
}

/** Persist the signup consent record (users/{uid}). */
export async function recordConsent(uid: string, email: string | null) {
  await setDoc(
    doc(db, 'users', uid),
    { email, consentAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true },
  )
}

const sessionKey = (kind: OAuthKind) => `proxibay:oauth:${kind}`
const consentGivenKey = 'proxibay:consent-given'

/** Marked before a signup-mode redirect so the return handler may record consent. */
export function markConsentGiven() {
  sessionStorage.setItem(consentGivenKey, '1')
}
/** Consumed once by the redirect-result handler. */
export function consumeConsentGiven(): boolean {
  const v = sessionStorage.getItem(consentGivenKey) === '1'
  sessionStorage.removeItem(consentGivenKey)
  return v
}
const importFlagKey = 'proxibay:import-after-login'

/**
 * Token storage. Prefers the backend (Secret Manager + reference in
 * users/{uid}.oauth) via POST /v1/integrations/:provider/token; falls back to
 * tab-scoped sessionStorage when the API is unreachable (no raw tokens ever
 * go into Firestore).
 */
export async function persistToken(kind: OAuthKind, token: string): Promise<void> {
  try {
    const res = await api<{ credentialsRef: string }>(`/v1/integrations/${kind}/token`, {
      method: 'POST',
      body: JSON.stringify({ accessToken: token }),
    })
    const uid = auth.currentUser?.uid
    if (!uid) throw new Error('signed out')
    await setDoc(
      doc(db, 'users', uid),
      { oauth: { [kind]: { credentialsRef: res.credentialsRef, updatedAt: new Date().toISOString() } } },
      { merge: true },
    )
  } catch {
    sessionStorage.setItem(sessionKey(kind), token)
  }
}

export function readSessionToken(kind: OAuthKind): string | null {
  return sessionStorage.getItem(sessionKey(kind))
}

/** True when a usable token is already stored (session or backend reference). */
export async function hasStoredToken(kind: OAuthKind): Promise<boolean> {
  if (readSessionToken(kind)) return true
  try {
    const uid = auth.currentUser?.uid
    if (!uid) return false
    const snap = await getDoc(doc(db, 'users', uid))
    const ref = (snap.data() as { oauth?: Record<string, { credentialsRef?: string }> } | undefined)
      ?.oauth?.[kind]?.credentialsRef
    return !!ref
  } catch {
    return false
  }
}

/** Only auto-prompt the picker for a genuinely new connection (no nagging). */
export async function flagImportPromptIfNew(kind: OAuthKind): Promise<void> {
  if (!(await hasStoredToken(kind))) flagImportPrompt(kind)
}

/** Set after a social auth that captured a fresh token — portfolio auto-opens the picker once. */
export function flagImportPrompt(kind: OAuthKind) {
  sessionStorage.setItem(importFlagKey, kind)
}
export function consumeImportPrompt(): OAuthKind | null {
  const v = sessionStorage.getItem(importFlagKey)
  sessionStorage.removeItem(importFlagKey)
  return v === 'github' || v === 'google' ? v : null
}

/**
 * Interactive auth for import flows. Links the provider to the current account
 * when it isn't linked yet (never silently switches identity); re-authenticates
 * when it is. Returns an access token, or null when a redirect was started
 * (the result arrives via the App-level redirect handler on return, which
 * re-flags the import prompt).
 */
export async function authForImport(kind: OAuthKind): Promise<string | null> {
  const existing = readSessionToken(kind)
  if (existing) return existing
  const user = auth.currentUser
  const providerId = kind === 'github' ? 'github.com' : 'google.com'
  const linked = !!user?.providerData.some((p) => p.providerId === providerId)
  // Import-time scopes (repo / cloudplatform.read-only) — never at sign-in.
  const provider = buildImportProvider(kind)
  if (prefersRedirect()) {
    sessionStorage.setItem(importFlagKey, kind)
    if (!user) await signInWithRedirect(auth, provider)
    else if (linked) await signInWithRedirect(auth, provider)
    else await linkWithRedirect(user, provider)
    return null
  }
  const result = !user
    ? await signInWithPopup(auth, provider)
    : linked
      ? await signInWithPopup(auth, provider)
      : await linkWithPopup(user, provider)
  const token = tokenFromResult(kind, result)
  if (!token) throw new Error('no-token')
  await persistToken(kind, token)
  return token
}

/** GET /user/repos, paginated via Link headers. */
export async function fetchGithubRepos(token: string): Promise<ImportItem[]> {
  const items: ImportItem[] = []
  let url: string | null = 'https://api.github.com/user/repos?per_page=100&sort=updated'
  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`github-${res.status}`)
    const repos = (await res.json()) as Array<{
      id: number; name: string; html_url: string; private: boolean; pushed_at: string | null
    }>
    for (const r of repos) {
      items.push({
        key: `gh-${r.id}`,
        name: r.name,
        subtitle: `${r.private ? 'Private' : 'Public'} · pushed ${r.pushed_at ? r.pushed_at.slice(0, 10) : 'never'}`,
        url: r.html_url,
      })
    }
    const link = res.headers.get('link') ?? ''
    const next = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null
    url = next
  }
  return items
}

/** Cloud Resource Manager projects.list, paginated. */
export async function fetchGcpProjects(token: string): Promise<ImportItem[]> {
  const items: ImportItem[] = []
  let pageToken = ''
  for (;;) {
    const url =
      `https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`gcp-${res.status}`)
    const data = (await res.json()) as {
      projects?: Array<{ projectId: string; name: string; projectNumber: string; lifecycleState?: string }>
      nextPageToken?: string
    }
    for (const p of data.projects ?? []) {
      if (p.lifecycleState && p.lifecycleState !== 'ACTIVE') continue
      items.push({
        key: `gcp-${p.projectId}`,
        name: p.name || p.projectId,
        subtitle: `GCP project ${p.projectId} · #${p.projectNumber}`,
        externalId: p.projectId,
      })
    }
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return items
}

/** Server-side list proxy (uses the stored token); null when the API is down. */
async function listViaApi(kind: OAuthKind): Promise<ImportItem[] | null> {
  try {
    const res = await api<{ items: ImportItem[] }>(`/v1/integrations/${kind}/repos`)
    return res.items
  } catch {
    return null
  }
}

/** List candidates: backend proxy first, direct provider API with session token second. */
export async function listImportCandidates(
  kind: OAuthKind,
): Promise<{ items: ImportItem[]; redirected: boolean }> {
  const viaApi = await listViaApi(kind)
  if (viaApi) return { items: viaApi, redirected: false }
  return listDirectWithRetry(kind, false)
}

/** Direct provider fetch; on 401 (expired/revoked token) drops it and re-auths once. */
async function listDirectWithRetry(
  kind: OAuthKind,
  retried: boolean,
): Promise<{ items: ImportItem[]; redirected: boolean }> {
  const token = await authForImport(kind)
  // Null token = a redirect started; the auto-prompt reopens the picker on return.
  if (!token) return { items: [], redirected: true }
  try {
    const items = kind === 'github' ? await fetchGithubRepos(token) : await fetchGcpProjects(token)
    return { items, redirected: false }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (!retried && /401/.test(msg)) {
      sessionStorage.removeItem(sessionKey(kind))
      return listDirectWithRetry(kind, true)
    }
    throw e
  }
}

export interface ImportSelection {
  name: string
  repoUrl?: string
  externalId?: string
}

/** Creates one Project per selection (API first, direct Firestore fallback). */
export async function importSelected(selections: ImportSelection[]): Promise<void> {
  for (const s of selections) {
    const body: Record<string, unknown> = { name: s.name }
    if (s.repoUrl) body.repoUrl = s.repoUrl
    // No structured GCP-link field in the v1 model (D22) — keep it visible in notes.
    if (s.externalId) body.notes = `Imported from GCP project ${s.externalId}.`
    await withFallback(
      () => api<CreatedProject>('/v1/projects', { method: 'POST', body: JSON.stringify(body) }),
      async () => ({
        project: await createProjectDirect(body as Parameters<typeof createProjectDirect>[0]),
      }),
    )
  }
}
