import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '../firebase'

/**
 * Shared auth-state hook for components outside App's prop drilling
 * (SiteNav, account surfaces, …). `undefined` = still resolving the
 * persisted session, `null` = signed out.
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])
  return user
}
