import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from './firebase'
import SignIn from './pages/SignIn'
import PortfolioHome from './pages/PortfolioHome'
import AddProject from './pages/AddProject'
import ProjectDetail from './pages/ProjectDetail'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import Landing from './pages/Landing'
import Logo from './components/Logo'
import About from './pages/About'
import Learn from './pages/Learn'
import Pricing from './pages/Pricing'
import NotFound from './pages/NotFound'

const MARKETING_PATHS = ['/', '/about', '/learn', '/pricing']

function Header({ user }: { user: User | null }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Marketing pages bring their own nav — app chrome stays off them.
  if (MARKETING_PATHS.includes(pathname)) return null
  return (
    <header className="bg-ash-canvas">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate sm:inline">{user.email}</span>
              <Link to="/portfolio" className="btn-ghost whitespace-nowrap">
                Portfolio
              </Link>
              <Link to="/learn" className="hidden text-link text-sm text-slate sm:inline">
                Learn
              </Link>
              <button
                className="btn-ghost whitespace-nowrap"
                onClick={() => {
                  void signOut(auth).then(() => navigate('/signin'))
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/signin" className="btn-ghost">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  // Marketing pages own their full layout (incl. <main>) — don't nest landmarks.
  if (MARKETING_PATHS.includes(pathname)) return <>{children}</>
  return <main className="mx-auto max-w-[1200px] px-6 pb-20">{children}</main>
}

function RequireAuth({ user, children }: { user: User | null | undefined; children: JSX.Element }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (user === null) navigate('/signin')
  }, [user, navigate])
  if (user === undefined) return <p className="p-8 text-slate">Loading…</p>
  if (user === null) return null
  return children
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), [])

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
        <Header user={user ?? null} />
        <Shell>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/about" element={<About />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/pricing" element={<Pricing />} />
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
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      </div>
    </BrowserRouter>
  )
}
