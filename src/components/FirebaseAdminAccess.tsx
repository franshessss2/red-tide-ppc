import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Header } from './Header'
import { adminSignInError, signInAdmin, signOutAdmin, watchAdminSession, type AdminSession } from '../lib/adminAuth'

const installedApp = import.meta.env.VITE_NATIVE_APP === 'true'
const HOSTED_ADMIN = 'https://red-tide-ppc.vercel.app/admin'

export interface FirebaseAdminControls { email: string; lock: () => void }

export function FirebaseAdminAccess({ children }: {
  children: (controls: FirebaseAdminControls) => ReactNode
}) {
  const [session, setSession] = useState<AdminSession>({ status: 'checking' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (installedApp) return
    try { return watchAdminSession(setSession) }
    catch { setSession({ status: 'error', message: 'Firebase sign-in is not configured. Administrator access is locked.' }) }
  }, [])

  // Google OAuth must use the system browser, never a privileged embedded
  // WebView. Public feeds/submissions stay native; moderation uses the same
  // Firebase project on the hosted, authenticated dashboard.
  if (installedApp) return <div className="min-h-full">
    <Header eyebrow="Red Tide PPC" title="Admin review" right={<Link to="/map">Public map</Link>} />
    <main className="mx-auto max-w-md px-5 py-12">
      <h1 className="font-display text-3xl text-paper">Review in your browser</h1>
      <p className="mt-3 text-sm text-muted">Reports and zone updates are shared with the website. Open the secure dashboard in your browser and sign in with your approved Google administrator account.</p>
      <a href={HOSTED_ADMIN} target="_blank" rel="noopener noreferrer" className="mt-6 block rounded-xl bg-accent px-4 py-3 text-center font-semibold text-ink">Open secure Admin</a>
      <p className="mt-4 break-all text-xs text-muted">{HOSTED_ADMIN}</p>
      <p className="mt-4 text-xs text-muted">Approve or reject manually. Review results appear here when the server connection is available.</p>
      <p className="mt-4 text-xs text-muted">Community records, not an official clearance.</p>
    </main>
  </div>

  async function authenticate(signingOut = false) {
    setBusy(true)
    setError(null)
    if (signingOut) setSession({ status: 'checking' })
    try {
      if (signingOut) { await signOutAdmin(); setSession({ status: 'signed-out' }) }
      else await signInAdmin()
    } catch (cause) {
      setError(signingOut ? 'Could not sign out. Retry before leaving this device.' : adminSignInError(cause))
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
