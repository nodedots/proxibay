import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

const INSTALL_CMD = 'npx degit nodedots/proxibay my-proxibay'

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
      <div className="flex items-center gap-2 rounded-lg border border-slate bg-paper-white py-2 pl-4 pr-2 shadow-subtle">
        <code className="select-all font-mono text-sm text-inkwell-navy">
          <span className="mr-2 select-none text-slate">$</span>
          {INSTALL_CMD}
        </code>
        <button
          onClick={() => void copy()}
          aria-label="Copy install command"
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          className="rounded-md p-1.5 text-slate transition-all duration-150 hover:bg-ash-canvas hover:text-inkwell-navy"
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
      <p aria-live="polite" className={`h-4 font-inter text-xs text-slate transition-opacity duration-150 ${copied ? 'opacity-100' : 'opacity-0'}`}>
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
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav />

      {/* HERO */}
      <header className="mx-auto max-w-[1200px] px-6 pb-20 pt-16 text-center sm:pt-24">
        <h1 className="mx-auto max-w-3xl font-grifter text-[40px] font-bold leading-[1.1] tracking-normal sm:text-display sm:leading-display sm:tracking-display">
          Stop building dashboards. <span className="text-coral-emphasis">Plug your projects in.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-body-lg text-slate">
          Proxibay gives every project a home and a heartbeat. See health, users,
          and revenue across everything you run — in one place.
        </p>
        <Link to="/signin" className="btn-primary mt-8 inline-block">
          Add your first project
        </Link>
        <InstallSnippet />
      </header>

      {/* DARK FEATURE MOMENT */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-inkwell-navy p-10 shadow-sm-2 sm:p-12">
          <div className="max-w-lg">
            <h2 className="font-grifter text-4xl font-bold leading-[1.16] text-paper-white sm:text-heading-lg sm:leading-heading-lg">
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
          {/* Tilted product-preview card */}
          <div
            aria-hidden="true"
            className="mt-8 rotate-[-5deg] rounded-2xl bg-paper-white p-5 shadow-sm-2 md:absolute md:-right-6 md:top-1/2 md:mt-0 md:w-64 md:-translate-y-1/2"
          >
            <div className="flex items-center gap-2">
              <span className="status-dot status-green" />
              <p className="font-inter text-base font-semibold text-inkwell-navy">Tabmeet</p>
            </div>
            <p className="mt-3 font-inter text-xs font-medium uppercase tracking-wide text-slate">Total users</p>
            <p className="font-inter text-2xl font-semibold text-inkwell-navy">1,248</p>
          </div>
        </div>
      </section>

      {/* FEATURE BLURBS */}
      <section id="features" className="mx-auto max-w-2xl px-6 pb-20">
        <div className="flex flex-col gap-20">
          <div>
            <p className="badge bg-paper-white">Catalog</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Register any project in seconds.</h3>
            <p className="mt-2 text-body text-slate">
              A name is enough to start. Add stack tags, repo links, and notes
              whenever you like — the catalog never gets in the way of monitoring.
            </p>
          </div>
          <div>
            <p className="badge bg-paper-white">Connectors</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Plug in where your data already lives.</h3>
            <p className="mt-2 text-body text-slate">
              Firebase and Stripe connect directly, and a generic webhook covers
              everything else. Every source reports the same way, so all your
              projects read the same.
            </p>
          </div>
          <div>
            <p className="badge bg-paper-white">Alerts</p>
            <h3 className="mt-3 font-inter text-subheading font-semibold">Know before you go looking.</h3>
            <p className="mt-2 text-body text-slate">
              Set a threshold on anything you track. When something breaks,
              Proxibay taps you on the shoulder — email or webhook, your call.
            </p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  )
}
