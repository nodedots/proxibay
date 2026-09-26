import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { StackduckLockup } from '../components/Logo'
import { api, ApiError } from '../lib/api'
import { adoptTokens, oauthStartUrl, refreshUser, subscribeSession } from '../lib/session'
import type { OAuthKind } from '../lib/oauth'

type Mode = 'signin' | 'signup'

function AuthVisual() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden bg-inkwell-navy p-10 text-paper-white lg:flex lg:flex-col lg:justify-between xl:p-14">
      <div className="absolute inset-0 opacity-30" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#ffffff 0.7px, transparent 0.7px)', backgroundSize: '22px 22px', maskImage: 'linear-gradient(to bottom, black, transparent 75%)' }} />
      <div className="relative z-10 flex items-center gap-2.5">
        <StackduckLockup dark to={null} markSize={34} />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-[560px] py-12">
        <p className="mb-4 font-inter text-xs font-semibold uppercase tracking-[0.16em] text-mint-pulse">One clear view</p>
        <h2 className="max-w-lg font-display text-4xl font-semibold leading-tight xl:text-5xl">Your projects,<br />all in good shape.</h2>
        <p className="mt-4 max-w-md font-inter text-base leading-relaxed text-white/70">Health, users, errors and revenue together in one calm place.</p>
        <div className="mt-10 rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div><p className="font-inter text-sm font-medium">Project health</p><p className="mt-1 font-inter text-xs text-white/55">Across your portfolio</p></div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-mint-pulse/25 bg-mint-pulse/10 px-2.5 py-1.5 font-inter text-xs font-medium text-mint-pulse"><span className="h-1.5 w-1.5 rounded-full bg-mint-pulse" />All systems normal</span>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 py-5 text-center">
            <div><p className="font-display text-2xl font-semibold">08</p><p className="mt-1 font-inter text-xs text-white/55">Projects</p></div>
            <div><p className="font-display text-2xl font-semibold">99.9%</p><p className="mt-1 font-inter text-xs text-white/55">Uptime</p></div>
            <div><p className="font-display text-2xl font-semibold">24.8k</p><p className="mt-1 font-inter text-xs text-white/55">Users</p></div>
          </div>
          <div className="flex h-24 items-end gap-2 border-t border-white/10 pt-4" aria-hidden="true">
            {[28, 44, 36, 62, 48, 72, 55, 80, 61, 92, 68, 76, 58, 88, 70, 100, 78, 90].map((height, i) => <span key={i} className={`flex-1 rounded-t-sm ${i === 15 ? 'bg-coral-emphasis' : 'bg-mint-pulse/70'}`} style={{ height: `${height}%` }} />)}
          </div>
        </div>
      </div>
      <p className="relative z-10 font-inter text-xs text-white/45">Less dashboard work. More time for the work that matters.</p>
    </aside>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

/** Friendly copy for auth failures — never leaks internals. */
function friendlyError(code: string, mode: Mode): string {
  switch (code) {
    case 'invalid_credentials':
      return 'Invalid email or password.'
    case 'email_taken':
      return 'That email is already registered — sign in instead.'
    case 'consent_required':
      return 'Please agree to the Privacy Policy and Terms of Service first.'
    case 'invalid_refresh':
      return 'Session expired — sign in again.'
    case 'invalid_reset':
      return 'That reset link is invalid or expired — request a fresh one below.'
    default:
      return mode === 'signup'
        ? 'Couldn’t create your account. Check the details and try again.'
        : 'Couldn’t sign you in. Check the details and try again.'
  }
}

interface TokenPair {
  accessToken: string
  refreshToken: string
}

/**
 * Auth card: Sign in / Create account tabs, email + Google/GitHub (backend
 * OAuth), password reset. Consent checkbox gates signup.
 */
export default function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(() =>
    params.get('oauth') === 'failed'
      ? 'That provider sign-in didn’t complete. Try again.'
      : null,
  )
  const [busy, setBusy] = useState(false)

  // Password reset states: request form, or confirm form via ?reset=token link.
  const [recovering, setRecovering] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const resetToken = params.get('reset')
  const [newPassword, setNewPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)

  // Already signed in (and not here via a reset link) → straight to the app.
  useEffect(() => {
    if (resetToken) return
    const unsub = subscribeSession((u) => {
      if (u) navigate('/portfolio', { replace: true })
    })
    void refreshUser()
    return unsub
  }, [navigate, resetToken])

  const isSignup = mode === 'signup'

  function switchMode(next: Mode) {
    setMode(next)
    setRecovering(false)
    setResetSent(false)
    setError(null)
    setConsent(false)
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (isSignup && !consent) {
      setError(friendlyError('consent_required', mode))
      return
    }
    setBusy(true)
    try {
      const pair = await api<TokenPair>(isSignup ? '/v1/auth/register' : '/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(
          isSignup
            ? { email: email.trim(), password, consent: true }
            : { email: email.trim(), password },
        ),
      })
      await adoptTokens(pair.accessToken, pair.refreshToken)
      navigate('/portfolio')
    } catch (err) {
      setError(err instanceof ApiError ? friendlyError(err.code, mode) : friendlyError('', mode))
    } finally {
      setBusy(false)
    }
  }

  async function onOAuth(kind: OAuthKind) {
    if (isSignup && !consent) {
      setError(friendlyError('consent_required', mode))
      return
    }
    setBusy(true)
    window.location.href = await oauthStartUrl(kind, isSignup)
  }

  async function onPasswordResetRequest(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api<{ ok: boolean }>('/v1/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      })
      setResetSent(true)
    } catch {
      setError('Couldn’t send a reset link right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onPasswordResetConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api<{ ok: boolean }>('/v1/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      })
      setResetDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? friendlyError(err.code, mode) : friendlyError('', mode))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <section className="order-1 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:order-2">
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-elevated p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <StackduckLockup to={null} markSize={30} />
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 font-inter text-sm text-ink-muted transition-colors hover:bg-inset hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />Home</Link>
        </div>
        {resetToken ? (
          <div className="mt-8">
            <h1 className="font-inter text-2xl font-semibold text-ink">Choose a new password</h1>
            <p className="mt-2 font-inter text-sm leading-relaxed text-ink-muted">This link works once and expires an hour after it was sent.</p>
            {resetDone ? (
              <p role="status" className="mt-6 rounded-lg border border-line bg-inset p-4 font-inter text-sm text-ink">
                Password updated. <Link to="/signin" className="text-link" onClick={() => window.location.replace('/signin')}>Sign in</Link> with the new one.
              </p>
            ) : (
              <form onSubmit={(e) => void onPasswordResetConfirm(e)} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1 font-inter text-sm font-medium text-ink" htmlFor="new-password">New password
                  <input id="new-password" className="input" type="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </label>
                {error && <p role="alert" className="font-inter text-sm text-coral-emphasis">{error}</p>}
                <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
              </form>
            )}
          </div>
        ) : recovering ? (
          <div className="mt-8">
            <h1 className="font-inter text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="mt-2 font-inter text-sm leading-relaxed text-ink-muted">Enter the email address on your account and we’ll send you a link to choose a new password.</p>
            {resetSent ? (
              <p role="status" className="mt-6 rounded-lg border border-line bg-inset p-4 font-inter text-sm text-ink">If that email has an account, a reset link is on its way. Check your inbox, then return here to sign in.</p>
            ) : (
              <form onSubmit={(e) => void onPasswordResetRequest(e)} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1 font-inter text-sm font-medium text-ink" htmlFor="reset-email">Email<input id="reset-email" className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                {error && <p role="alert" className="font-inter text-sm text-coral-emphasis">{error}</p>}
                <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'}</button>
              </form>
            )}
            <button className="mt-5 inline-flex items-center gap-1.5 font-inter text-sm text-link" onClick={() => { setRecovering(false); setResetSent(false); setError(null) }}><ArrowLeft size={15} aria-hidden="true" />Back to sign in</button>
          </div>
        ) : <>
        <div className="mt-7 flex gap-1 rounded-lg bg-inset p-1" role="tablist" aria-label="Sign in or create account">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`min-h-11 flex-1 rounded-md px-3 font-inter text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === m
                  ? 'bg-elevated text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h1 className="mt-5 font-inter text-2xl font-semibold text-ink">
          {isSignup ? 'Create your account' : 'Sign in to Stackduck'}
        </h1>
        <p className="mt-1.5 font-inter text-sm font-normal text-ink-muted">
          {isSignup
            ? 'One account for your whole portfolio. It takes less than a minute.'
            : 'Enter your email and password to continue.'}
        </p>

        <div key={mode} className="fade-swap">
          <div className="mt-5 flex flex-col gap-2.5">
            {(['google', 'github'] as OAuthKind[]).map((kind) => (
              <button key={kind} className="btn-ghost flex w-full items-center justify-center gap-2" disabled={busy || (isSignup && !consent)} onClick={() => void onOAuth(kind)}>
                {kind === 'google' ? <GoogleIcon /> : <GitHubIcon />}
                {`Continue with ${kind === 'google' ? 'Google' : 'GitHub'}`}
              </button>
            ))}
          </div>

          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            <span className="font-inter text-xs font-medium text-ink-muted">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={(e) => void onEmailSubmit(e)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 font-inter text-sm font-medium text-ink" htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                className="input"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 font-inter text-sm font-medium text-ink" htmlFor="auth-password">
              Password
              <input
                id="auth-password"
                className="input"
                type="password"
                required
                minLength={isSignup ? 8 : undefined}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {!isSignup && <div className="-mt-2 flex justify-end"><button type="button" className="text-link text-sm" onClick={() => { setRecovering(true); setError(null) }}>Forgot password?</button></div>}

            {isSignup && (
              <label className="flex cursor-pointer items-start gap-2 font-inter text-sm font-normal text-ink-muted" htmlFor="auth-consent">
                <input
                  id="auth-consent"
                  type="checkbox"
                  className="mt-[1px] h-[18px] w-[18px] shrink-0 accent-primary"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  I agree to the{' '}
                  <Link to="/privacy" target="_blank" rel="noreferrer" className="text-link-emphasis text-link">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link to="/terms" target="_blank" rel="noreferrer" className="text-link-emphasis text-link">
                    Terms of Service
                  </Link>
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="font-inter text-sm text-coral-emphasis">
                {error}
              </p>
            )}
            <button className="btn-primary w-full" type="submit" disabled={busy || (isSignup && !consent)}>
              {busy ? (isSignup ? 'Creating account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center font-inter text-sm font-normal text-ink-muted">
            {isSignup ? (
              <>Already have an account? <button className="text-link" onClick={() => switchMode('signin')}>Sign in</button></>
            ) : (
              <>Don’t have an account? <button className="text-link" onClick={() => switchMode('signup')}>Create one</button></>
            )}
          </p>
        </div>
        </>}
      </div></section><div className="order-2 lg:order-1"><AuthVisual /></div>
    </main>
  )
}
