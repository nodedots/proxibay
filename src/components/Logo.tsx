import { Link } from 'react-router-dom'

/**
 * Proxibay mark — "Orbit":
 * One dot being watched. A partial ring circles a center node (the project)
 * while a coral satellite sits parked in the ring's gap (the watcher).
 * Reads as monitoring/observation at every size; the tile is always
 * Inkwell Navy with a Paper mark, so the icon is theme-independent.
 */
export function ProxibayMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Proxibay mark">
      <rect width="64" height="64" rx="14" fill="#151b31" />
      <path
        d="M49.4 28.3 A18 18 0 1 1 33.6 15.1"
        stroke="#f2f2f2"
        strokeWidth="6.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="32" cy="33" r="8.5" fill="#f2f2f2" />
      <circle cx="43.6" cy="19.2" r="5" fill="#ff5858" />
    </svg>
  )
}

/** Full lockup: mark + Inter 600 wordmark. Theme-aware via `text-ink`
 *  (flips automatically under [data-theme="dark"]); pass `dark` only when the
 *  lockup sits on an explicitly dark surface regardless of page theme. */
export function ProxibayLockup({
  dark = false,
  markSize = 32,
  to = '/',
}: {
  dark?: boolean
  markSize?: number
  to?: string | null
}) {
  const inner = (
    <>
      <ProxibayMark size={markSize} />
      <span
        className={`font-inter text-xl font-semibold ${dark ? 'text-paper-white' : 'text-ink'}`}
      >
        Proxibay
      </span>
    </>
  )
  if (to === null) {
    return (
      <span className="flex items-center gap-2.5" aria-label="Proxibay">
        {inner}
      </span>
    )
  }
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg" aria-label="Proxibay home">
      {inner}
    </Link>
  )
}

/** Default export kept for existing call sites (App, SiteNav, SiteFooter). */
export default function Logo({ dark = false }: { dark?: boolean }) {
  return <ProxibayLockup dark={dark} />
}
