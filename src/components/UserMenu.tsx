import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signOut, type User } from 'firebase/auth'
import { auth } from '../firebase'
import UserAvatar from './UserAvatar'

const ITEM_CLASS =
  'block w-full rounded-lg px-3 py-2 text-left font-inter text-sm font-medium text-slate transition-colors duration-150 hover:bg-ash-canvas hover:text-inkwell-navy focus-visible:outline-2 focus-visible:outline-inkwell-navy'

/**
 * Signed-in account chip: avatar button + dropdown (Portfolio, Account
 * settings, Sign out). Shared by the marketing SiteNav and the app Header so
 * a logged-in user is recognized on every page, landing included.
 */
export default function UserMenu({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut(auth).catch(() => undefined)
    navigate('/')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.displayName || user.email || 'you'}`}
        className="flex items-center gap-2 rounded-full border border-warm-stone bg-paper-white py-1 pl-1 pr-2.5 transition-colors duration-150 hover:border-slate focus-visible:outline-2 focus-visible:outline-inkwell-navy"
      >
        <UserAvatar user={user} size={28} />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`text-slate transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="modal-pop absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-warm-stone bg-paper-white p-2 shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-warm-stone px-3 pb-3 pt-1">
            <UserAvatar user={user} size={36} />
            <div className="min-w-0">
              <p className="truncate font-inter text-sm font-semibold text-inkwell-navy">
                {user.displayName || 'Proxibay user'}
              </p>
              <p className="truncate font-inter text-xs text-slate">{user.email}</p>
            </div>
          </div>
          <div className="pt-2">
            <Link role="menuitem" to="/portfolio" className={ITEM_CLASS} onClick={() => setOpen(false)}>
              Portfolio
            </Link>
            <Link role="menuitem" to="/account" className={ITEM_CLASS} onClick={() => setOpen(false)}>
              Account settings
            </Link>
            <button role="menuitem" type="button" className={ITEM_CLASS} onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
