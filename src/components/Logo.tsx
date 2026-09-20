import { Link } from 'react-router-dom'

/**
 * Proxibay mark: three connected nodes on a navy tile — everything close,
 * in one place. Two nodes paper-white, one coral (the single accent).
 * Geometric, no literal plug clip-art.
 */
export function ProxibayMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Proxibay mark">
      <rect width="32" height="32" rx="8" fill="#151b31" />
      <g stroke="#ffffff" strokeWidth="2" opacity="0.85">
        <line x1="11" y1="20.5" x2="21" y2="20.5" />
        <line x1="11" y1="20.5" x2="16" y2="11.5" />
        <line x1="21" y1="20.5" x2="16" y2="11.5" />
      </g>
      <circle cx="11" cy="20.5" r="3.5" fill="#ffffff" />
      <circle cx="21" cy="20.5" r="3.5" fill="#ffffff" />
      <circle cx="16" cy="11.5" r="3.5" fill="#ff5858" />
    </svg>
  )
}

/** Full lockup: mark + Inter 600 wordmark (per DESIGN.md brand lockups). */
export default function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg" aria-label="Proxibay home">
      <ProxibayMark size={compact ? 28 : 32} />
      {!compact && (
        <span className={`font-inter text-xl font-semibold ${dark ? 'text-paper-white' : 'text-inkwell-navy'}`}>
          Proxibay
        </span>
      )}
    </Link>
  )
}
