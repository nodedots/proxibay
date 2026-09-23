import { Link } from 'react-router-dom'

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
        className="modal-pop relative w-full max-w-md rounded-2xl bg-elevated p-6 text-center shadow-sm-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute right-4 top-4 rounded-lg px-2 py-1 font-inter text-xl leading-none text-ink-muted transition-colors duration-150 hover:bg-inset hover:text-ink"
        >
          ×
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
            href="https://discord.gg/nodedots"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.32 4.37a19.8 19.8 0 0 0-4.93-1.51 13.78 13.78 0 0 0-.64 1.28 18.27 18.27 0 0 0-5.5 0 12.64 12.64 0 0 0-.64-1.28c-1.71.29-3.37.8-4.93 1.51A20.3 20.3 0 0 0 .1 18.06a19.9 19.9 0 0 0 6.07 3.03c.49-.66.93-1.37 1.31-2.11a12.9 12.9 0 0 1-2.05-.98c.17-.12.34-.25.5-.38a14.2 14.2 0 0 0 12.14 0c.16.13.33.26.5.38-.65.39-1.34.72-2.05.98.38.74.82 1.45 1.31 2.11a19.84 19.84 0 0 0 6.07-3.03 20.3 20.3 0 0 0-3.58-13.69zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42s.95-2.42 2.16-2.42c1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z" />
            </svg>
            Discord
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
