import { Link } from 'react-router-dom'
import SiteNav from './SiteNav'
import SiteFooter from './SiteFooter'

export function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-inkwell-navy font-inter text-base font-semibold text-paper-white">
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="font-inter text-subheading font-semibold">{title}</h3>
        <div className="mt-1 flex flex-col gap-2 text-body text-slate">{children}</div>
      </div>
    </div>
  )
}

export function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-inkwell-navy p-4 font-mono text-xs leading-relaxed text-paper-white">
      {children}
    </pre>
  )
}

export function Path({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-paper-white px-3 py-2 font-inter text-sm font-medium text-inkwell-navy">{children}</p>
}

export function Trouble({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-inter text-body font-semibold">{title}</h3>
      <p className="mt-1 text-body-sm text-slate">{children}</p>
    </div>
  )
}

/** Shared shell for the connection guide pages: nav, header, footer. */
export function GuideShell(props: {
  badge: string
  title: React.ReactNode
  intro: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-ash-canvas font-inter text-inkwell-navy">
      <SiteNav active="docs" />
      <main className="mx-auto max-w-2xl px-6 pb-20 pt-10">
        <p className="badge bg-paper-white">{props.badge}</p>
        <h1 className="mt-3 font-grifter text-4xl font-bold leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          {props.title}
        </h1>
        <p className="mt-4 text-body-lg text-slate">{props.intro}</p>
        {props.children}
        <div className="mt-10 text-center">
          <Link to="/signin" className="btn-primary inline-block">
            Connect a project now
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
