import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { getAdditionalUserInfo, getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './firebase'
import {
  consumeConsentGiven,
  flagImportPromptIfNew,
  persistToken,
  recordConsent,
  tokenFromResult,
  type OAuthKind,
} from './lib/oauth'
import SignIn from './pages/SignIn'
import PortfolioHome from './pages/PortfolioHome'
import AddProject from './pages/AddProject'
import ProjectDetail from './pages/ProjectDetail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Landing from './pages/Landing'
import Logo from './components/Logo'
import About from './pages/About'
import Docs from './pages/Docs'
import ConnectGuide from './pages/ConnectGuide'
import ConnectFirebase from './pages/ConnectFirebase'
import ConnectWebhook from './pages/ConnectWebhook'
import ConnectStripe from './pages/ConnectStripe'
import ConnectSupabase from './pages/ConnectSupabase'
import Pricing from './pages/Pricing'
import Changelog from './pages/Changelog'
import License from './pages/License'
import Support from './pages/Support'
import Feedback from './pages/Feedback'
import BillingSuccess from './pages/BillingSuccess'
import Account from './pages/Account'
import NotFound from './pages/NotFound'
import UserMenu from './components/UserMenu'
import ThemeSwitcher from './components/ThemeSwitcher'

const MARKETING_PATHS = ['/', '/about', '/docs', '/pricing', '/support', '/feedback', '/changelog', '/license']

/** Marketing + docs pages own their chrome — match exact or nested paths. */
function isMarketing(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname) || pathname.startsWith('/docs/')
}

function Header({ user }: { user: User | null }) {
  const { pathname } = useLocation()
  // Marketing pages bring their own nav — app chrome stays off them.
  if (isMarketing(pathname)) return null
  return (
    <header className="bg-canvas">
      <div className="mx-auto flex max-w-[var(--page-max-width)] items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link to="/portfolio" className="btn-ghost whitespace-nowrap">
                Portfolio
              </Link>
              <Link to="/docs" className="hidden text-link text-sm text-ink-muted sm:inline">
                Docs
              </Link>
              <a
                href="https://github.com/nodedots/stackduck"
                target="_blank"
                rel="noreferrer"
                aria-label="Stackduck on GitHub"
                title="Stackduck on GitHub"
                className="hidden rounded-lg border border-line p-2 text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface sm:block"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="block">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
              <ThemeSwitcher />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <ThemeSwitcher />
              <Link to="/signin" className="btn-ghost">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

import { PageFade } from './components/Reveal'

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  // Marketing pages own their full layout (incl. <main>) — don't nest landmarks.
  if (isMarketing(pathname)) {
    return <PageFade routeKey={pathname}>{children}</PageFade>
  }
  return (
    <main className="mx-auto max-w-[var(--page-max-width)] px-6 pb-20">
      <PageFade routeKey={pathname}>{children}</PageFade>
    </main>
  )
}

function RequireAuth({ user, children }: { user: User | null | undefined; children: JSX.Element }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (user === null) navigate('/signin')
  }, [user, navigate])
  if (user === undefined) return <p className="p-8 text-ink-muted">Loading…</p>
  if (user === null) return null
  return children
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])

  // Consumes OAuth redirect results exactly once, app-wide (SignIn never calls
  // getRedirectResult itself): captures provider tokens for import flows and
  // records consent for signup-mode redirects that pre-checked the box.
  // Routing itself stays with onAuthStateChanged + the consent gate in SignIn.
  useEffect(() => {
    void getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return
        const info = getAdditionalUserInfo(result)
        const kind: OAuthKind | null =
          info?.providerId === 'github.com' ? 'github'
          : info?.providerId === 'google.com' ? 'google'
          : null
        if (kind) {
          const token = tokenFromResult(kind, result)
          if (token) {
            await persistToken(kind, token).catch(() => undefined)
            await flagImportPromptIfNew(kind).catch(() => undefined)
          }
        }
        if (info?.isNewUser && consumeConsentGiven()) {
          await recordConsent(result.user.uid, result.user.email).catch(() => undefined)
        }
      })
      .catch(() => undefined)
  }, [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-canvas font-inter text-ink">
        <Header user={user ?? null} />
        <Shell>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/docs/connect" element={<ConnectGuide />} />
            <Route path="/docs/connect/firebase" element={<ConnectFirebase />} />
            <Route path="/docs/connect/webhook" element={<ConnectWebhook />} />
            <Route path="/docs/connect/stripe" element={<ConnectStripe />} />
            <Route path="/docs/connect/supabase" element={<ConnectSupabase />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/support" element={<Support />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/billing/success" element={<BillingSuccess />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/license" element={<License />} />
            <Route path="/" element={<Landing />} />
            <Route
              path="/portfolio"
              element={
                <RequireAuth user={user}>
                  <PortfolioHome />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/new"
              element={
                <RequireAuth user={user}>
                  <AddProject />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <RequireAuth user={user}>
                  <ProjectDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth user={user}>
                  <Account />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      </div>
    </BrowserRouter>
  )
}
