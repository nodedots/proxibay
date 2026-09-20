import { Link } from 'react-router-dom'

/**
 * PLACEHOLDER — replace with the real Terms of Service before launch.
 * Exists so auth consent links resolve instead of 404ing.
 */
export default function Terms() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <div className="card">
        <p className="badge badge-highlight">Placeholder — replace before launch</p>
        <h1 className="mt-3 font-inter text-2xl font-semibold">Terms of Service</h1>
        <div className="mt-4 flex flex-col gap-3 font-inter text-sm text-graphite">
          <p>
            Proxibay is a monitoring and catalog service for your own projects. You
            are responsible for the projects you register, the connectors you attach,
            and the credentials you provide to them.
          </p>
          <p>
            Connect only services you own or are authorized to access. Do not use
            Proxibay to collect data you have no right to collect.
          </p>
          <p>
            The service is provided as-is while in development. This placeholder
            will be replaced with the full terms before launch.
          </p>
        </div>
        <Link to="/" className="text-link mt-4 inline-block text-sm">← Back</Link>
      </div>
    </div>
  )
}
