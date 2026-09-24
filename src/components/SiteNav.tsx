import { Link } from 'react-router-dom'
import Logo from './Logo'
import GitHubStars from './GitHubStars'
import UserMenu from './UserMenu'
import ThemeSwitcher from './ThemeSwitcher'
import { useAuthUser } from '../lib/useAuthUser'

export type SiteSection = 'about' | 'docs' | 'pricing'

const LINKS: Array<{ to: string; label: string; key: SiteSection }> = [
  { to: '/about', label: 'About', key: 'about' },
  { to: '/docs', label: 'Docs', key: 'docs' },
  { to: '/pricing', label: 'Pricing', key: 'pricing' },
]

/** Public marketing nav — single instance per page (no app-chrome double nav).
 *  Signed-in users get their avatar menu here too, landing page included. */
export default function SiteNav({ active }: { active?: SiteSection }) {
  const user = useAuthUser()
  return (
    <nav className="bg-transparent">
      <div className="mx-auto flex max-w-[var(--page-max-width)] items-center justify-between px-6 py-4">
        <Logo />
        <div className="flex items-center gap-5">
          <div className="hidden items-center gap-5 text-sm sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                to={l.to}
                className={`nav-link ${active === l.key ? 'nav-link-active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          {user === undefined ? (
            <span className="skeleton h-9 w-20" aria-hidden="true" />
          ) : user ? (
            <>
              <Link to="/portfolio" className="btn-ghost hidden whitespace-nowrap sm:inline-flex">
                Portfolio
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <Link to="/signin" className="btn-ghost whitespace-nowrap">
              Sign in
            </Link>
          )}
          <ThemeSwitcher />
          <GitHubStars />
        </div>
      </div>
    </nav>
  )
}
