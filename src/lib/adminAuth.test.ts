import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { User } from 'firebase/auth'
import { adminSignInError, hasAdminClaims, requireFirebaseAdmin, signInAdmin, signOutAdmin, watchAdminSession, type AdminSession } from './adminAuth'

const sdk = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
  changed: null as ((user: User | null) => void) | null,
  failed: null as (() => void) | null,
  stop: vi.fn(), persistence: vi.fn(), login: vi.fn(), logout: vi.fn(), params: vi.fn(),
}))
vi.mock('./firebase', () => ({ firebaseApp: () => ({}) }))
vi.mock('firebase/auth', () => ({
  initializeAuth: (_app: unknown, options: unknown) => { sdk.persistence(options); return sdk.auth },
  browserSessionPersistence: 'synthetic-session-persistence', browserPopupRedirectResolver: 'synthetic-resolver',
  onIdTokenChanged: (_auth: unknown, changed: typeof sdk.changed, failed: typeof sdk.failed) => { sdk.changed = changed; sdk.failed = failed; return sdk.stop },
  GoogleAuthProvider: class { setCustomParameters = sdk.params },
  setPersistence: (...args: unknown[]) => sdk.persistence(...args),
  signInWithPopup: (...args: unknown[]) => sdk.login(...args),
  signOut: (...args: unknown[]) => sdk.logout(...args),
}))
const claims = { admin: true, email_verified: true, firebase: { sign_in_provider: 'google.com' } }
const user = (getIdTokenResult = vi.fn().mockResolvedValue({ claims })) => ({ email: 'admin@example.invalid', getIdTokenResult }) as unknown as User
beforeEach(() => { vi.clearAllMocks(); sdk.auth.currentUser = null })
afterEach(() => { sdk.changed = null; sdk.failed = null })

it('selects browser-session persistence and the popup resolver before sign-in', () => {
  const stop = watchAdminSession(vi.fn())
  expect(sdk.persistence).toHaveBeenCalledExactlyOnceWith({
    persistence: 'synthetic-session-persistence', popupRedirectResolver: 'synthetic-resolver',
  })
  expect(sdk.login).not.toHaveBeenCalled()
  stop()
})

it.each([
  [{}, false], [{ ...claims, admin: false }, false], [{ ...claims, admin: 'true' }, false],
  [{ ...claims, email_verified: false }, false], [{ ...claims, firebase: { sign_in_provider: 'password' } }, false],
  [claims, true],
])('checks exact, verified Google admin claims: %j', (input, expected) => {
  expect(hasAdminClaims(input)).toBe(expected)
})
it('denies unauthenticated and ordinary users at the Firebase mutation boundary', async () => {
  await expect(requireFirebaseAdmin()).rejects.toThrow('authorized administrator')
  sdk.auth.currentUser = user(vi.fn().mockResolvedValue({ claims: {} }))
  await expect(requireFirebaseAdmin()).rejects.toThrow('authorized administrator')
  sdk.auth.currentUser = user()
  await expect(requireFirebaseAdmin()).resolves.toBeUndefined()
})
it('never restores an earlier admin after sign-out races a token lookup', async () => {
  const sessions: AdminSession[] = []
  let resolve!: (result: { claims: typeof claims }) => void
  const pending = new Promise<{ claims: typeof claims }>((done) => { resolve = done })
  const stop = watchAdminSession((session) => sessions.push(session))
  sdk.changed!(user(vi.fn().mockReturnValue(pending)))
  sdk.changed!(null)
  resolve({ claims }); await pending; await Promise.resolve()
  expect(sessions.map((s) => s.status)).toEqual(['checking', 'signed-out'])
  stop(); expect(sdk.stop).toHaveBeenCalledOnce()
})
it('cleans up pending token results on unmount', async () => {
  const receive = vi.fn()
  const stop = watchAdminSession(receive)
  sdk.changed!(user())
  stop(); await Promise.resolve()
  expect(receive).toHaveBeenCalledTimes(1)
})
it('handles denied claims, token refresh and token/network errors closed', async () => {
  const receive = vi.fn()
  const stop = watchAdminSession(receive)
  sdk.changed!(user(vi.fn().mockResolvedValue({ claims: {} }))); await Promise.resolve()
  expect(receive).toHaveBeenLastCalledWith({ status: 'denied', email: 'admin@example.invalid' })
  sdk.changed!(user()); await Promise.resolve()
  expect(receive).toHaveBeenLastCalledWith({ status: 'authorized', email: 'admin@example.invalid' })
  sdk.changed!(user(vi.fn().mockRejectedValue(new Error('offline')))); await Promise.resolve(); await Promise.resolve()
  expect(receive.mock.lastCall![0].status).toBe('error')
  sdk.failed!(); expect(receive.mock.lastCall![0].status).toBe('error')
  stop()
})
it('requests the popup within the click call, with no preceding persistence await', async () => {
  const signingIn = signInAdmin()
  expect(sdk.login).toHaveBeenCalledOnce()
  await signingIn
  expect(sdk.params).toHaveBeenCalledWith({ prompt: 'select_account' })
  expect(sdk.login).toHaveBeenCalledOnce()
  await signOutAdmin(); expect(sdk.logout).toHaveBeenCalledWith(sdk.auth)
})
it.each([
  ['auth/popup-blocked', 'auth/popup-blocked'],
  ['auth/popup-closed-by-user', 'closed before completion'],
  ['auth/cancelled-popup-request', 'newest Google'],
  ['auth/unauthorized-domain', 'authorized domains'],
  ['auth/operation-not-allowed', 'not enabled'],
  ['auth/network-request-failed', 'could not connect'],
  ['auth/web-storage-unsupported', 'storage is unavailable'],
])('explains %s without exposing SDK details', (code, expected) => {
  const message = adminSignInError({ code, message: 'private credential', customData: { secret: 'private credential' } })
  expect(message).toContain(expected)
  expect(message).not.toContain('private credential')
})
it('never echoes arbitrary errors, codes or credentials', () => {
  for (const error of [null, 'private credential', { code: 'private credential', message: 'private credential' }]) {
    expect(adminSignInError(error)).toBe('Sign-in did not finish. Retry Google sign-in or try another browser.')
  }
})
