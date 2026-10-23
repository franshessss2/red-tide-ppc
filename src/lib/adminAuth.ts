import {
  browserSessionPersistence, browserPopupRedirectResolver, initializeAuth,
  GoogleAuthProvider, onIdTokenChanged, signInWithPopup, signOut, type Auth, type User,
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

let instance: Auth | undefined
function adminAuth(): Auth {
  // Select persistence when Auth starts, before the sign-in button is enabled.
  // Awaiting a storage transition inside the click path can outlive the
  // browser's transient user activation and prevent its popup from opening.
  return instance ??= initializeAuth(firebaseApp(), {
    persistence: browserSessionPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  })
}

/** Only allowlisted explanations; never display SDK messages or credentials. */
export function adminSignInError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window (auth/popup-blocked). Allow pop-ups for this RTP site, reload the page, then retry. If it still fails, try another browser.'
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window closed before completion. Keep it open until Google returns you to RTP.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in attempt replaced this one. Finish the newest Google sign-in window.'
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for Firebase Google sign-in. The project owner needs to check its authorized domains.'
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled for this Firebase project. Contact the project owner.'
    case 'auth/network-request-failed':
      return 'Google sign-in could not connect. Check your connection and retry.'
    case 'auth/web-storage-unsupported':
      return 'Browser storage is unavailable for sign-in. Try RTP in a regular browser window.'
    default:
      return 'Sign-in did not finish. Retry Google sign-in or try another browser.'
  }
}

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
