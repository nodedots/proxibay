import { api } from './api'
import { importStartUrl } from './session'
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

const importFlagKey = 'stackduck:import-after-login'

/** Only auto-prompt the picker for a genuinely new connection (no nagging). */
export async function flagImportPromptIfNew(kind: OAuthKind): Promise<void> {
  try {
    const res = await api<{ integrations: Array<{ provider: string }> }>('/v1/integrations')
    if (!res.integrations.some((i) => i.provider === kind)) flagImportPrompt(kind)
  } catch {
    // Offline — stay quiet rather than nag.
  }
}

/** Set after an import OAuth dance stored a fresh token — portfolio auto-opens the picker once. */
export function flagImportPrompt(kind: OAuthKind) {
  try {
    sessionStorage.setItem(importFlagKey, kind)
  } catch {
    // Private mode — skip the auto-prompt.
  }
}
export function consumeImportPrompt(): OAuthKind | null {
  try {
    const v = sessionStorage.getItem(importFlagKey)
    sessionStorage.removeItem(importFlagKey)
    return v === 'github' || v === 'google' ? v : null
  } catch {
    return null
  }
}

/**
 * Interactive auth for import flows. Full-page redirect to the backend
 * import-time authorize endpoint (import scopes live there, never at
 * sign-in). Resolves on return via /portfolio?import= — see PortfolioHome.
 */
export async function authForImport(kind: OAuthKind): Promise<null> {
  window.location.href = await importStartUrl(kind)
  return null
}

/** List candidates through the backend proxy (stored token never leaves the server). */
export async function listImportCandidates(
  kind: OAuthKind,
): Promise<{ items: ImportItem[]; redirected: boolean }> {
  const res = await api<{ items: ImportItem[] }>(`/v1/integrations/${kind}/repos`)
  return { items: res.items, redirected: false }
}

export interface ImportSelection {
  name: string
  repoUrl?: string
  externalId?: string
}

/** Creates one Project per selection via the API. */
export async function importSelected(selections: ImportSelection[]): Promise<void> {
  for (const s of selections) {
    const body: Record<string, unknown> = { name: s.name }
    if (s.repoUrl) body.repoUrl = s.repoUrl
    // No structured GCP-link field in the v1 model — keep it visible in notes.
    if (s.externalId) body.notes = `Imported from GCP project ${s.externalId}.`
    await api<CreatedProject>('/v1/projects', { method: 'POST', body: JSON.stringify(body) })
  }
}
