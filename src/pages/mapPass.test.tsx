// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { clearDemoData, createDemoBackend } from '../lib/backend.demo'
import { setBackendForTesting } from '../lib/backend'
import { useAppStore } from '../store'
const ZONE = 'Honda Bay — Inner Islands'
beforeEach(() => {
  localStorage.setItem('red-tide-ppc:intro:v3', 'seen'); clearDemoData(); setBackendForTesting(createDemoBackend())
  useAppStore.setState({ zones: [], reports: [], zonesReady: false, reportsReady: false, error: null, formError: null, notice: null, submitting: false, busyReportId: null, busyZoneId: null, selectedZoneId: null, reportZoneId: null, adminUnlocked: false })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); setBackendForTesting(null); window.history.pushState({}, '', '/') })
async function setup() {
  const user = userEvent.setup(); render(<App />)
  await user.click(screen.getByRole('link', { name: /open the map/i }))
  await screen.findByRole('button', { name: 'Reset view' })
  const toggle = screen.getByRole('button', { name: /Coastal zones/ })
  if (toggle.getAttribute('aria-expanded') === 'false') await user.click(toggle)
  return user
}
it('offers all seven zones and keeps attribution and map mounted across panel changes', async () => {
  const user = await setup()
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7)
  const map = document.querySelector('.leaflet-container')
  const credit = screen.getByTestId('map-attribution')
  await user.click(screen.getByRole('button', { name: 'Close zone panel' }))
  expect(screen.queryByRole('complementary', { name: 'Coastal zones and details' })).toBeNull()
  expect(document.querySelector('.leaflet-container')).toBe(map)
  expect(screen.getByTestId('map-attribution')).toBe(credit)
  await user.click(screen.getByRole('button', { name: /Coastal zones/ }))
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(7)
  expect(screen.getByText(/Approximate coastal boundaries/)).toBeTruthy()
})
it('selects from the list without a popup or camera flight, then closes and removes highlight', async () => {
  const user = await setup()
  await user.click(screen.getByRole('button', { name: new RegExp(ZONE) }))
  expect(useAppStore.getState().selectedZoneId).toBe('honda-inner')
  expect(screen.getByRole('heading', { name: ZONE })).toBeTruthy()
  expect(document.querySelector('.leaflet-popup')).toBeNull()
  await waitFor(() => expect(document.querySelectorAll('.zone-path--selected')).toHaveLength(1))
  await user.click(screen.getByRole('button', { name: 'Close zone panel' }))
  expect(useAppStore.getState().selectedZoneId).toBeNull()
  await waitFor(() => expect(document.querySelectorAll('.zone-path--selected')).toHaveLength(0))
})
it('clears details and selection on empty map click, but not a polygon click', async () => {
  await setup()
  const polygon = document.querySelector('.zone-path')!
  fireEvent.click(polygon)
  expect(useAppStore.getState().selectedZoneId).toBe(useAppStore.getState().zones[0].id)
  await waitFor(() => expect(document.querySelectorAll('.zone-path--selected')).toHaveLength(1))
  fireEvent.click(document.querySelector('.leaflet-container')!)
  expect(useAppStore.getState().selectedZoneId).toBeNull()
  expect(screen.getByRole('heading', { name: 'Explore the coast' })).toBeTruthy()
  await waitFor(() => expect(document.querySelectorAll('.zone-path--selected')).toHaveLength(0))
})
it('resets only the view, preserving reports and warnings', async () => {
  const user = await setup()
  const before = useAppStore.getState()
  act(() => { useAppStore.setState({ selectedZoneId: 'pp-bay', zones: before.zones.map(z => z.id === 'pp-bay' ? { ...z, status: 'advisory' } : z), reports: [{ id: 'sample', zoneId: 'pp-bay', description: 'A sample observation', submittedAt: Date.now(), photoUrl: null, status: 'confirmed' }] }) })
  await user.click(screen.getByRole('button', { name: 'Reset view' }))
  const state = useAppStore.getState()
  expect(state.selectedZoneId).toBeNull(); expect(state.reports).toHaveLength(1)
  expect(state.zones.find(z => z.id === 'pp-bay')?.status).toBe('advisory')
  const pin = document.querySelector('.report-pin-body--reviewed')
  expect(pin).toBeTruthy(); expect(pin?.parentElement?.getAttribute('style')).toContain('#93b7d5')
})
it('exposes keyboard and button alternatives to map gestures', async () => {
  const user = await setup()
  expect(screen.getByRole('group', { name: 'Map zoom' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: new RegExp(ZONE) }))
  fireEvent.keyDown(document.querySelector('.leaflet-container')!, { key: 'Escape' })
  expect(useAppStore.getState().selectedZoneId).toBeNull()
  expect(document.querySelector('.leaflet-control-zoom')).toBeNull()
})

it('reports tile failures separately from record feeds and retries without remounting the map', async () => {
  const user = await setup()
  const map = document.querySelector('.leaflet-container')
  const tile = document.querySelector('.leaflet-tile')!
  fireEvent.error(tile)
  expect(await screen.findByText(/Some map tiles could not load/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Explore the coast' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Retry map tiles' }))
  expect(document.querySelector('.leaflet-container')).toBe(map)
  expect(useAppStore.getState().zones).toHaveLength(7)
  expect(screen.queryByText(/Some map tiles could not load/)).toBeNull()
})
