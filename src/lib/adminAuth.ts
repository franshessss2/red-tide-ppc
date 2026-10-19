import {
  browserSessionPersistence, getAuth, GoogleAuthProvider, onIdTokenChanged,
  setPersistence, signInWithPopup, signOut, type Auth, type User,
} from 'firebase/auth'
import { firebaseApp } from './firebase'

export type AdminSession =
  | { status: 'checking' | 'signed-out'; email?: undefined }
  | { status: 'denied' | 'authorized'; email: string }
  | { status: 'error'; message: string; email?: undefined }

/** UX guard only; the same checks MUST be deployed in Firestore rules. */
export function hasAdminClaims(claims: Record<string, unknown>): boolean {
  const provider = claims.firebase as { sign_in_provider?: unknown } | undefined
  return claims.admin === true && claims.email_verified === true &&
    provider?.sign_in_provider === 'google.com'
}

function adminAuth(): Auth { return getAuth(firebaseApp()) }

export function watchAdminSession(receive: (session: AdminSession) => void): () => void {
  let alive = true
  let generation = 0
  const stop = onIdTokenChanged(adminAuth(), (user: User | null) => {
    if (!alive) return
    const current = ++generation
    receive({ status: user ? 'checking' : 'signed-out' })
    if (!user) return
    void user.getIdTokenResult().then(({ claims }) => {
      if (!alive || current !== generation) return
      receive({ status: hasAdminClaims(claims) ? 'authorized' : 'denied', email: user.email ?? '' })
    }).catch(() => {
      if (alive && current === generation) receive({ status: 'error', message: 'Could not verify administrator access. Try signing in again.' })
    })
  }, () => {
    ++generation
    if (alive) receive({ status: 'error', message: 'Authentication is unavailable. Try again later.' })
  })
  return () => { alive = false; ++generation; stop() }
}

export async function signInAdmin(): Promise<void> {
  const auth = adminAuth()
  await setPersistence(auth, browserSessionPersistence)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  await signInWithPopup(auth, provider)
}

export async function signOutAdmin(): Promise<void> { await signOut(adminAuth()) }

/** Defense in depth for callers bypassing the dashboard. Rules remain authoritative. */
export async function requireFirebaseAdmin(): Promise<void> {
  const auth = adminAuth()
  const user = auth.currentUser
  if (!user || !hasAdminClaims((await user.getIdTokenResult()).claims) || auth.currentUser !== user) {
    throw new Error('Sign in with an authorized administrator account to moderate community records.')
  }
}
