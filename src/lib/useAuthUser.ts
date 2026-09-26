import { useEffect, useState } from 'react'
import { getSessionUser, refreshUser, subscribeSession, type BackendUser } from './session'

/**
 * Shared auth-state hook for components outside App's prop drilling
 * (SiteNav, account surfaces, …). `undefined` = still resolving the
 * persisted session, `null` = signed out.
 */
export function useAuthUser(): BackendUser | null | undefined {
  const [user, setUser] = useState<BackendUser | null | undefined>(() => getSessionUser())
  useEffect(() => {
    let cancelled = false
    const unsub = subscribeSession((u) => {
      if (!cancelled) setUser(u)
    })
    void refreshUser()
    return () => {
      cancelled = true
      unsub()
    }
  }, [])
  return user
}
