import { useCallback, useEffect, useState } from 'react'

/**
 * UI theme preference — Light / Dark / System.
 * Persisted in localStorage only: it's a UI preference, not app data, so it
 * never touches Firestore. Fresh visitors always get Light (never System) —
 * the inline script in index.html applies the stored choice pre-paint.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'proxibay-theme'

export function readThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    // Storage unavailable (private mode) — fall through to the default.
  }
  return 'light'
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== 'system') return choice
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
}

/**
 * Current choice + resolved theme. When the choice is `system`, a live
 * matchMedia listener re-resolves if the OS setting changes mid-session.
 */
export function useTheme(): {
  choice: ThemeChoice
  resolved: ResolvedTheme
  setChoice: (c: ThemeChoice) => void
} {
  const [choice, setChoiceState] = useState<ThemeChoice>(readThemeChoice)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(choice))

  useEffect(() => {
    const update = () => {
      const r = resolveTheme(choice)
      setResolved(r)
      applyTheme(r)
    }
    update()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [choice])

  const setChoice = useCallback((c: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, c)
    } catch {
      // Storage unavailable — theme still applies for this session.
    }
    setChoiceState(c)
  }, [])

  return { choice, resolved, setChoice }
}
