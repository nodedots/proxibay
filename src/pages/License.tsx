import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

/** License page: plain-language MIT summary + pointer to the repo file. */
export default function License() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <p className="badge bg-paper-white">MIT License</p>
        <h1 className="mt-3 font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Free as in <span className="text-coral-emphasis">actually free.</span>
        </h1>
        <div className="card mt-8">
          <div className="flex flex-col gap-3 font-inter text-sm leading-relaxed text-graphite">
            <p>
              Proxibay is MIT licensed. In plain language: you can <strong>use it, modify
              it, self-host it, and build on it</strong> — including commercially — as long
              as you keep the copyright notice in copies of the code.
            </p>
            <p>
              No warranty, as open-source licenses go: the software is provided as-is. Read
              the full text in the repo:{' '}
              <a
                href="https://github.com/nodedots/proxibay/blob/main/LICENSE"
                target="_blank"
                rel="noreferrer"
                className="text-link-emphasis text-link"
              >
                LICENSE on GitHub
              </a>
              .
            </p>
            <p className="text-slate">Copyright © 2026 Saviour Ukobong (nodedots).</p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
