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

function Header({ user }: { user: User | null }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The landing page brings its own nav — app chrome stays off it.
  if (pathname === '/') return null
  return (
    <header className="bg-ash-canvas">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate sm:inline">{user.email}</span>
              <Link to="/portfolio" className="btn-ghost">
                Portfolio
              </Link>
              <button
                className="btn-ghost"
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
        <main className="mx-auto max-w-[1200px] px-6 pb-20">
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
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
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
