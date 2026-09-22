import { useState } from 'react'
import type { User } from 'firebase/auth'

/** Initials from display name, falling back to the email local-part. */
export function userInitials(user: Pick<User, 'displayName' | 'email'>): string {
  const name = (user.displayName ?? '').trim()
  if (name) {
    const parts = name.split(/\s+/)
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
  }
  const local = (user.email ?? '?').split('@')[0]
  return local.slice(0, 2).toUpperCase()
}

/** Avatar: provider photo when available, token-colored initials otherwise. */
export default function UserAvatar({
  user,
  size = 36,
}: {
  user: Pick<User, 'displayName' | 'email' | 'photoURL'>
  size?: number
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const label = user.displayName || user.email || 'Account'
  if (user.photoURL && !imgFailed) {
    return (
      <img
        src={user.photoURL}
        alt={label}
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className="rounded-full border border-warm-stone object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label={label}
      className="flex items-center justify-center rounded-full bg-inkwell-navy font-inter font-semibold text-paper-white"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {userInitials(user)}
    </span>
  )
}
