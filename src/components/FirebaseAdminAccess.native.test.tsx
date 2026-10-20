// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
const watch = vi.hoisted(() => vi.fn())
vi.mock('../lib/adminAuth', () => ({ watchAdminSession: watch, signInAdmin: vi.fn(), signOutAdmin: vi.fn() }))
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.resetModules() })
it('opens the hosted dashboard from live native apps without embedded Google OAuth or passcode moderation', async () => {
  vi.stubEnv('VITE_NATIVE_APP', 'true')
  const { FirebaseAdminAccess } = await import('./FirebaseAdminAccess')
  render(<MemoryRouter><FirebaseAdminAccess>{() => <p>Private moderation controls</p>}</FirebaseAdminAccess></MemoryRouter>)
  expect(watch).not.toHaveBeenCalled()
  expect(screen.queryByText('Private moderation controls')).toBeNull()
  expect(screen.queryByText('Continue with Google')).toBeNull()
  const link = screen.getByRole('link', { name: 'Open secure Admin' })
  expect(link.getAttribute('href')).toBe('https://red-tide-ppc.vercel.app/admin')
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(screen.getByText(/Approve or reject manually/)).toBeTruthy()
})
