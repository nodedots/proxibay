import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import DeveloperModal from './DeveloperModal'

/** Shared public footer: product links + developer credit. */
export default function SiteFooter() {
  const [devOpen, setDevOpen] = useState(false)

  return (
    <>
      <footer className="border-t border-warm-stone">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-8">
          <Logo />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-inter text-sm">
            <Link to="/about" className="text-link text-slate">About</Link>
            <Link to="/learn" className="text-link text-slate">Learn</Link>
            <Link to="/pricing" className="text-link text-slate">Pricing</Link>
            <Link to="/privacy" className="text-link text-slate">Privacy</Link>
            <Link to="/terms" className="text-link text-slate">Terms</Link>
            <button
              onClick={() => setDevOpen(true)}
              className="text-link text-sm text-slate"
              title="About the developer"
            >
              Developed by NodeDots
            </button>
          </div>
        </div>
      </footer>
      {devOpen && <DeveloperModal onClose={() => setDevOpen(false)} />}
    </>
  )
}
