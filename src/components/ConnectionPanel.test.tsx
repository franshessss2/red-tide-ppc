// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ConnectionPanel } from './ConnectionPanel'
import { useAppStore } from '../store'
const original = useAppStore.getState()
beforeEach(() => useAppStore.setState({ backendKind: 'firebase', zonesFeed: { phase: 'synced', lastSyncedAt: 1700000000000, error: null }, reportsFeed: { phase: 'pending', lastSyncedAt: null, error: null } }))
afterEach(() => { cleanup(); useAppStore.setState(original, true); vi.restoreAllMocks() })
it('separates pending writes and server receipts, then responds to network loss and recovery', () => {
  let online = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
  const retry = vi.fn(); useAppStore.setState({ retryFeeds: retry })
  render(<ConnectionPanel />)
  expect(screen.getByRole('heading', { name: 'Waiting to sync' })).toBeTruthy()
  expect(screen.getByText('No server receipt recorded')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  act(() => { online = false; window.dispatchEvent(new Event('offline')) })
  expect(screen.getByRole('heading', { name: 'Offline' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Retry connection' }).hasAttribute('disabled')).toBe(true)
  act(() => { online = true; window.dispatchEvent(new Event('online')) })
  fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }))
  expect(retry).toHaveBeenCalledOnce()
})
it('never labels sample or cached data as live', () => {
  useAppStore.setState({ backendKind: 'demo' })
  const view = render(<ConnectionPanel />)
  expect(screen.getByRole('heading', { name: 'Sample · local only' })).toBeTruthy()
  useAppStore.setState({ backendKind: 'firebase', reportsFeed: { phase: 'cached', lastSyncedAt: null, error: null } })
  view.rerender(<ConnectionPanel />)
  expect(screen.getByRole('heading', { name: 'Cached copy' })).toBeTruthy()
})
