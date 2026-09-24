import {
  GithubAuthProvider,
  GoogleAuthProvider,
  OAuthCredential,
} from 'firebase/auth'
import type { OAuthKind } from './oauth'

const PENDING_KEY = 'stackduck:pending-oauth-link'
const CONFLICT_EVENT = 'stackduck:oauth-conflict'

export interface PendingOAuthLink {
  kind: OAuthKind
  email: string | null
  credential: OAuthCredential
}

interface StoredOAuthLink {
  kind: OAuthKind
  email: string | null
  credential: object
}

export function captureOAuthConflict(kind: OAuthKind, error: unknown): PendingOAuthLink | null {
  const firebaseError = error as { code?: string; customData?: { email?: string } }
  if (firebaseError.code !== 'auth/account-exists-with-different-credential') return null
  const credential = kind === 'github'
    ? GithubAuthProvider.credentialFromError(error as Parameters<typeof GithubAuthProvider.credentialFromError>[0])
    : GoogleAuthProvider.credentialFromError(error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0])
  if (!credential) return null

  const pending: PendingOAuthLink = {
    kind,
    email: firebaseError.customData?.email ?? null,
    credential,
  }
  const stored: StoredOAuthLink = { kind, email: pending.email, credential: credential.toJSON() }
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(stored))
  } catch {
    return null
  }
  window.dispatchEvent(new Event(CONFLICT_EVENT))
  return pending
}

export function readOAuthConflict(): PendingOAuthLink | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredOAuthLink
    if (stored.kind !== 'github' && stored.kind !== 'google') return null
    const credential = OAuthCredential.fromJSON(stored.credential)
    if (!credential || credential.providerId !== `${stored.kind}.com`) return null
    return { kind: stored.kind, email: stored.email, credential }
  } catch {
    return null
  }
}

export function clearOAuthConflict() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

export function oauthConflictEventName() {
  return CONFLICT_EVENT
}

export function oauthLinkCompleteEventName() {
  return 'stackduck:oauth-link-complete'
}

export function oauthLinkFailedEventName() {
  return 'stackduck:oauth-link-failed'
}
