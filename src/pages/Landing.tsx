import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BellRing, Check, Copy, FolderKanban, LayoutDashboard, ShieldCheck, Webhook } from 'lucide-react'
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
      3200,
    )
    return () => window.clearInterval(id)
  }, [])

  const project = DEMO_PROJECTS[active]

  return (
    <div className="relative mx-auto h-[320px] w-full max-w-[280px]">
      <Folder
        color="stackduck"
        size="sm"
        autoPlay
        accent={project.accent}
        className="absolute bottom-12 left-1/2 h-[176px] w-[209px] -translate-x-1/2"
      />
      <div
        key={active}
        className="fade-swap absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-white/20 py-3"
      >
        <span className={`status-dot ${project.dot}`} />
        <span className="font-inter text-xs font-semibold text-paper-white">
          {project.name}
        </span>
        <span className="font-inter text-xs text-paper-white/70">added to portfolio</span>
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
    <div className="mx-auto mt-6 flex w-full max-w-lg flex-col items-center gap-2">
      <p className="font-inter text-xs font-medium text-ink-muted">Or start from the CLI</p>
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <code className="block min-w-0 flex-1 truncate text-left font-mono text-xs text-ink sm:text-sm" title={INSTALL_CMD}>
          <span className="mr-2 select-none text-ink-muted">$</span>
          {INSTALL_CMD}
        </code>
        <span aria-live="polite" className={`shrink-0 font-inter text-xs text-ink-muted transition-opacity duration-150 ${copied ? 'opacity-100' : 'opacity-0'}`}>
          Copied!
        </span>
        <button
          onClick={() => void copy()}
          aria-label={copied ? 'Command copied' : 'Copy install command'}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          className="rounded-lg p-1.5 text-ink-muted transition-all duration-150 hover:bg-inset hover:text-ink"
        >
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
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
      <header className="mx-auto max-w-[var(--page-max-width)] px-6 pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
        <Reveal>
          <h1 className="mx-auto max-w-4xl font-display font-bold text-[40px] leading-[1.1] tracking-normal sm:text-display sm:leading-display sm:tracking-display">
            Stop Building Dashboards.
            <span className="mt-1 block text-coral-emphasis">Just Plug In.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-body-lg text-ink-muted">
            Connect your projects and get a live view of health, users, revenue,
            deployments, and more — without building another admin dashboard.
          </p>
          <div aria-hidden="true" className="mx-auto mt-8 flex max-w-4xl flex-wrap items-center justify-center gap-2">
            {[
              { name: 'Shop', dot: 'status-green' },
              { name: 'Blog', dot: 'status-green' },
              { name: 'API', dot: 'status-amber' },
              { name: 'Side project', dot: 'status-gray' },
            ].map((p) => (
              <span key={p.name} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 font-inter text-xs font-medium text-ink">
                <span className={`status-dot ${p.dot}`} />
                {p.name}
              </span>
            ))}
            <ArrowRight size={16} className="mx-1 text-ink-muted" />
            <span className="flex items-center gap-2 rounded-lg bg-feature px-3 py-2 font-inter text-xs font-semibold text-paper-white">
              <LayoutDashboard size={16} />
              One dashboard
            </span>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-5">
            <Link to="/signin" className="btn-primary inline-flex items-center gap-2">
              Add your first project
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/docs#quickstart" className="text-link-emphasis text-link inline-flex items-center gap-1 text-sm">
              Quick Start <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <InstallSnippet />
        </Reveal>
      </header>

      {/* DARK FEATURE MOMENT */}
      <section className="mx-auto max-w-[var(--page-max-width)] px-6 pb-28">
        <Reveal>
        {/* bg-feature: Inkwell Navy in light; bumps to Raised Navy in dark so
            the card stays distinct from the now-darker page (DARK_MODE.md). */}
        <div className="relative grid overflow-hidden rounded-3xl bg-feature p-8 sm:p-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8 lg:p-12">
          <div className="relative z-10 max-w-2xl">
            <p className="flex items-center gap-2 font-inter text-xs font-semibold uppercase text-paper-white/70">
              <span className="h-2 w-2 rounded-full bg-coral-emphasis" />
              Your projects, in one view
            </p>
            <h2 className="mt-4 max-w-xl font-display font-bold text-4xl leading-[1.16] text-paper-white sm:text-heading-lg sm:leading-heading-lg">
              Register once. Monitor everything.
            </h2>
            <p className="mt-4 max-w-xl text-body leading-relaxed text-paper-white/80">
              Every project gets a catalog entry — what it is, where it lives.
              Attach a connector and the same entry fills with live users, errors,
              and revenue. No second setup, no separate dashboard.
            </p>
            <a
              href="#features"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-paper-white px-5 py-3 font-inter text-base font-medium text-inkwell-navy transition-colors duration-150 hover:bg-ash-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper-white"
            >
              See how it works
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div
            aria-hidden="true"
            className="mt-8 min-w-0 lg:mt-0"
          >
            <PortfolioFolderDemo />
          </div>
        </div>
        </Reveal>
      </section>

      {/* FEATURE BLURBS — one aligned grid, with a shared icon and type rhythm. */}
      <section id="features" className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-[var(--page-max-width)] gap-10 px-6 py-20 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal className="min-w-0" delay={0}>
            <div className="flex h-9 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink"><FolderKanban size={18} aria-hidden="true" /></span>
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Catalog</p>
            </div>
            <h3 className="mt-5 min-h-14 font-inter text-subheading font-semibold">Register any project in seconds.</h3>
            <p className="mt-2 text-body text-ink-muted">
              A name is enough to start. Add stack tags, repo links, and notes
              whenever you like. Your catalog stays out of the way of monitoring.
            </p>
          </Reveal>
          <Reveal className="min-w-0" delay={0.08}>
            <div className="flex h-9 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink"><Webhook size={18} aria-hidden="true" /></span>
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Connectors</p>
            </div>
            <h3 className="mt-5 min-h-14 font-inter text-subheading font-semibold">Connect the stack you already use.</h3>
            <p className="mt-2 text-body text-ink-muted">
              Connect Firebase, Stripe, Supabase, Sentry, GitHub Actions, PostHog, Better Stack, or Vercel,
              and send signed events from any other stack with a webhook. Every source lands in one view.
            </p>
          </Reveal>
          <Reveal className="min-w-0" delay={0.16}>
            <div className="flex h-9 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink"><BellRing size={18} aria-hidden="true" /></span>
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Alerts</p>
            </div>
            <h3 className="mt-5 min-h-14 font-inter text-subheading font-semibold">Know before you go looking.</h3>
            <p className="mt-2 text-body text-ink-muted">
              Save threshold rules for any metric you track. Automatic monitoring
              and email or webhook notifications are coming soon.
            </p>
          </Reveal>
          <Reveal className="min-w-0" delay={0.24}>
            <div className="flex h-9 items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-canvas text-ink"><ShieldCheck size={18} aria-hidden="true" /></span>
              <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Security</p>
            </div>
            <h3 className="mt-5 min-h-14 font-inter text-subheading font-semibold">Built with security in mind.</h3>
            <p className="mt-2 text-body text-ink-muted">
              Stackduck only asks for the access it needs to monitor your projects.
              Credentials stay encrypted and under your control — revoke anytime
              from your own accounts.
            </p>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  )
}
