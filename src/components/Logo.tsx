import { Link } from 'react-router-dom'

/** Proxibay mark: navy rounded square with a white plug glyph + wordmark. */
export default function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Proxibay home">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-inkwell-navy">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M9.5 1.5 4 9h3.5L6.5 14.5 12 7H8.5l1-5.5z"
            fill="#ffffff"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={`font-inter text-xl font-semibold ${dark ? 'text-paper-white' : 'text-inkwell-navy'}`}>
        Proxibay
      </span>
    </Link>
  )
}
