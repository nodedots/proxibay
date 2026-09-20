import { Link } from 'react-router-dom'

/**
 * PLACEHOLDER — replace with the real Privacy Policy before launch.
 * Exists so auth consent links resolve instead of 404ing.
 */
export default function Privacy() {
  return (
    <div className="mx-auto mt-8 max-w-2xl">
      <div className="card">
        <p className="badge badge-highlight">Placeholder — replace before launch</p>
        <h1 className="mt-3 font-inter text-2xl font-semibold">Privacy Policy</h1>
        <div className="mt-4 flex flex-col gap-3 font-inter text-sm text-graphite">
          <p>
            Proxibay monitors the projects you connect: catalog details you enter,
            metrics your connectors send, and basic account information (email address
            and sign-in activity) needed to operate your portfolio.
          </p>
          <p>
            Your data is stored in your own project database and is never sold or
            shared with third parties. Metrics are collected only from the connectors
            you explicitly attach to a project.
          </p>
          <p>
            You can delete your account and its data at any time by reaching out.
            This placeholder will be replaced with the full policy before launch.
          </p>
        </div>
        <Link to="/" className="text-link mt-4 inline-block text-sm">← Back</Link>
      </div>
    </div>
  )
}
