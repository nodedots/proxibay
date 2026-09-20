import { Link } from 'react-router-dom'
import Logo from './Logo'

export type SiteSection = 'about' | 'learn' | 'pricing'

const LINKS: Array<{ to: string; label: string; key: SiteSection }> = [
  { to: '/about', label: 'About', key: 'about' },
  { to: '/learn', label: 'Learn', key: 'learn' },
  { to: '/pricing', label: 'Pricing', key: 'pricing' },
]

/** Public marketing nav — single instance per page (no app-chrome double nav). */
export default function SiteNav({ active }: { active?: SiteSection }) {
  return (
    <nav className="bg-transparent">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-5 text-sm font-medium sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                to={l.to}
                className={`text-link ${active === l.key ? 'text-inkwell-navy' : 'text-slate hover:text-inkwell-navy'}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link to="/signin" className="btn-ghost whitespace-nowrap">
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  )
}
