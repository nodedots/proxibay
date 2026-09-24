import { Link } from 'react-router-dom'

const PAGES = [
  { to: '/license', label: 'License', key: 'license' },
  { to: '/privacy', label: 'Privacy', key: 'privacy' },
  { to: '/terms', label: 'Terms', key: 'terms' },
] as const

export default function LegalNav({ active }: { active: (typeof PAGES)[number]['key'] }) {
  return (
    <nav aria-label="Legal pages" className="mb-7 flex gap-5 border-b border-line">
      {PAGES.map((page) => (
        <Link
          key={page.key}
          to={page.to}
          aria-current={active === page.key ? 'page' : undefined}
          className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${active === page.key ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'}`}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  )
}
