// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Admin } from './Admin'
import { useAppStore } from '../store'
import type { Report } from '../types'
const prefs = vi.hoisted(() => ({ reduced: false }))
vi.mock('../motion/preferences', () => ({ useReducedMotion: () => prefs.reduced }))
const report: Report = { id: 'queue-motion-test', zoneId: 'pp-bay', description: 'Synthetic queue transition observation.', photoUrl: null, status: 'pending', submittedAt: 0 }
const original = useAppStore.getState()
beforeEach(() => { prefs.reduced = false; useAppStore.setState({ adminUnlocked: true, reportsReady: true, reports: [report], zones: [], notice: null, error: null, busyReportId: null }) })
afterEach(() => { cleanup(); useAppStore.setState(original) })
const mount = () => render(<MemoryRouter><Admin /></MemoryRouter>)
it('keeps the last card during its exit and mounts the empty state only afterwards', async () => {
  mount()
  act(() => useAppStore.setState({ reports: [] }))
  expect(screen.queryByText('Nothing waiting for review')).toBeNull()
  expect(screen.getByText(report.description)).toBeTruthy()
  await screen.findByText('Nothing waiting for review')
  expect(screen.queryByText(report.description)).toBeNull()
})
it('does not show a stale empty state when a new pending report arrives during exit', async () => {
  mount()
  act(() => useAppStore.setState({ reports: [] }))
  act(() => useAppStore.setState({ reports: [{ ...report, id: 'new', description: 'A new synthetic report arrived.' }] }))
  await screen.findByText('A new synthetic report arrived.')
  expect(screen.queryByText('Nothing waiting for review')).toBeNull()
})
it('keeps tab selection behaviour and live accessible stat values with reduced motion', async () => {
  prefs.reduced = true; mount()
  fireEvent.click(screen.getByRole('tab', { name: 'Reviewed' }))
  expect(screen.getByRole('tab', { name: 'Reviewed' }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByText('No reviewed reports yet')).toBeTruthy()
  act(() => useAppStore.setState({ reports: [report, { ...report, id: 'second' }] }))
  await waitFor(() => expect(screen.getByRole('tab', { name: /Pending\s*2/ })).toBeTruthy())
})

it.each([false, true])('unlocks the dashboard with reduced motion = %s, without overlapping the gate', async (reduced) => {
  prefs.reduced = reduced
  useAppStore.setState({ adminUnlocked: false })
  mount()
  expect(screen.getByText('Enter admin passcode')).toBeTruthy()
  act(() => useAppStore.setState({ adminUnlocked: true }))
  await screen.findByRole('tab', { name: /Pending/ })
  expect(screen.queryByText('Enter admin passcode')).toBeNull()
})
