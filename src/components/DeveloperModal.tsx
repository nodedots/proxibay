import { Link } from 'react-router-dom'
import { X } from 'lucide-react'

/** Credit modal: who designs and builds Stackduck. Shared by footer + founder note. */
export default function DeveloperModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-heading"
        className="modal-pop relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-elevated p-5 text-center shadow-sm-2 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute right-4 top-4 rounded-lg px-2 py-1 font-inter text-xl leading-none text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="flex flex-col items-center">
          <img
            src="/nodedots.png"
            alt="NodeDots avatar"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-line ring-offset-2 ring-offset-elevated"
          />
          <p className="badge mt-3 bg-surface">Developer</p>
          <h2 id="dev-heading" className="mt-1 font-inter text-2xl font-semibold text-ink">
            NodeDots
          </h2>
        </div>
        <p className="mx-auto mt-3 max-w-sm font-inter text-sm font-normal leading-relaxed text-ink-muted">
          Stackduck is designed and built by NodeDots — an indie developer who got
          tired of touring a dozen admin panels every morning and decided to fix it
          for good.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href="https://x.com/nodedots"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
            </svg>
            X
          </a>
          <a
            href="https://t.me/nodedots"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M21.8 3.2 18.6 20c-.24 1.18-.88 1.47-1.78.92l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.98.48l.35-5.01 9.12-8.24c.4-.35-.09-.55-.62-.2L6.12 13.7l-4.85-1.52c-1.06-.33-1.08-1.06.22-1.57L20.45 3.1c.88-.32 1.65.21 1.35 1.57z" />
            </svg>
            Telegram
          </a>
        </div>
        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="font-inter text-xs font-medium text-ink-muted">more</span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="flex gap-2">
          <Link to="/about" className="btn-primary flex-1" onClick={onClose}>
            The story
          </Link>
          <Link to="/docs" className="btn-ghost flex-1" onClick={onClose}>
            How it works
          </Link>
        </div>
      </div>
    </div>
  )
}
