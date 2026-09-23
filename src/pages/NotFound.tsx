import { Link } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'

/** Consistent 404 — same tokens, no dead ends. */
export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md pb-16">
      <div className="card text-center">
        <p className="font-display font-bold text-display text-ink">404</p>
        <h1 className="mt-2 font-inter text-xl font-semibold text-ink">
          This page doesn't exist.
        </h1>
        <p className="mt-2 font-inter text-sm text-ink-muted">
          It may have moved, or the link may be wrong. Your projects are safe.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-primary">
            Home
          </Link>
          <Link to="/portfolio" className="btn-ghost">
            Portfolio
          </Link>
        </div>
      </div>
      <div className="mt-10">
        <SiteFooter />
      </div>
    </div>
  )
}
