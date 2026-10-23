// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Admin } from './Admin'
import { useAppStore } from '../store'
import type { AdminSession } from '../lib/adminAuth'

const auth = vi.hoisted(() => ({ receive: null as ((session: AdminSession) => void) | null, stop: vi.fn(), login: vi.fn(), logout: vi.fn() }))
vi.mock('../lib/adminAuth', () => ({
  adminSignInError: (error: unknown) => (error as { code?: string })?.code === 'auth/popup-blocked' ? 'Your browser blocked the Google sign-in window (auth/popup-blocked).' : 'Sign-in did not finish.',
  watchAdminSession: (receive: (session: AdminSession) => void) => { auth.receive = receive; return auth.stop },
  signInAdmin: () => auth.login(), signOutAdmin: () => auth.logout(),
}))
const original = useAppStore.getState()
beforeEach(() => {
  vi.clearAllMocks()
  auth.receive = null
  auth.login.mockResolvedValue(undefined); auth.logout.mockResolvedValue(undefined)
  sessionStorage.setItem('red-tide-ppc:admin-unlocked', '1')
  useAppStore.setState({ backendKind: 'firebase', adminUnlocked: true, reports: [], zones: [], reportsReady: true, zonesReady: true })
})
it('shows a blocked-popup explanation while keeping moderation locked', async () => {
  mount(); act(() => auth.receive!({ status: 'signed-out' }))
  auth.login.mockRejectedValueOnce({ code: 'auth/popup-blocked', message: 'sensitive SDK details' })
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  await screen.findByText(/auth\/popup-blocked/)
  expect(screen.queryByText(/sensitive SDK details/)).toBeNull()
  expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
})
afterEach(() => { cleanup(); useAppStore.setState(original); sessionStorage.clear() })
function mount() { return render(<MemoryRouter><Admin /></MemoryRouter>) }
it('ignores a forged legacy unlock flag while checking, signed out, denied or errored', () => {
  mount()
  expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
  for (const session of [{ status: 'signed-out' }, { status: 'denied', email: 'ordinary@example.invalid' }, { status: 'error', message: 'Offline' }] as AdminSession[]) {
    act(() => auth.receive!(session))
    expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
    expect(screen.queryByLabelText('Passcode')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Unlock' })).toBeNull()
  }
})
it('only mounts the dashboard for an authorized Firebase session and locks on sign-out', async () => {
  mount(); act(() => auth.receive!({ status: 'authorized', email: 'admin@example.invalid' }))
  expect(screen.getByRole('tab', { name: /Pending/ })).toBeTruthy()
  expect(screen.getByText(/Signed in as admin@example.invalid/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' }).hasAttribute('disabled')).toBe(false))
  expect(auth.logout).toHaveBeenCalledOnce()
})
it('catches rejected popup and sign-out promises without exposing moderation', async () => {
  mount(); act(() => auth.receive!({ status: 'signed-out' }))
  auth.login.mockRejectedValueOnce(new Error('popup closed'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  await screen.findByText(/Sign-in did not finish/)
  act(() => auth.receive!({ status: 'authorized', email: 'admin@example.invalid' }))
  auth.logout.mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByText(/Could not sign out/)
  expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
})
it('removes moderation when the token loses its admin claim and unsubscribes on unmount', () => {
  const view = mount()
  act(() => auth.receive!({ status: 'authorized', email: 'admin@example.invalid' }))
  act(() => auth.receive!({ status: 'denied', email: 'admin@example.invalid' }))
  expect(screen.queryByRole('tab', { name: /Pending/ })).toBeNull()
  view.unmount(); expect(auth.stop).toHaveBeenCalledOnce()
})
it('keeps demo access local and explicitly labeled', () => {
  useAppStore.setState({ backendKind: 'demo', adminUnlocked: true })
  mount()
  expect(screen.getByRole('tab', { name: /Pending/ })).toBeTruthy()
  expect(screen.getByText(/Local sample-data demonstration only/)).toBeTruthy()
  expect(auth.receive).toBeNull()
})
