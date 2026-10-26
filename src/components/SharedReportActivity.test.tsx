// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SharedReportActivity } from './SharedReportActivity'
import { useAppStore } from '../store'
import { emptyFeed } from '../lib/feed'
import { SEED_ZONES } from '../data/zones'
import type { Report } from '../types'
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => true }))
const synced = { ...emptyFeed(), phase: 'synced' as const }
const original = useAppStore.getState()
const report = (status: Report['status'] = 'pending'): Report => ({ id: 'synthetic-report', zoneId: SEED_ZONES[0].id, status, description: 'A synthetic observation, never sent to production.', submittedAt: 1, photoUrl: null })
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true })
  HTMLDialogElement.prototype.close = vi.fn(function(this: HTMLDialogElement) { this.open = false })
  useAppStore.setState({ backendKind: 'firebase', reports: [], zones: SEED_ZONES.map(zone => ({ ...zone, lastUpdated: null })), zonesFeed: synced, reportsFeed: synced })
})
afterEach(() => { cleanup(); useAppStore.setState(original, true); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount() { return render(<MemoryRouter><SharedReportActivity /></MemoryRouter>) }
it('shows new server-confirmed activity once, opens details without selecting a zone or writing data, and follows review updates', () => {
  const writes = { submitReport: vi.fn(), approveReport: vi.fn(), rejectReport: vi.fn(), setZoneStatus: vi.fn(), selectZone: vi.fn() }
  useAppStore.setState(writes)
  mount()
  act(() => useAppStore.setState({ reports: [report()], reportsFeed: { ...synced, phase: 'pending' } }))
  expect(screen.queryByText('New report')).toBeNull()
  act(() => useAppStore.setState({ reportsFeed: synced }))
  expect(screen.getByText('New report')).toBeTruthy()
  expect(screen.getByRole('button', { name: /1 new updates/ })).toBeTruthy()
  act(() => useAppStore.setState({ reports: [report()], reportsFeed: { ...synced } }))
  expect(screen.queryByRole('button', { name: /2 new updates/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Report activity/ }))
  expect(screen.getByText(report().description)).toBeTruthy()
  expect(screen.getByText('Awaiting admin review')).toBeTruthy()
  act(() => useAppStore.setState({ reports: [report('confirmed')] }))
  expect(screen.getByText('Confirmed by admin')).toBeTruthy()
  Object.values(writes).forEach(write => expect(write).not.toHaveBeenCalled())
  fireEvent.click(screen.getByRole('button', { name: 'Close report activity' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
})
it('keeps old records quiet and exposes offline/cache/demo states honestly', () => {
  useAppStore.setState({ reports: [report()] })
  mount()
  expect(screen.queryByText('New report')).toBeNull()
  act(() => useAppStore.setState({ reportsFeed: { ...synced, phase: 'cached' } }))
  expect(screen.getByRole('button', { name: /Cached copy/ })).toBeTruthy()
  act(() => useAppStore.setState({ backendKind: 'demo', reportsFeed: { ...synced, phase: 'sample' } }))
  expect(screen.getByRole('button', { name: /Sample · local only/ })).toBeTruthy()
})
it('handles native Escape and restores focus without a layout scroll-lock leak', () => {
  mount()
  const trigger = screen.getByRole('button', { name: /Report activity/ })
  trigger.focus(); fireEvent.click(trigger)
  expect(document.body.style.overflow).toBe('hidden')
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.body.style.overflow).toBe('')
  expect(document.activeElement).toBe(trigger)
})

it('filters public history, shows real review dates and opens change entries without writes', () => {
  const pending = report()
  const reviewed = { ...report('confirmed'), id: 'reviewed-r', description: 'Synthetic reviewed observation.', submittedAt: 1700000000000, reviewedAt: 1700003600000 }
  useAppStore.setState({ reports: [reviewed, pending] })
  const writes = { submitReport: vi.fn(), approveReport: vi.fn(), rejectReport: vi.fn(), setZoneStatus: vi.fn(), selectZone: vi.fn() }
  useAppStore.setState(writes)
  mount()
  fireEvent.click(screen.getByRole('button', { name: /Report activity/ }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a report' }), { target: { value: 'reviewed-r' } })
  expect(screen.getAllByText('Confirmed by admin')).toHaveLength(1)
  expect(screen.queryByText('Awaiting admin review')).toBeNull()
  fireEvent.click(document.querySelector('.report-sync-list button')!)
  expect(screen.getByRole('region', { name: 'Report timeline' })).toBeTruthy()
  expect(screen.getByText('Approved by admin')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'What changed?' }))
  const changes = screen.getByRole('region', { name: 'Recent community changes' })
  expect(within(changes).getByText('Approved by admin')).toBeTruthy()
  fireEvent.click(within(changes).getAllByRole('button', { name: 'View report →' })[0])
  expect(screen.getByText('Synthetic reviewed observation.')).toBeTruthy()
  Object.values(writes).forEach(write => expect(write).not.toHaveBeenCalled())
})
