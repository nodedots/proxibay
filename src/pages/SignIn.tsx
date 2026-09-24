import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'
import { StackduckLockup } from '../components/Logo'
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  linkWithCredential,
  type User,
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
import { captureOAuthConflict, clearOAuthConflict, oauthConflictEventName, oauthLinkCompleteEventName, oauthLinkFailedEventName, readOAuthConflict, type PendingOAuthLink } from '../lib/auth-conflict'

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

/** Friendly copy for auth failures — never leaks provider internals. */
function friendlyError(code: string, mode: Mode, detail = ''): string {
  if (/invalid.scope/i.test(code) || /invalid.scope/i.test(detail)) {
    return 'Google hasn’t enabled this level of access for Stackduck yet (verification is pending). Sign in with email or GitHub instead — importing can wait.'
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
      return 'This email already has a Stackduck account. Sign in with its original method to link this provider.'
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
  const [recovering, setRecovering] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [email, setEmail] = useState(() => readOAuthConflict()?.email ?? '')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingLink, setPendingLink] = useState<PendingOAuthLink | null>(() => readOAuthConflict())
  // A signed-in user with no consent record must agree before entering.
  const [pendingConsent, setPendingConsent] = useState<{ uid: string; email: string | null } | null>(null)
  const pendingRef = useRef(false)
  pendingRef.current = pendingConsent !== null
  const pendingLinkRef = useRef(false)
  pendingLinkRef.current = pendingLink !== null

  useEffect(() => {
    const syncPendingLink = () => {
      const pending = readOAuthConflict()
      setPendingLink(pending)
      if (pending?.email) setEmail(pending.email)
    }
    const onLinkComplete = () => {
      clearOAuthConflict()
      pendingLinkRef.current = false
      setPendingLink(null)
      if (auth.currentUser) void enter(auth.currentUser.uid, auth.currentUser.email)
    }
    const onLinkFailed = () => setError('We couldn’t link that provider. Sign in with the account’s original method and try again.')
    window.addEventListener(oauthConflictEventName(), syncPendingLink)
    window.addEventListener(oauthLinkCompleteEventName(), onLinkComplete)
    window.addEventListener(oauthLinkFailedEventName(), onLinkFailed)
    return () => {
      window.removeEventListener(oauthConflictEventName(), syncPendingLink)
      window.removeEventListener(oauthLinkCompleteEventName(), onLinkComplete)
      window.removeEventListener(oauthLinkFailedEventName(), onLinkFailed)
    }
  }, [navigate])

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
      if (u && !cancelled && !pendingRef.current && !pendingLinkRef.current) {
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
    setRecovering(false)
    setResetSent(false)
    setError(null)
    setConsent(false)
  }

  async function finishPendingLink(user: User) {
    if (!pendingLink) return
    if (!pendingLink.email || user.email?.toLowerCase() !== pendingLink.email.toLowerCase()) {
      await auth.signOut()
      throw new Error('That sign-in belongs to a different email. Use the account that matches the address from the first sign-in attempt.')
    }
    await linkWithCredential(user, pendingLink.credential)
    if (pendingLink.credential.accessToken) {
      await persistToken(pendingLink.kind, pendingLink.credential.accessToken)
      await flagImportPromptIfNew(pendingLink.kind)
    }
    clearOAuthConflict()
    pendingLinkRef.current = false
    setPendingLink(null)
  }

  async function onPasswordReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setResetSent(true)
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      setError(code === 'auth/user-not-found' || code === 'auth/invalid-email'
        ? 'Enter the email address for your Stackduck account.'
        : 'Couldn’t send a reset link right now. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pendingLink && pendingLink.email && email.trim().toLowerCase() !== pendingLink.email.toLowerCase()) {
      setError('Use the same email address as the provider sign-in you just attempted.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
        await recordConsent(cred.user.uid, cred.user.email)
        navigate('/portfolio')
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
        await finishPendingLink(cred.user)
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
        sessionStorage.setItem('stackduck:oauth-redirect-kind', kind)
        await signInWithRedirect(auth, buildProvider(kind))
        return
      }
      const result = await signInWithPopup(auth, buildProvider(kind))
      if (pendingLink) await finishPendingLink(result.user)
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
      const conflict = captureOAuthConflict(kind, err)
      if (conflict) {
        setMode('signin')
        setConsent(false)
        if (conflict.email) setEmail(conflict.email)
        setPendingLink(conflict)
        setError(null)
        return
      }
      setError(!code && err instanceof Error ? err.message : friendlyError(code, mode, err instanceof Error ? err.message : ''))
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
  const providerOptions: OAuthKind[] = pendingLink
    ? [pendingLink.kind === 'github' ? 'google' : 'github']
    : ['google', 'github']

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
      <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
        <section className="order-1 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:order-2">
        <div className="relative w-full max-w-md rounded-2xl border border-line bg-elevated p-6 sm:p-8">
          <button
            onClick={() => void onDecline().then(() => navigate('/'))}
            aria-label="Close and sign out"
            title="Close"
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-inset hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={18} aria-hidden="true" />
          </button>
          <StackduckLockup to={null} markSize={30} />
          <h1 id="consent-heading" className="mt-7 font-inter text-2xl font-semibold text-ink">
            One more step
          </h1>
          <p className="mt-2 font-inter text-sm font-normal text-ink-muted">
            Before you continue, please agree to how Stackduck handles your data.
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
        </div></section><div className="order-2 lg:order-1"><AuthVisual /></div>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen bg-canvas lg:grid-cols-2">
      <section className="order-1 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:order-2">
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-elevated p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <StackduckLockup to={null} markSize={30} />
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 font-inter text-sm text-ink-muted transition-colors hover:bg-inset hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />Home</Link>
        </div>
        {recovering ? (
          <div className="mt-8">
            <h1 id="auth-heading" className="font-inter text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="mt-2 font-inter text-sm leading-relaxed text-ink-muted">Enter the email address on your account and we’ll send you a link to choose a new password.</p>
            {resetSent ? (
              <p role="status" className="mt-6 rounded-lg border border-line bg-inset p-4 font-inter text-sm text-ink">Reset link sent. Check your inbox, then return here to sign in.</p>
            ) : (
              <form onSubmit={(e) => void onPasswordReset(e)} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1 font-inter text-sm font-medium text-ink" htmlFor="reset-email">Email<input id="reset-email" className="input" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
                {error && <p role="alert" className="font-inter text-sm text-coral-emphasis">{error}</p>}
                <button className="btn-primary w-full" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'}</button>
              </form>
            )}
            <button className="mt-5 inline-flex items-center gap-1.5 font-inter text-sm text-link" onClick={() => { setRecovering(false); setResetSent(false); setError(null) }}><ArrowLeft size={15} aria-hidden="true" />Back to sign in</button>
          </div>
        ) : <>
        {!pendingLink && <div className="mt-7 flex gap-1 rounded-lg bg-inset p-1" role="tablist" aria-label="Sign in or create account">
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`min-h-10 flex-1 rounded-md px-3 font-inter text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === m
                  ? 'bg-elevated text-ink'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>}

        <h1 id="auth-heading" className="mt-5 font-inter text-2xl font-semibold text-ink">
          {pendingLink ? 'Connect your sign-in methods' : isSignup ? 'Create your account' : 'Sign in to Stackduck'}
        </h1>
        {!pendingLink && <p className="mt-1.5 font-inter text-sm font-normal text-ink-muted">
          {isSignup
            ? 'One account for your whole portfolio. It takes less than a minute.'
            : 'Enter your email and password to continue.'}
        </p>}

        {pendingConsent === null && (
          <div key={mode} className="fade-swap">
            {pendingLink && <div role="status" className="mt-4 rounded-lg border border-line bg-inset p-3 font-inter text-sm text-ink-secondary">
              This {pendingLink.kind === 'github' ? 'GitHub' : 'Google'} account matches an existing Stackduck account. Sign in with the other method to securely link both providers.
              <button className="ml-1 text-link" onClick={() => { clearOAuthConflict(); pendingLinkRef.current = false; setPendingLink(null); setError(null) }}>Cancel</button>
            </div>}
            <div className="mt-5 flex flex-col gap-2.5">
              {providerOptions.map((kind) => (
                <button key={kind} className="btn-ghost flex w-full items-center justify-center gap-2" disabled={busy || (isSignup && !consent)} onClick={() => void onOAuth(kind)}>
                  {kind === 'google' ? <GoogleIcon /> : <GitHubIcon />}
                  {pendingLink ? `Continue with ${kind === 'google' ? 'Google' : 'GitHub'} and link ${pendingLink.kind === 'github' ? 'GitHub' : 'Google'}` : `Continue with ${kind === 'google' ? 'Google' : 'GitHub'}`}
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
                  minLength={isSignup ? 6 : undefined}
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
        )}
        </>}
      </div></section><div className="order-2 lg:order-1"><AuthVisual /></div>
    </main>
  )
}
