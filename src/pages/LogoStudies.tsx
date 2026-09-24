import { StackduckMark } from '../components/Logo'

type Concept = 'signal' | 'monogram' | 'duck' | 'catalog'

function ConceptMark({ concept, size = 72 }: { concept: Concept; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true as const }
  if (concept === 'signal') return (
    <svg {...common}>
      <rect width="64" height="64" rx="15" fill="#151b31" />
      <path d="M15 19h34M15 29h21m6 0h7M15 39h12m6 0h17M15 49h34" fill="none" stroke="#f2f2f2" strokeWidth="4" strokeLinecap="round" />
      <circle cx="39" cy="29" r="4" fill="#ff5858" />
    </svg>
  )
  if (concept === 'monogram') return (
    <svg {...common}>
      <rect width="64" height="64" rx="15" fill="#151b31" />
      <path d="M46 17H26a8 8 0 0 0 0 16h12a8 8 0 0 1 0 16H17" fill="none" stroke="#f2f2f2" strokeWidth="7" strokeLinecap="round" />
      <circle cx="47" cy="17" r="4" fill="#ff5858" />
    </svg>
  )
  if (concept === 'duck') return (
    <svg {...common}>
      <rect width="64" height="64" rx="15" fill="#151b31" />
      <path d="M13 43c0-5 3-8 9-9 3-1 5-4 5-9 0-7 4-11 10-11 6 0 9 4 9 9 5 0 8 1 9 3-1 3-5 4-9 4 1 5 4 8 8 10-4 3-10 5-17 5h-3v5H13z" fill="#f2f2f2" />
      <circle cx="38" cy="20" r="3" fill="#ff5858" />
      <path d="M14 52h37" stroke="#f2f2f2" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
  return (
    <svg {...common}>
      <rect width="64" height="64" rx="15" fill="#151b31" />
      <rect x="14" y="14" width="16" height="16" rx="4" fill="#f2f2f2" />
      <rect x="34" y="14" width="16" height="16" rx="4" fill="#f2f2f2" opacity=".56" />
      <rect x="14" y="34" width="16" height="16" rx="4" fill="#f2f2f2" opacity=".56" />
      <rect x="34" y="34" width="16" height="16" rx="4" fill="#ff5858" />
      <path d="m38 42 3 3 6-7" fill="none" stroke="#151b31" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const concepts: { id: Concept | 'current'; name: string; idea: string }[] = [
  { id: 'current', name: 'Current mark', idea: 'The duck mascot perched on its stack, kept as the familiar baseline.' },
  { id: 'signal', name: 'Layered signal', idea: 'Project layers become a live readout, with the coral point marking activity.' },
  { id: 'monogram', name: 'Stacked S', idea: 'A compact S monogram drawn like a continuous stack, ending in a telemetry point.' },
  { id: 'duck', name: 'Duck, refined', idea: 'Keeps the mascot but simplifies its silhouette for a sharper app icon.' },
  { id: 'catalog', name: 'Project grid', idea: 'A portfolio of projects with one active, healthy connection.' },
]

export default function LogoStudies() {
  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="font-inter text-xs font-semibold uppercase text-ink-muted">Stackduck · identity studies</p>
        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">A mark for the whole stack.</h1>
        <p className="mt-3 max-w-2xl font-inter text-base leading-relaxed text-ink-secondary">Five directions, from familiar mascot to sharper product symbol. Each is drawn to hold up at app-icon size and in the wordmark.</p>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {concepts.map((concept, index) => (
            <article key={concept.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="flex min-h-40 items-center justify-center bg-inkwell-navy">
                {concept.id === 'current' ? <StackduckMark size={76} /> : <ConceptMark concept={concept.id} size={76} />}
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-xl font-semibold">{concept.name}</h2>
                  <span className="font-inter text-xs text-ink-muted">0{index + 1}</span>
                </div>
                <p className="mt-2 min-h-12 font-inter text-sm leading-relaxed text-ink-secondary">{concept.idea}</p>
                <div className="mt-5 flex items-center gap-2.5 border-t border-line pt-4">
                  {concept.id === 'current' ? <StackduckMark size={30} /> : <ConceptMark concept={concept.id} size={30} />}
                  <span className="font-display text-xl font-semibold text-ink">Stackduck</span>
                  <span className="ml-auto rounded-md border border-line px-2 py-1 font-inter text-[11px] text-ink-muted">APP ICON + WORDMARK</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <p className="mt-8 font-inter text-sm text-ink-muted">Concepts are shown in the current navy, paper and coral palette. Pick a direction and we can refine the proportions, color variants and small-size behavior.</p>
      </div>
    </main>
  )
}
