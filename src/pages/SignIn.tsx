import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import {
  buildProvider,
  flagImportPromptIfNew,
  markConsentGiven,
  persistToken,
  prefersRedirect,
  recordConsent,
  tokenFromResult,
  type OAuthKind,
} from '../lib/oauth'

type Mode = 'signin' | 'signup'

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

/** Friendly copy for auth failures — never leaks provider internals. */
function friendlyError(code: string, mode: Mode, detail = ''): string {
  if (/invalid.scope/i.test(code) || /invalid.scope/i.test(detail)) {
    return 'Google hasn’t enabled this level of access for Proxibay yet (verification is pending). Sign in with email or GitHub instead — importing can wait.'
  }
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.'
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.'
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Those credentials don’t match an account. Check your email and password and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'The sign-in window was closed before finishing. Try again.'
    case 'auth/account-exists-with-different-credential':
      return 'This email is already linked to a different sign-in method. Try that one instead.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t available right now. Try another one.'
    case 'no-token':
      return 'We couldn’t read your account list from that sign-in. Try again.'
    default:
      return mode === 'signup'
        ? 'Couldn’t create your account. Check the details and try again.'
        : 'Couldn’t sign you in. Check the details and try again.'
  }
}

/**
 * Auth modal: Sign in / Create account tabs, email + Google/GitHub.
 * Consent checkbox gates signup (email AND social). Copy is product-facing.
 */
export default function SignIn() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A signed-in user with no consent record must agree before entering.
  const [pendingConsent, setPendingConsent] = useState<{ uid: string; email: string | null } | null>(null)
  const pendingRef = useRef(false)
  pendingRef.current = pendingConsent !== null

  /** True when this user already has a consent record. Self-healing gate. */
  async function hasConsent(uid: string): Promise<boolean> {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      return snap.exists() && !!(snap.data() as { consentAt?: unknown }).consentAt
    } catch {
      return false
    }
  }

  /** Route post-login: enter the app, or hold on the consent interstitial. */
  async function enter(uid: string, email: string | null) {
    // Brief retries: the App-level redirect handler may still be writing a
    // pre-checked consent record from a signup-mode redirect.
    for (let i = 0; i < 4; i++) {
      if (await hasConsent(uid)) {
        navigate('/portfolio')
        return
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    setPendingConsent({ uid, email })
  }

  // Signed-in users are routed through the consent gate.
  // (OAuth redirect results are consumed once by the App-level handler.)
  useEffect(() => {
    let cancelled = false
    const unsub = auth.onAuthStateChanged((u) => {
      if (u && !cancelled && !pendingRef.current) {
        void enter(u.uid, u.email)
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [navigate])

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setConsent(false)
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await recordConsent(cred.user.uid, cred.user.email)
        navigate('/portfolio')
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        await enter(cred.user.uid, cred.user.email)
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(friendlyError(code, mode, err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  async function onOAuth(kind: OAuthKind) {
    if (mode === 'signup' && !consent) {
      setError('Please agree to the Privacy Policy and Terms of Service first.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      if (prefersRedirect()) {
        // Consent (signup mode) was already given via the checkbox; the
        // App-level return handler records it and re-flags the import prompt.
        if (mode === 'signup') markConsentGiven()
        await signInWithRedirect(auth, buildProvider(kind))
        return
      }
      const result = await signInWithPopup(auth, buildProvider(kind))
      const token = tokenFromResult(kind, result)
      if (token) {
        await persistToken(kind, token)
        await flagImportPromptIfNew(kind)
      }
      if (mode === 'signup' && getAdditionalUserInfo(result)?.isNewUser) {
        await recordConsent(result.user.uid, result.user.email)
        navigate('/portfolio')
      } else {
        await enter(result.user.uid, result.user.email)
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(friendlyError(code, mode, err instanceof Error ? err.message : ''))
    } finally {
      setBusy(false)
    }
  }

  async function onInterstitialContinue() {
    if (!pendingConsent || !consent) return
    setError(null)
    setBusy(true)
    try {
      await recordConsent(pendingConsent.uid, pendingConsent.email)
      setPendingConsent(null)
      setConsent(false)
      navigate('/portfolio')
    } catch {
      setError('Couldn’t save your agreement. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onDecline() {
    await auth.signOut().catch(() => undefined)
    setPendingConsent(null)
    setConsent(false)
  }

  const isSignup = mode === 'signup'

  function closeToHome() {
    navigate('/')
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape dismisses the auth card. The consent interstitial intentionally
      // has no Escape path — agree or sign out explicitly, no accidents.
      if (e.key === 'Escape' && !pendingRef.current) closeToHome()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (pendingConsent) {
    return (
      <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-heading"
          className="modal-pop w-full max-w-md rounded-2xl bg-elevated p-5 shadow-sm-2"
        >
          <button
            onClick={() => void onDecline().then(() => navigate('/'))}
            aria-label="Close and sign out"
            title="Close"
            className="float-right -mr-1 -mt-1 rounded-lg px-2 py-1 font-inter text-xl leading-none text-ink-muted hover:bg-inset hover:text-ink"
          >
            ×
          </button>
          <h1 id="consent-heading" className="font-inter text-2xl font-semibold text-ink">
            One more step
          </h1>
          <p className="mt-2 font-inter text-sm font-normal text-ink-muted">
            Before you continue, please agree to how Proxibay handles your data.
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-2 font-inter text-sm font-normal text-ink-muted" htmlFor="auth-consent-late">
            <input
              id="auth-consent-late"
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
          {error && (
            <p role="alert" className="mt-3 font-inter text-sm text-coral-emphasis">
              {error}
            </p>
          )}
          <button className="btn-primary mt-4 w-full" disabled={busy || !consent} onClick={() => void onInterstitialContinue()}>
            {busy ? 'Saving…' : 'Agree and continue'}
          </button>
          <p className="mt-4 text-center font-inter text-sm font-normal text-ink-muted">
            Changed your mind? <button className="text-link" onClick={() => void onDecline()}>Sign out</button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        className="modal-pop w-full max-w-md rounded-2xl bg-elevated p-5 shadow-sm-2"
      >
        <button
          onClick={closeToHome}
          aria-label="Close and go back"
          title="Close"
          className="float-right -mr-1 -mt-1 rounded-lg px-2 py-1 font-inter text-xl leading-none text-ink-muted hover:bg-inset hover:text-ink"
        >
          ×
        </button>
        <div className="flex gap-4" role="tablist" aria-label="Sign in or create account">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`pb-1 font-inter text-base font-medium ${
                mode === m
                  ? 'border-b-2 border-ink text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <h1 id="auth-heading" className="mt-3 font-inter text-2xl font-semibold text-ink">
          {isSignup ? 'Create your account' : 'Sign in to Proxibay'}
        </h1>
        <p className="mt-2 font-inter text-sm font-normal text-ink-muted">
          {isSignup
            ? 'One account for your whole portfolio. It takes less than a minute.'
            : 'Enter your email and password to continue.'}
        </p>

        {pendingConsent === null && (
          <div key={mode} className="fade-swap">
            <div className="mt-4 flex flex-col gap-2">
              <button
                className="btn-ghost flex w-full items-center justify-center gap-2"
                disabled={busy || (isSignup && !consent)}
                onClick={() => void onOAuth('google')}
              >
                <GoogleIcon /> Continue with Google
              </button>
              <button
                className="btn-ghost flex w-full items-center justify-center gap-2"
                disabled={busy || (isSignup && !consent)}
                onClick={() => void onOAuth('github')}
              >
                <GitHubIcon /> Continue with GitHub
              </button>
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
                  minLength={isSignup ? 6 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

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
        )}
      </div>
    </div>
  )
}
