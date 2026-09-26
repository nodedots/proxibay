import { api } from './api'
import { getSessionUser } from './session'

/**
 * User preferences, stored on the backend user row (`prefs` column, merged
 * against an allowlist server-side). Falls back to defaults when signed out.
 */
export interface UserPrefs {
  /** Default chart window on project detail, in days. */
  defaultWindowDays: 7 | 30 | 90
  /** Portfolio home sort order. */
  portfolioSort: 'updated' | 'name'
  /** Email: occasional product announcements. */
  emailProductUpdates: boolean
  /** Email: weekly metrics digest per project. */
  emailWeeklyDigest: boolean
}

export const DEFAULT_PREFS: UserPrefs = {
  defaultWindowDays: 30,
  portfolioSort: 'updated',
  emailProductUpdates: true,
  emailWeeklyDigest: true,
}

export function coercePrefs(raw: unknown): UserPrefs {
  const r = (raw ?? {}) as Partial<UserPrefs>
  return {
    defaultWindowDays: r.defaultWindowDays === 7 || r.defaultWindowDays === 90 ? r.defaultWindowDays : 30,
    portfolioSort: r.portfolioSort === 'name' ? 'name' : 'updated',
    emailProductUpdates: r.emailProductUpdates === false ? false : true,
    emailWeeklyDigest: r.emailWeeklyDigest === false ? false : true,
  }
}

export async function loadUserPrefs(): Promise<UserPrefs> {
  try {
    const user = getSessionUser()
    if (user?.prefs) return coercePrefs(user.prefs)
    const res = await api<{ user: { prefs?: Partial<UserPrefs> | null } }>('/v1/auth/me')
    return coercePrefs(res.user.prefs)
  } catch {
    return DEFAULT_PREFS
  }
}

export async function saveUserPrefs(prefs: UserPrefs): Promise<UserPrefs> {
  const res = await api<{ user: { prefs?: Partial<UserPrefs> | null } }>('/v1/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ prefs }),
  })
  return coercePrefs(res.user.prefs)
}
