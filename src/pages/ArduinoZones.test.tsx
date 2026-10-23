// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ArduinoZones from './ArduinoZones'
import { useAppStore } from '../store'
import { FakeZonePort } from '../arduino/serial.fixture'
import { ZONE_IDS } from '../arduino/protocol'
import { getBackend } from '../lib/backend'

let port: FakeZonePort
beforeEach(() => {
  port = new FakeZonePort()
  Object.defineProperty(navigator, 'serial', { configurable: true, value: { requestPort: vi.fn(async () => port) } })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  useAppStore.setState({
    zones: ZONE_IDS.map(id => ({ id, name: id, description: '', polygon: [], lastUpdated: null, status: 'safe' })),
    reports: [], zonesReady: true, backendKind: 'demo', zonesFeed: { phase: 'sample', error: null, lastSyncedAt: null },
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('reads the real store but never writes zones/reports from identification, ACKs or hostile serial input', async () => {
  const state = useAppStore.getState()
  const zoneRef = state.zones, reportRef = state.reports
  const mutations = [vi.spyOn(state, 'submitReport'), vi.spyOn(state, 'approveReport'), vi.spyOn(state, 'rejectReport'), vi.spyOn(state, 'setZoneStatus')]
  const backend = getBackend()
  const writes = [vi.spyOn(backend, 'addReport'), vi.spyOn(backend, 'setReportStatus'), vi.spyOn(backend, 'setZoneStatus'), vi.spyOn(backend, 'uploadReportPhoto')]
  const storeWrites = vi.spyOn(useAppStore, 'setState')
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('No network writes allowed'))
  render(<MemoryRouter><ArduinoZones /></MemoryRouter>)
  expect(screen.queryByRole('button', { name: /Manual beep/ })).toBeNull()
  expect(screen.getByText(/LED 1 · D13/)).toBeTruthy()
  expect(screen.getByText(/LED 7 · D6/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Connect zone UNO' }))
  await waitFor(() => expect(port.sent).toContain('HELLO'))
  await act(async () => { port.line('RT1 ZONES READY') })
  await waitFor(() => expect(port.sent.some(line => line.startsWith('Z1,'))).toBe(true))
  await act(async () => { port.line(`RT1 ACK ${port.sent.at(-1)}`) })
  await screen.findByText('USB acknowledged')
  for (const line of ['RT1 SAMPLE 90 12', 'RT1 SETZONE pp-bay advisory', '{"zones":[{"id":"pp-bay","status":"advisory"}]}', 'RT1 APPROVE report-1', 'RT1 ACK Z1,AAAAAAA,1,1,0*00', 'RT1 COMBINED READY']) {
    await act(async () => { port.line(line) })
  }
  expect(useAppStore.getState().zones).toBe(zoneRef)
  expect(useAppStore.getState().reports).toBe(reportRef)
  for (const spy of [...mutations, ...writes, storeWrites, network]) expect(spy).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Demo zone-status display' })).toBeTruthy()
})
it('removes demo only for synced Firebase and restores it on cache/error; hides safely', async () => {
  render(<MemoryRouter><ArduinoZones /></MemoryRouter>)
  expect(screen.getByText('Community records, not an official clearance.')).toBeTruthy()
  act(() => useAppStore.setState({ backendKind: 'firebase', zonesFeed: { phase: 'synced', lastSyncedAt: 1, error: null } }))
  expect(screen.getByRole('heading', { name: 'Zone-status display' })).toBeTruthy()
  act(() => useAppStore.setState({ zonesFeed: { phase: 'cached', lastSyncedAt: 1, error: null } }))
  expect(screen.getByRole('heading', { name: 'Demo zone-status display' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Connect zone UNO' }))
  await waitFor(() => expect(port.sent).toContain('HELLO'))
  await act(async () => { port.line('RT1 ZONES READY') })
  await waitFor(() => expect(port.sent.some(line => line.startsWith('Z1,'))).toBe(true))
  Object.defineProperty(document, 'hidden', { configurable: true, value: true })
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
  await waitFor(() => expect(port.close).toHaveBeenCalledOnce())
  expect(screen.getByRole('status').textContent).toMatch(/Paused/)
  Object.defineProperty(document, 'hidden', { configurable: true, value: false })
})
