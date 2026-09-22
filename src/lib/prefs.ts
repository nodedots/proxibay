import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * User preferences, stored on the existing `users/{uid}` doc (owner-only per
 * firestore.rules) under a single `prefs` map so consent fields stay untouched.
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

export async function loadUserPrefs(uid: string): Promise<UserPrefs> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    const raw = snap.exists() ? (snap.data() as { prefs?: Partial<UserPrefs> }).prefs : undefined
    return { ...DEFAULT_PREFS, ...(raw ?? {}) }
  } catch {
    // Offline / rules-mismatch: fall back to defaults rather than block settings UI.
    return DEFAULT_PREFS
  }
}

export async function saveUserPrefs(uid: string, prefs: UserPrefs): Promise<void> {
  await setDoc(doc(db, 'users', uid), { prefs }, { merge: true })
}
