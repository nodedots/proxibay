import { Link } from 'react-router-dom'

/**
 * Stackduck mark — Duck Mascot:
 * Minimalist geometric duck mascot resting calmly on a horizontal stack base,
 * with a coral telemetry eye watching over the stack.
 * Theme-independent tile: Inkwell Navy #151b31 background, Paper #f2f2f2 duck,
 * and Coral Emphasis #ff5858 eye.
 */
export function StackduckMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Stackduck mark">
      <rect width="64" height="64" rx="14" fill="#151b31" />
      <path
        d="M15 44C15 44 14 36 21 34C24 33 25 30 25 25C25 18 29 14 35 14C41 14 43 18 43 21C47 21 52 22 53 24C52 27 47 27 43 27C43 32 46 36 50 37C46 41 40 44 32 44Z"
        fill="#f2f2f2"
      />
      <line x1="14" y1="50" x2="50" y2="50" stroke="#f2f2f2" strokeWidth="5" strokeLinecap="round" />
      <circle cx="34" cy="20" r="3.5" fill="#ff5858" />
    </svg>
  )
}

/** Full lockup: mark + Inter 600 wordmark. Theme-aware via `text-ink`
 *  (flips automatically under [data-theme="dark"]); pass `dark` only when the
 *  lockup sits on an explicitly dark surface regardless of page theme. */
export function StackduckLockup({
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
      <StackduckMark size={markSize} />
      <span
        className={`font-inter text-xl font-semibold tracking-tight ${dark ? 'text-paper-white' : 'text-ink'}`}
      >
        Stackduck
      </span>
    </>
  )
  if (to === null) {
    return (
      <span className="flex items-center gap-2.5" aria-label="Stackduck">
        {inner}
      </span>
    )
  }
  return (
    <Link to={to} className="flex items-center gap-2.5 rounded-lg" aria-label="Stackduck home">
      {inner}
    </Link>
  )
}

/** Aliases for backwards-compatibility */
export const ProxibayMark = StackduckMark
export const ProxibayLockup = StackduckLockup

/** Default export kept for existing call sites (App, SiteNav, SiteFooter). */
export default function Logo({ dark = false }: { dark?: boolean }) {
  return <StackduckLockup dark={dark} />
}
