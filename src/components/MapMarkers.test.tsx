// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MapContainer } from 'react-leaflet'
import { SEED_ZONES } from '../data/zones'
import type { Report, Zone } from '../types'
import { useAppStore } from '../store'
import { ReportPins } from './MapMarkers'

const preferences = vi.hoisted(() => ({ reduce: false, saveData: false }))
vi.mock('../motion/preferences', async importOriginal => ({
  ...await importOriginal<typeof import('../motion/preferences')>(),
  useReducedMotion: () => preferences.reduce,
}))
vi.mock('../motion/LandingMotionPolicy', () => ({ useSaveData: () => preferences.saveData }))
const zones: Zone[] = SEED_ZONES.map(zone => ({ ...zone, polygon: [...zone.polygon], lastUpdated: 1 }))
const report = (id: string, status: Report['status'] = 'pending', zoneId = zones[0].id): Report => ({
  id, status, zoneId, description: `Observation ${id}`, photoUrl: null, submittedAt: 100,
})
function scene(reports: Report[], showReviewedReports = false) {
  return <MapContainer center={[9.8, 118.7]} zoom={10}><ReportPins reports={reports} zones={zones} showReviewedReports={showReviewedReports} /></MapContainer>
}
afterEach(() => { cleanup(); preferences.reduce = false; preferences.saveData = false })

describe('zone report badges', () => {
  it('groups overlapping reports by zone and opens read-only details with explicit location and status labels', async () => {
    const before = useAppStore.getState()
    const reports = [report('pending'), report('confirmed', 'confirmed'), report('rejected', 'rejected'), report('other', 'pending', zones[1].id)]
    const { container } = render(scene(reports, true))
    await waitFor(() => expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(2))
    const marker = screen.getByRole('button', { name: `${zones[0].name}: 3 community reports, 1 awaiting review. Zone-level location.` })
    expect(marker.getAttribute('tabindex')).toBe('0')
    expect(marker.textContent).toContain('3 reports')
    fireEvent.click(marker)
    expect(await screen.findByText('Zone-level report · location approximate')).toBeTruthy()
    expect(screen.getByText('Observation pending')).toBeTruthy()
    expect(screen.getByText('Reviewed · confirmed')).toBeTruthy()
    expect(screen.getByText('Reviewed · rejected')).toBeTruthy()
    expect(screen.getByText('Reports do not automatically change the zone status.')).toBeTruthy()
    expect(screen.getByText('Community records, not an official clearance.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve|Reject/ })).toBeNull()
    expect(useAppStore.getState().zones).toBe(before.zones)
    expect(useAppStore.getState().reports).toBe(before.reports)
    expect(reports.map(record => record.id)).toEqual(['pending', 'confirmed', 'rejected', 'other'])
  })
  it('supports Space and Enter, and renders report text without interpreting markup', async () => {
    const record = { ...report('text'), description: '<img src=x onerror=alert(1)>' }
    render(scene([record]))
    const marker = await screen.findByRole('button', { name: /1 community report, 1 awaiting review/ })
    fireEvent.keyPress(marker, { key: ' ', charCode: 32 })
    expect(await screen.findByText(record.description)).toBeTruthy()
    expect(document.querySelector('.report-popup__description img')).toBeNull()
    fireEvent.click(document.querySelector('.leaflet-popup-close-button')!)
    fireEvent.keyPress(marker, { key: 'Enter', charCode: 13, keyCode: 13 })
    expect(await screen.findByText(record.description)).toBeTruthy()
  })
  it('updates count, accessible name and review appearance without replaying old arrivals', async () => {
    const first = report('old')
    const { container, rerender } = render(scene([first]))
    expect(container.querySelector('.report-badge--fresh')).toBeNull()
    rerender(scene([first, report('new')]))
    expect(await screen.findByRole('button', { name: /2 community reports, 2 awaiting review/ })).toBeTruthy()
    expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(1)
    expect(container.querySelector('.report-badge--fresh')).toBeTruthy()
    rerender(scene([{ ...first, status: 'confirmed' }, { ...report('new'), status: 'rejected' }], true))
    expect(await screen.findByRole('button', { name: /2 community reports, 0 awaiting review/ })).toBeTruthy()
    expect(container.querySelector('.report-badge--pending')).toBeNull()
    expect(container.querySelector('.report-badge--fresh')).toBeNull()
    rerender(scene([]))
    expect(container.querySelector('.report-badge-wrap')).toBeNull()
  })
  it.each(['reduce', 'saveData'] as const)('keeps new arrivals static for %s and skips reports with no known zone', key => {
    preferences[key] = true
    const { container, rerender } = render(scene([]))
    rerender(scene([report('new'), report('orphan', 'pending', 'missing-zone')]))
    expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(1)
    expect(container.querySelector('.report-badge--fresh')).toBeNull()
  })
  it('shows only pending records by default and reveals both reviewed statuses on demand', async () => {
    const records = [report('pending'), report('done', 'confirmed'), report('rejected', 'rejected', zones[1].id)]
    const { container, rerender } = render(scene(records))
    expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(1)
    fireEvent.click(await screen.findByRole('button', { name: /1 community report, 1 awaiting review/ }))
    expect(screen.queryByText('Observation done')).toBeNull()
    expect(screen.queryByText('Observation rejected')).toBeNull()
    rerender(scene(records, true))
    expect(await screen.findByRole('button', { name: /2 community reports, 1 awaiting review/ })).toBeTruthy()
    expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(2)
    expect(container.querySelector('.report-badge--fresh')).toBeNull()
    rerender(scene(records))
    expect(container.querySelectorAll('.report-badge-wrap')).toHaveLength(1)
    expect(records).toHaveLength(3)
  })
  it.each(['confirmed', 'rejected'] as const)('removes the open marker when the last pending report becomes %s', async status => {
    const before = useAppStore.getState()
    const record = report('last')
    const { container, rerender } = render(scene([record]))
    fireEvent.click(await screen.findByRole('button', { name: /1 community report, 1 awaiting review/ }))
    expect(await screen.findByText('Observation last')).toBeTruthy()
    const reviewed = { ...record, status }
    rerender(scene([reviewed]))
    expect(container.querySelector('.report-badge-wrap')).toBeNull()
    expect(screen.queryByText('Observation last')).toBeNull()
    expect(useAppStore.getState().zones).toBe(before.zones)
    expect(useAppStore.getState().reports).toBe(before.reports)
    rerender(scene([reviewed], true))
    expect(await screen.findByRole('button', { name: /1 community report, 0 awaiting review/ })).toBeTruthy()
  })
  it('does not animate hidden reviewed arrivals when history is revealed', () => {
    const { container, rerender } = render(scene([]))
    const records = [report('old-history', 'confirmed')]
    rerender(scene(records))
    expect(container.querySelector('.report-badge-wrap')).toBeNull()
    rerender(scene(records, true))
    expect(container.querySelector('.report-badge-wrap')).toBeTruthy()
    expect(container.querySelector('.report-badge--fresh')).toBeNull()
  })
})
