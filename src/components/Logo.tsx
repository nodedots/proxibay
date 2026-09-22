import { Link } from 'react-router-dom'

/**
 * Proxibay mark — "Constellation Bay":
 * A U-shaped harbor formed by connected nodes (like a star constellation).
 * Five white nodes form the bay walls; one coral node sits at the top
 * as the active project. The shape reads as both a harbor (bay) and a
 * network (proximity) — the two halves of the name.
 */
export function ProxibayMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Proxibay mark">
      <rect width="64" height="64" rx="14" fill="#151b31" />
      <g stroke="#ffffff" strokeWidth="1.2" opacity="0.4" fill="none">
        <line x1="16" y1="46" x2="32" y2="50" />
        <line x1="32" y1="50" x2="48" y2="46" />
        <line x1="16" y1="46" x2="16" y2="22" />
        <line x1="48" y1="46" x2="48" y2="22" />
        <line x1="16" y1="22" x2="32" y2="14" />
        <line x1="32" y1="14" x2="48" y2="22" />
        <line x1="32" y1="14" x2="32" y2="50" />
      </g>
      <circle cx="16" cy="46" r="3.5" fill="#ffffff" />
      <circle cx="32" cy="50" r="3.5" fill="#ffffff" />
      <circle cx="48" cy="46" r="3.5" fill="#ffffff" />
      <circle cx="16" cy="22" r="3.5" fill="#ffffff" />
      <circle cx="48" cy="22" r="3.5" fill="#ffffff" />
      <circle cx="32" cy="14" r="4.5" fill="#ff5858" />
    </svg>
  )
}

/** Full lockup: mark + Inter 600 wordmark. */
export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Proxibay home">
      <ProxibayMark size={32} />
      <span
        className={`font-inter text-xl font-semibold ${dark ? 'text-paper-white' : 'text-inkwell-navy'}`}
      >
        Proxibay
      </span>
    </Link>
  )
}
