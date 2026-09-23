import { useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from './Logo'
import DeveloperModal from './DeveloperModal'

function GitHubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.78 13.78 0 0 0-.64 1.28 18.27 18.27 0 0 0-5.5 0 12.64 12.64 0 0 0-.64-1.28c-1.71.29-3.37.8-4.93 1.51A20.3 20.3 0 0 0 .1 18.06a19.9 19.9 0 0 0 6.07 3.03c.49-.66.93-1.37 1.31-2.11a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.14 0c.16.13.33.26.5.38-.65.39-1.34.72-2.05.98.38.74.82 1.45 1.31 2.11a19.84 19.84 0 0 0 6.07-3.03 20.3 20.3 0 0 0-3.58-13.69zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z" />
    </svg>
  )
}

/** Social links — placeholder URLs until the real handles exist. */
const SOCIALS: Array<{
  href: string
  label: string
  Icon: (props: { size?: number }) => React.ReactElement
}> = [
  { href: 'https://github.com/nodedots/stackduck', label: 'GitHub', Icon: GitHubIcon },
  { href: 'https://x.com/stackduck', label: 'X', Icon: XIcon },
  { href: 'https://www.linkedin.com/company/stackduck', label: 'LinkedIn', Icon: LinkedInIcon },
  { href: 'https://discord.gg/stackduck', label: 'Discord', Icon: DiscordIcon },
]

const GROUPS: Array<{
  title: string
  links: Array<{ to: string; label: string; external?: boolean }>
}> = [
  {
    title: 'Product',
    links: [
      { to: '/about', label: 'About' },
      { to: '/docs', label: 'Docs' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { to: '/support', label: 'Support' },
      { to: '/feedback', label: 'Feedback' },
      { to: '/changelog', label: 'Changelog' },
      { to: 'https://github.com/nodedots/stackduck', label: 'GitHub', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/license', label: 'License' },
      { to: '/privacy', label: 'Privacy' },
      { to: '/terms', label: 'Terms' },
    ],
  },
]

/** Shared public footer: brand block with weight + grouped link columns. */
export default function SiteFooter() {
  const [devOpen, setDevOpen] = useState(false)

  return (
    <>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-6 py-16">
          <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-10">
            {/* Brand block — more visual weight than the link columns. */}
            <div>
              <Logo />
              <p className="mt-4 max-w-xs font-inter text-sm text-ink-muted">
                Give every project a home and a heartbeat — health, users, and
                revenue in one place.
              </p>
              <button
                onClick={() => setDevOpen(true)}
                className="text-link mt-4 font-inter text-sm font-medium text-ink"
                title="About the developer"
              >
                Developed by NodeDots
              </button>
              {/* Socials — icon row with placeholder destinations. */}
              <div className="mt-6 flex items-center gap-1">
                {SOCIALS.map(({ href, label, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Stackduck on ${label}`}
                    title={`Stackduck on ${label}`}
                    className="rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>

            {GROUPS.map((group) => (
              <nav key={group.title} aria-label={`Footer — ${group.title}`}>
                <p className="font-inter text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {group.title}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      {l.external ? (
                        <a
                          href={l.to}
                          target="_blank"
                          rel="noreferrer"
                          className="nav-link flex items-center gap-1.5 text-sm"
                          aria-label="Stackduck on GitHub"
                        >
                          <GitHubIcon />
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.to} className="nav-link text-sm">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </footer>
      {devOpen && <DeveloperModal onClose={() => setDevOpen(false)} />}
    </>
  )
}
