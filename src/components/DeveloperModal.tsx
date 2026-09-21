import { Link } from 'react-router-dom'

/** Credit modal: who designs and builds Proxibay. Shared by footer + founder note. */
export default function DeveloperModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-inkwell-navy/45 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-heading"
        className="modal-pop relative w-full max-w-md rounded-2xl bg-paper-white p-6 text-center shadow-sm-2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          className="absolute right-4 top-4 rounded-lg px-2 py-1 font-inter text-xl leading-none text-slate transition-colors duration-150 hover:bg-ash-canvas hover:text-inkwell-navy"
        >
          ×
        </button>
        <div className="flex flex-col items-center">
          <img
            src="/nodedots.png"
            alt="NodeDots avatar"
            width={72}
            height={72}
            className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-warm-stone ring-offset-2 ring-offset-paper-white"
          />
          <p className="badge mt-3 bg-paper-white">Developer</p>
          <h2 id="dev-heading" className="mt-1 font-inter text-2xl font-semibold text-inkwell-navy">
            NodeDots
          </h2>
        </div>
        <p className="mx-auto mt-3 max-w-sm font-inter text-sm font-normal leading-relaxed text-slate">
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
            href="https://t.me/nodedots"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost flex items-center justify-center gap-2 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            Telegram
          </a>
        </div>
        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-warm-stone" />
          <span className="font-inter text-xs font-medium text-slate">more</span>
          <span className="h-px flex-1 bg-warm-stone" />
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
