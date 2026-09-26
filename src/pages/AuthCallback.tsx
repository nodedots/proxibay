import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { flagImportPromptIfNew } from '../lib/oauth'
import { adoptTokens } from '../lib/session'

/**
 * OAuth landing: the backend redirects here with a fresh token pair in the
 * query string. Stored immediately (clearing it from history), then into
 * the portfolio — flagging the import picker for first-time providers.
 */
export default function AuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const access = params.get('accessToken')
    const refresh = params.get('refreshToken')
    if (!access || !refresh) {
      setError('That sign-in didn’t complete. Try again.')
      return
    }
    window.history.replaceState({}, '', '/auth/callback')
    void adoptTokens(access, refresh)
      .then(async (user) => {
        if (!user) {
          setError('That sign-in didn’t complete. Try again.')
          return
        }
        for (const p of user.providers) {
          if (p === 'google' || p === 'github') await flagImportPromptIfNew(p)
        }
        navigate('/portfolio', { replace: true })
      })
      .catch(() => setError('That sign-in didn’t complete. Try again.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!error) return <p className="p-8 text-ink-muted">Finishing sign-in…</p>
  return (
    <main className="mx-auto max-w-md px-6 pt-24 text-center">
      <p className="font-inter text-base font-semibold">{error}</p>
      <button className="btn-primary mt-4" onClick={() => navigate('/signin', { replace: true })}>
        Back to sign in
      </button>
    </main>
  )
}
