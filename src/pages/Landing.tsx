import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import Folder from '../components/ui/folder-component'
import { Reveal } from '../components/Reveal'

const INSTALL_CMD = 'npx degit nodedots/stackduck my-stackduck'

/** Demo projects cycled through the landing folder demo. */
const DEMO_PROJECTS = [
  { name: 'Tabmeet', dot: 'status-green', accent: '#86e0c1' },
  { name: 'Loopstack', dot: 'status-amber', accent: '#fedf89' },
  { name: 'Nodedots', dot: 'status-green', accent: '#86e0c1' },
] as const

/**
 * Ambient portfolio demo: the folder breathes open/closed on a loop while a
 * chip cycles through projects being "added" — the catalog filling up live.
 * Decorative only (aria-hidden at the call site).
 */
function PortfolioFolderDemo() {
  const [active, setActive] = useState(0)

  useEffect(() => {
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % DEMO_PROJECTS.length),
      2400,
    )
    return () => window.clearInterval(id)
  }, [])

  const project = DEMO_PROJECTS[active]

  return (
    <div className="flex w-60 flex-col items-center gap-6">
      <Folder color="stackduck" size="sm" autoPlay accent={project.accent} />
      <div
        key={active}
        className="fade-swap flex items-center gap-2 rounded-full bg-paper-white py-1.5 pl-3 pr-4 shadow-sm-2"
      >
        <span className={`status-dot ${project.dot}`} />
        <span className="font-inter text-xs font-semibold text-inkwell-navy">
          {project.name}
        </span>
        <span className="font-inter text-xs text-slate">added to portfolio</span>
      </div>
    </div>
  )
}

/** Secondary dev CTA: copy-paste self-host command + link into Docs quickstart. */
function InstallSnippet() {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
    } catch {
      // Clipboard unavailable (permissions, insecure context) — still show feedback.
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <div className="flex max-w-full items-center gap-2 rounded-lg border border-line-strong bg-surface py-2 pl-4 pr-2 shadow-subtle">
        <code className="block min-w-0 select-all overflow-x-auto whitespace-nowrap font-mono text-sm text-ink">
          <span className="mr-2 select-none text-ink-muted">$</span>
          {INSTALL_CMD}
        </code>
        <button
          onClick={() => void copy()}
          aria-label="Copy install command"
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          className="rounded-md p-1.5 text-ink-muted transition-all duration-150 hover:bg-inset hover:text-ink"
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="5.5" y="5.5" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 5.5v-2a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          )}
        </button>
      </div>
      <p aria-live="polite" className={`h-4 font-inter text-xs text-ink-muted transition-opacity duration-150 ${copied ? 'opacity-100' : 'opacity-0'}`}>
        Copied!
      </p>
      <Link to="/docs#quickstart" className="text-link-emphasis text-link text-sm">
        Quick Start →
      </Link>
    </div>
  )
}

/**
 * Public landing page. Single-column flow per DESIGN.md:
 * minimal nav, centered hero, one dark feature moment, short feature list.
 * Product copy only — no implementation details, no roadmap language.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />

      {/* HERO */}
      <header className="mx-auto max-w-[1200px] px-6 pb-24 pt-24 text-center sm:pb-28 sm:pt-32">
        <Reveal>
          <h1 className="mx-auto max-w-4xl font-display font-bold text-[40px] leading-[1.1] tracking-normal sm:text-display sm:leading-display sm:tracking-display">
          Stop Building Dashboards. <span className="text-coral-emphasis">Plug</span> your{' '}
          <span className="sm:whitespace-nowrap">
            Projects <span className="text-coral-emphasis">in.</span>
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-body-lg text-ink-muted">
          Stackduck gives every project a home and a heartbeat. See health, users,
          and revenue across everything you run — in one place.
        </p>
        <Link to="/signin" className="btn-primary mt-8 inline-block">
          Add your first project
        </Link>
        <InstallSnippet />
        </Reveal>
      </header>

      {/* DARK FEATURE MOMENT */}
      <section className="mx-auto max-w-[1200px] px-6 pb-28">
        <Reveal>
        {/* bg-feature: Inkwell Navy in light; bumps to Raised Navy in dark so
            the card stays distinct from the now-darker page (DARK_MODE.md). */}
        <div className="relative overflow-hidden rounded-3xl bg-feature p-10 shadow-sm-2 sm:p-12">
          <div className="max-w-lg">
            <h2 className="font-display font-bold text-4xl leading-[1.16] text-paper-white sm:text-heading-lg sm:leading-heading-lg">
              Register once. Monitor everything.
            </h2>
            <p className="mt-4 text-body text-paper-white/70">
              Every project gets a catalog entry — what it is, where it lives.
              Attach a connector and the same entry fills with live users, errors,
              and revenue. No second setup, no separate dashboard.
            </p>
            <a
              href="#features"
              className="mt-6 inline-block rounded-lg bg-paper-white px-6 py-3 font-inter text-base font-medium text-inkwell-navy"
            >
              See how it works
            </a>
          </div>
          {/* Ambient portfolio demo — folder fills as projects are "added" */}
          <div
            aria-hidden="true"
            className="mt-12 flex justify-center md:absolute md:right-10 md:top-1/2 md:mt-0 md:w-60 md:-translate-y-1/2"
          >
            <PortfolioFolderDemo />
          </div>
        </div>
        </Reveal>
      </section>

      {/* FEATURE BLURBS — Paper White band with Warm Stone hairlines for
          section depth; three-up on desktop, stacked on mobile. */}
      <section id="features" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-24 sm:py-28 md:grid-cols-3 md:gap-10">
          <Reveal>
          <div>
            <p className="badge">Catalog</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Register any project in seconds.</h3>
            <p className="mt-2 text-body text-ink-muted">
              A name is enough to start. Add stack tags, repo links, and notes
              whenever you like — the catalog never gets in the way of monitoring.
            </p>
          </div>
          </Reveal>
          <Reveal delay={0.08}>
          <div>
            <p className="badge">Connectors</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Plug in where your data already lives.</h3>
            <p className="mt-2 text-body text-ink-muted">
              Firebase and Stripe connect directly, and a generic webhook covers
              everything else. Every source reports the same way, so all your
              projects read the same.
            </p>
          </div>
          </Reveal>
          <Reveal delay={0.16}>
          <div>
            <p className="badge">Alerts</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Know before you go looking.</h3>
            <p className="mt-2 text-body text-ink-muted">
              Set a threshold on anything you track. When something breaks,
              Stackduck taps you on the shoulder — email or webhook, your call.
            </p>
          </div>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  )
}
