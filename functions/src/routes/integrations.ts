import { Router } from 'express'
import { Timestamp, getFirestore } from 'firebase-admin/firestore'
import { AuthedRequest, err } from '../auth.js'
import { storeSecret, accessSecret } from '../secrets.js'

export const integrationsRouter = Router()

const PROVIDERS = ['github', 'google'] as const
type Provider = (typeof PROVIDERS)[number]

interface ImportItem {
  key: string
  name: string
  subtitle: string
  url?: string
  externalId?: string
}

/**
 * POST /v1/integrations/:provider/token — stores an OAuth access token in
 * Secret Manager, keeps only the reference in users/{uid}.oauth.
 */
integrationsRouter.post('/:provider/token', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const provider = req.params.provider as string
  if (!PROVIDERS.includes(provider as Provider)) {
    return err(res, 400, 'invalid_argument', 'Unknown provider.')
  }
  const { accessToken } = req.body ?? {}
  if (typeof accessToken !== 'string' || !accessToken) {
    return err(res, 400, 'invalid_argument', '"accessToken" is required.')
  }
  const credentialsRef = await storeSecret(`oauth-${uid}-${provider}`, accessToken)
  await getFirestore()
    .doc(`users/${uid}`)
    .set(
      {
        oauth: { [provider]: { credentialsRef, updatedAt: Timestamp.now() } },
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    )
  return res.status(201).json({ credentialsRef })
})

/**
 * GET /v1/integrations/:provider/repos — lists import candidates using the
 * stored token, so the secret never leaves the server.
 */
integrationsRouter.get('/:provider/repos', async (req: AuthedRequest, res) => {
  const uid = req.uid as string
  const provider = req.params.provider as string
  if (!PROVIDERS.includes(provider as Provider)) {
    return err(res, 400, 'invalid_argument', 'Unknown provider.')
  }
  const snap = await getFirestore().doc(`users/${uid}`).get()
  const ref = (snap.data() as { oauth?: Record<string, { credentialsRef?: string }> } | undefined)
    ?.oauth?.[provider]?.credentialsRef
  if (!ref) return err(res, 404, 'not_found', 'No stored token for this provider. Sign in again.')
  let token: string
  try {
    token = await accessSecret(ref)
  } catch {
    return err(res, 500, 'internal', 'Could not read the stored token.')
  }
  try {
    const items = provider === 'github' ? await githubRepos(token) : await gcpProjects(token)
    return res.json({ items })
  } catch {
    return err(res, 502, 'internal', 'The provider request failed. The token may have been revoked — sign in again.')
  }
})

async function githubRepos(token: string): Promise<ImportItem[]> {
  const items: ImportItem[] = []
  let url: string | null = 'https://api.github.com/user/repos?per_page=100&sort=updated'
  while (url) {
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!r.ok) throw new Error(`github ${r.status}`)
    const repos = (await r.json()) as Array<{
      id: number; name: string; html_url: string; private: boolean; pushed_at: string | null
    }>
    for (const repo of repos) {
      items.push({
        key: `gh-${repo.id}`,
        name: repo.name,
        subtitle: `${repo.private ? 'Private' : 'Public'} · pushed ${repo.pushed_at ? repo.pushed_at.slice(0, 10) : 'never'}`,
        url: repo.html_url,
      })
    }
    const link = r.headers.get('link') ?? ''
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null
  }
  return items
}

async function gcpProjects(token: string): Promise<ImportItem[]> {
  const items: ImportItem[] = []
  let pageToken = ''
  for (;;) {
    const url =
      `https://cloudresourcemanager.googleapis.com/v1/projects?pageSize=200` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!r.ok) throw new Error(`gcp ${r.status}`)
    const data = (await r.json()) as {
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
