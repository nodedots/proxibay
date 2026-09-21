import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

/** Support: honest solo-maintainer help page. No SLA cosplay. */
export default function Support() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <h1 className="font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Help, <span className="text-coral-emphasis">human included.</span>
        </h1>
        <p className="mt-4 text-body-lg text-slate">
          Proxibay is built and maintained by one person. No support tiers, no bots —
          here's how to actually reach help.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <div className="card">
            <h2 className="font-inter text-body font-semibold">Found a bug? Open an issue.</h2>
            <p className="mt-1 text-body-sm text-slate">
              <a
                href="https://github.com/nodedots/proxibay/issues"
                target="_blank"
                rel="noreferrer"
                className="text-link-emphasis text-link"
              >
                GitHub Issues
              </a>{' '}
              is the bug tracker. Include what you clicked, what you expected, and your
              browser — screenshots help more than paragraphs.
            </p>
          </div>
          <div className="card">
            <h2 className="font-inter text-body font-semibold">Just want to talk?</h2>
            <p className="mt-1 text-body-sm text-slate">
              Use the <a href="/feedback" className="text-link-emphasis text-link">feedback form</a> —
              no account needed. Feature ideas and confusing-copy reports welcome.
            </p>
          </div>
          <div className="card">
            <h2 className="font-inter text-body font-semibold">How fast is a reply?</h2>
            <p className="mt-1 text-body-sm text-slate">
              Honestly: usually within a couple of days, sometimes within the hour, occasionally
              after a weekend. Breaking bugs jump the queue. There's no SLA because there's
              no company — just a maintainer who uses this daily and wants it to work.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
