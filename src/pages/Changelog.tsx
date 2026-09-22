import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

const ENTRIES: Array<{ version: string; date: string; items: string[] }> = [
  {
    version: 'Initial release',
    date: 'September 2026',
    items: [
      'Portfolio home with project cards, health colors, search, and filters',
      'Project detail: inline-editable catalog, connectors, metric charts',
      'Connectors: Firebase, Stripe, Supabase, generic webhook, plus GitHub/Google Cloud importing',
      'Email, Google, and GitHub sign-in with consent records',
      'Connection guides, docs, and this changelog',
    ],
  },
]

/** Reverse-chronological changelog. Maintained going forward, not backfilled. */
export default function Changelog() {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <h1 className="font-grifter text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          What <span className="text-coral-emphasis">changed.</span>
        </h1>
        <p className="mt-4 text-body-lg text-slate">
          Every release, newest first. Short on purpose.
        </p>
        <div className="mt-8 flex flex-col gap-6">
          {ENTRIES.map((e) => (
            <div key={e.version} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-inter text-subheading font-semibold">{e.version}</h2>
                <p className="font-inter text-sm text-slate">{e.date}</p>
              </div>
              <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-body-sm text-graphite">
                {e.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
