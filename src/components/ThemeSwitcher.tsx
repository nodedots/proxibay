import { useEffect, useRef, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme, type ThemeChoice } from '../lib/theme'

const OPTIONS: Array<{
  value: ThemeChoice
  label: string
  hint: string
  Icon: typeof Sun
}> = [
  { value: 'light', label: 'Light', hint: 'Always light', Icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', Icon: Moon },
  { value: 'system', label: 'System', hint: 'Follows your device', Icon: Monitor },
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
          className="modal-pop absolute right-0 z-50 mt-2 w-44 rounded-lg border border-line bg-elevated p-1 shadow-sm"
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
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
