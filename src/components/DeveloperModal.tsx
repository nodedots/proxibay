import { Link } from 'react-router-dom'

/** Credit modal: who designs and builds Proxibay. Shared by footer + founder note. */
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
          Proxibay is designed and built by NodeDots — an indie developer who got
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
            href="https://www.linkedin.com/in/nodedots/"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex flex-1 items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
            </svg>
            LinkedIn
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
