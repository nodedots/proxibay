import { useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'
import SiteNav from '../components/SiteNav'
import SiteFooter from '../components/SiteFooter'

/**
 * Public feedback form. Writes to the `feedback` collection (reviewed in the
 * Firebase console) — no account needed, shape-validated by security rules.
 */
export default function Feedback() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setError('Tell us what’s on your mind first — the message can’t be empty.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await addDoc(collection(db, 'feedback'), {
        ...(name.trim() ? { name: name.trim().slice(0, 100) } : {}),
        ...(email.trim() ? { email: email.trim().slice(0, 254) } : {}),
        message: message.trim().slice(0, 2000),
        createdAt: Timestamp.now(),
      })
      setSent(true)
    } catch {
      setError('Couldn’t send that. Check your connection and try again — or open a GitHub issue instead.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-canvas font-inter text-ink">
      <SiteNav />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-16 sm:pb-28 sm:pt-20">
        <h1 className="font-display font-bold text-4xl leading-[1.16] sm:text-heading-lg sm:leading-heading-lg">
          Tell us <span className="text-coral-emphasis">what's broken.</span>
        </h1>
        <p className="mt-4 text-body-lg text-ink-muted">
          Bugs, confusing copy, missing connectors — send it here. A human reads
          everything; the human is also the entire team.
        </p>

        <div className="card mt-8">
          {sent ? (
            <div className="text-center">
              <p className="badge badge-success">Received</p>
              <h2 className="mt-3 font-inter text-xl font-semibold">Thanks — it's in the pile.</h2>
              <p className="mt-1 font-inter text-sm text-ink-muted">
                For anything urgent or trackable,{' '}
                <a
                  href="https://github.com/nodedots/stackduck/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="text-link-emphasis text-link"
                >
                  open a GitHub issue
                </a>{' '}
                instead so it can't get lost.
              </p>
            </div>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Name <span className="font-normal text-ink-muted">(optional)</span>
                  <input
                    className="input"
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What should we call you?"
                    autoComplete="name"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Email <span className="font-normal text-ink-muted">(optional, for replies)</span>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    maxLength={254}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Message *
                <textarea
                  className="input"
                  rows={5}
                  required
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What happened, what did you expect, where were you in the app…"
                />
              </label>
              {error && (
                <p role="alert" className="font-inter text-sm text-coral-emphasis">
                  {error}
                </p>
              )}
              <button className="btn-primary w-full sm:w-auto sm:self-start" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send feedback'}
              </button>
            </form>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
