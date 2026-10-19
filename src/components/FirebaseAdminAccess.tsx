import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Header } from './Header'
import { signInAdmin, signOutAdmin, watchAdminSession, type AdminSession } from '../lib/adminAuth'

export interface FirebaseAdminControls { email: string; lock: () => void }

export function FirebaseAdminAccess({ children }: {
  children: (controls: FirebaseAdminControls) => ReactNode
}) {
  const [session, setSession] = useState<AdminSession>({ status: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    try { return watchAdminSession(setSession) }
    catch { setSession({ status: 'error', message: 'Firebase sign-in is not configured. Administrator access is locked.' }) }
  }, [])

  async function authenticate(signingOut = false) {
    setBusy(true)
    setError(null)
    if (signingOut) setSession({ status: 'checking' })
    try {
      if (signingOut) { await signOutAdmin(); setSession({ status: 'signed-out' }) }
      else await signInAdmin()
    } catch {
      setError(signingOut ? 'Could not sign out. Retry before leaving this device.' : 'Sign-in did not finish. Allow the Google sign-in window and try again.')
      if (signingOut) setSession({ status: 'error', message: 'Administrator access is locked in this view.' })
    } finally { setBusy(false) }
  }

  if (session.status === 'authorized' && !busy) {
    return <>{children({ email: session.email, lock: () => { void authenticate(true) } })}</>
  }

  return <div className="min-h-full">
    <Header eyebrow="Red Tide PPC" title="Admin review" right={<Link to="/map">Public map</Link>} />
    <main className="mx-auto max-w-md px-5 py-12">
      <div className="rounded-2xl border border-line bg-ink-2 p-6">
        <h1 className="font-display text-3xl text-paper">Administrator sign-in</h1>
        <p className="mt-3 text-sm text-muted">Use your Google account. Only an administrator approved for this Firebase project can review reports or change zones.</p>
        {session.status === 'checking' && <p role="status" className="mt-4 text-muted">Checking administrator access…</p>}
        {session.status === 'denied' && <p role="alert" className="mt-4 text-muted">{session.email}: this account has no administrator access. Ask the project owner to approve its Firebase user ID, then sign out and sign in again.</p>}
        {session.status === 'error' && <p role="alert" className="mt-4 text-muted">{session.message}</p>}
        {error && <p role="alert" className="mt-4 text-advisory">{error}</p>}
        <button type="button" disabled={busy || session.status === 'checking'} onClick={() => { void authenticate() }}
          className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-ink disabled:opacity-50">Continue with Google</button>
        {(session.status === 'denied' || session.status === 'error') && <button type="button" disabled={busy} onClick={() => { void authenticate(true) }} className="mt-3 w-full rounded-xl border border-line px-4 py-3 text-paper">Sign out</button>}
        <p className="mt-4 text-xs text-faint">Google handles your password. RTP does not ask for or store it. On a shared device, sign out when finished.</p>
      </div>
      <p className="mt-4 text-xs text-muted">Community records, not an official clearance.</p>
    </main>
  </div>
}
