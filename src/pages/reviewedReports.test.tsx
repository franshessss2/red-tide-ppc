// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MapPage } from './MapPage'
import { SharedReportActivity } from '../components/SharedReportActivity'
import { useAppStore } from '../store'
import { SEED_ZONES } from '../data/zones'
import type { MapProps } from '../components/Map'
import type { Report } from '../types'

const map = vi.hoisted(() => ({ props: null as MapProps | null }))
vi.mock('../components/Map', () => ({ Map: (props: MapProps) => { map.props = props; return <div data-testid="map" /> } }))
const original = useAppStore.getState()
const reports: Report[] = ['pending', 'confirmed', 'rejected'].map((status, i) => ({
  id: `history-${i}`, status: status as Report['status'], zoneId: SEED_ZONES[i].id,
  description: `Synthetic ${status} record`, submittedAt: i + 1, photoUrl: null,
}))
const writes = { submitReport: vi.fn(), approveReport: vi.fn(), rejectReport: vi.fn(), setZoneStatus: vi.fn(), selectZone: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  localStorage.setItem('red-tide-ppc:hint:shipping:v1', 'dismissed')
  useAppStore.setState({ ...writes, backendKind: 'demo', reports, zones: SEED_ZONES.map(z => ({ ...z, lastUpdated: null })),
    reportsReady: true, zonesReady: true, selectedZoneId: null, reportZoneId: null, notice: null })
})
afterEach(() => { cleanup(); useAppStore.setState(original, true); localStorage.clear() })
function mount() { return render(<MemoryRouter initialEntries={['/map']}><MapPage /><SharedReportActivity /></MemoryRouter>) }

it('toggles only map visibility while preserving every history record and making no store writes', () => {
  mount()
  expect(screen.queryByRole('checkbox', { name: 'Show report history' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Reset view' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Admin' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Map options' }))
  expect(screen.getByRole('button', { name: 'Open street map' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reset view' })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Shipping channel overlay/ })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Admin' })).toBeTruthy()
  const toggle = screen.getByRole('checkbox', { name: 'Show report history' }) as HTMLInputElement
  expect(toggle.checked).toBe(false)
  expect(map.props?.showReviewedReports).toBe(false)
  expect(map.props?.reports).toBe(reports)
  const zones = useAppStore.getState().zones
  fireEvent.click(toggle)
  expect(toggle.checked).toBe(true)
  expect(map.props?.showReviewedReports).toBe(true)
  expect(map.props?.reports).toBe(reports)
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('checkbox', { name: 'Show report history' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Map options' }))
  fireEvent.click(screen.getByRole('button', { name: 'Map options' }))
  expect((screen.getByRole('checkbox', { name: 'Show report history' }) as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show report history' }))
  expect(map.props?.showReviewedReports).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: /Report activity/ }))
  expect(screen.getByText('3 received')).toBeTruthy()
  expect(screen.getByText('Confirmed by admin')).toBeTruthy()
  expect(screen.getByText('Rejected by admin')).toBeTruthy()
  expect(screen.getByText('Awaiting admin review')).toBeTruthy()
  expect(useAppStore.getState().reports).toBe(reports)
  expect(useAppStore.getState().zones).toBe(zones)
  Object.values(writes).forEach(fn => expect(fn).not.toHaveBeenCalled())
})
it('starts hidden again when the map is reopened', () => {
  const view = mount()
  fireEvent.click(screen.getByRole('button', { name: 'Map options' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show report history' }))
  view.unmount(); mount()
  fireEvent.click(screen.getByRole('button', { name: 'Map options' }))
  expect((screen.getByRole('checkbox', { name: 'Show report history' }) as HTMLInputElement).checked).toBe(false)
})
