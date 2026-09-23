import { useEffect, useRef, useState } from 'react'
import { useTheme, type ThemeChoice } from '../lib/theme'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="block">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="block">
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="block">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5M8 11.5V14" />
    </svg>
  )
}

const OPTIONS: Array<{
  value: ThemeChoice
  label: string
  hint: string
  Icon: () => React.ReactElement
}> = [
  { value: 'light', label: 'Light', hint: 'Always light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', hint: 'Always dark', Icon: MoonIcon },
  { value: 'system', label: 'System', hint: 'Follows your device', Icon: MonitorIcon },
]

/**
 * Theme switcher: icon button (sun/moon/monitor for the current choice) +
 * dropdown. Sits near the GitHub link in both the marketing SiteNav and the
 * app Header. Choice persists in localStorage; default for new visitors is
 * Light (see src/lib/theme.ts).
 */
export default function ThemeSwitcher() {
  const { choice, setChoice } = useTheme()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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

  const current = OPTIONS.find((o) => o.value === choice) ?? OPTIONS[0]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${current.label}`}
        title={`Theme: ${current.label}`}
        className="rounded-lg border border-line p-2 text-ink transition-colors duration-150 hover:border-line-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring"
      >
        <current.Icon />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Theme"
          className="modal-pop absolute right-0 z-50 mt-2 w-44 rounded-xl border border-line bg-elevated p-1 shadow-sm"
        >
          {OPTIONS.map(({ value, label, hint, Icon }) => {
            const active = value === choice
            return (
              <button
                key={value}
                role="menuitemradio"
                aria-checked={active}
                type="button"
                onClick={() => {
                  setChoice(value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-inter text-sm transition-colors duration-150 hover:bg-inset ${
                  active ? 'font-semibold text-ink' : 'font-medium text-ink-muted hover:text-ink'
                }`}
              >
                <Icon />
                <span className="min-w-0 flex-1">
                  {label}
                  <span className="block text-xs font-normal text-ink-muted">{hint}</span>
                </span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
