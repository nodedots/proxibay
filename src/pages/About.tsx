import { useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'
import DeveloperModal from '../components/DeveloperModal'
import { Reveal } from '../components/Reveal'

/** Why Stackduck exists — human, not corporate. */
export default function About() {
  const [devOpen, setDevOpen] = useState(false)
  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav active="about" />

      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pb-28 sm:pt-20">
        <Reveal>
          <h1 className="font-display font-bold text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
            Too many projects. <span className="text-coral-emphasis">Too many tabs.</span>
          </h1>
          <div className="mt-6 flex flex-col gap-4 text-body text-ink-secondary">
          <p>
            Every project you ship comes with its own admin panels: users over here,
            errors over there, revenue somewhere else entirely. With one project that's
            fine. With five, ten, fifteen, your morning becomes a tour of dashboards —
            most of which you built yourself, one copy-pasted admin page at a time.
          </p>
          <p>
            Stackduck is the fix I wanted: part Datadog for indie devs, part Backstage
            for solo founders. Every project gets one entry — what it is, where it lives —
            and that same entry fills with live health, users, and revenue once you plug
            in a connector. Registering a project and monitoring it are the same action,
            not two chores.
          </p>
        </div>
        </Reveal>

        <Reveal delay={0.08}>
        <div className="card mt-10">
          <p className="badge bg-surface">Founder note</p>
          <div className="mt-3 flex flex-col gap-3 text-body text-ink-secondary">
            <p>
              I run a lot of projects — marketplaces, sign tools, lending experiments,
              learning apps. Each one small, each one mine, each one with its own corner
              of the internet to check. I got tired of building the same little dashboard
              for every new idea, so I built the dashboard that ends all dashboards:
              register the project once, plug in its data, and see everything side by side.
            </p>
            <p>
              I use Stackduck every day on my own portfolio. If it saves me one morning
              tour of admin panels, it was worth building — and I think it'll do the same
              for anyone else running more than one thing.
            </p>
            <p className="font-medium text-ink">
              —{' '}
              <button
                className="text-link text-ink"
                onClick={() => setDevOpen(true)}
                title="About the developer"
              >
                NodeDots
              </button>
            </p>
          </div>
        </div>
        </Reveal>

        <div className="mt-10 text-center">
          <Link to="/signin" className="btn-primary inline-block">
            Add your first project
          </Link>
        </div>
      </main>

      <SiteFooter />
      {devOpen && <DeveloperModal onClose={() => setDevOpen(false)} />}
    </div>
  )
}
