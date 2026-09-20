import { Link } from 'react-router-dom'
import SiteFooter from '../components/SiteFooter'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-inter text-subheading font-semibold text-inkwell-navy">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 font-inter text-sm leading-relaxed text-graphite">{children}</div>
    </section>
  )
}

/**
 * Standard-form Privacy Policy for Proxibay (early-stage SaaS).
 * Starting template — have it reviewed by a lawyer before real users sign up.
 */
export default function Privacy() {
  return (
    <div className="mx-auto mt-8 max-w-2xl pb-16">
      <div className="card">
        <h1 className="font-inter text-2xl font-semibold text-inkwell-navy">Privacy Policy</h1>
        <p className="mt-1 font-inter text-sm text-slate">Last updated: September 2026</p>

        <Section title="What Proxibay is">
          <p>
            Proxibay is a monitoring and catalog service for software projects. You register
            the projects you run, optionally connect them to data sources, and view their
            health, usage, and revenue in one portfolio. This policy explains what data we
            collect, why, and what we never do with it.
          </p>
        </Section>

        <Section title="Data we collect">
          <p><strong>Account data.</strong> When you create an account or sign in, we receive your email
            address and basic sign-in activity from our authentication provider. If you use
            Google or GitHub sign-in, we receive the name, email address, and profile image
            those providers share with us — nothing more.</p>
          <p><strong>Project catalog data.</strong> Whatever you enter about your projects: names,
            descriptions, stack tags, repository and live URLs, environment labels, and notes.
            You control this data; only a project name is required.</p>
          <p><strong>Metric data.</strong> When you attach a connector, we collect the metrics that
            connector reports (for example user counts, error counts, or transaction volumes)
            and store them as aggregated daily buckets tied to your projects.</p>
          <p><strong>Consent records.</strong> When you agree to this policy and our Terms of Service,
            we store a timestamped record of that agreement on your account.</p>
        </Section>

        <Section title="Connector credentials">
          <p>
            Connectors that need secrets — such as a Firebase service-account key, an API key,
            or a webhook signing secret — are stored in a dedicated secret manager, never in
            the main database alongside your project data. Our database holds only a reference
            pointing at the secret. Secrets are used solely to fetch your metrics and run
            connection health checks.
          </p>
        </Section>

        <Section title="How your data is stored and processed">
          <p>
            Account, catalog, and metric data is stored in a Firebase project database hosted
            by Google Cloud. Authentication is handled by Firebase Authentication. These
            processors handle your data only as instructed to operate the service, under
            Google's own data processing terms.
          </p>
        </Section>

        <Section title="What we never do">
          <p>
            We do not sell your data. We do not share it with advertisers or data brokers.
            We do not show ads. We access your connected services only through the connectors
            you explicitly attach, and only to collect the metrics those connectors report.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can view and edit your catalog data at any time from your project pages. You
            can disconnect any connector, which stops further collection from that source. You
            can ask us to delete your account and its associated data by reaching out — we
            will confirm once deletion is complete.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes in a way that affects your rights, we will update the
            date above and, where practical, notify you in the product. Continued use of
            Proxibay after a change takes effect means you accept the updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>Questions about privacy? Reach out and we will answer.</p>
        </Section>

        <Link to="/" className="text-link mt-6 inline-block text-sm">← Back</Link>
      </div>
      <div className="mt-10">
        <SiteFooter />
      </div>
    </div>
  )
}
