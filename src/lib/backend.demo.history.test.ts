// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { createDemoBackend } from './backend.demo'
import type { Zone, ZoneChange, Report } from '../types'

afterEach(() => localStorage.clear())

it('retains both warning and clearing events and review notes across a new backend instance', async () => {
  const backend = createDemoBackend()
  let zones: Zone[] = []
  let history: ZoneChange[] = []
  const stopZones = backend.subscribeToZones(value => { zones = value })
  const stopHistory = backend.subscribeToZoneChanges!(value => { history = value })
  const zoneId = zones[0].id
  const report = await backend.addReport({ zoneId, description: 'Synthetic observation.', photoUrl: null })
  await backend.setReportStatus(report.id, 'confirmed', '  Reviewed observation.  ')
  await backend.setZoneStatus(zoneId, 'advisory', { note: 'Reviewed observation.', reportId: report.id })
  await backend.setZoneStatus(zoneId, 'safe', { note: 'Warning reviewed and closed.' })
  await backend.setZoneStatus(zoneId, 'safe', { note: 'No change.' })
  expect(history).toHaveLength(2)
  expect(history.map(event => [event.fromStatus, event.toStatus])).toEqual([['advisory', 'safe'], ['safe', 'advisory']])
  stopZones(); stopHistory()

  const reloaded = createDemoBackend()
  let restored: ZoneChange[] = []
  let reports: Report[] = []
  reloaded.subscribeToZoneChanges!(value => { restored = value })()
  reloaded.subscribeToReports(value => { reports = value })()
  expect(restored).toEqual(history)
  expect(reports[0].reviewNote).toBe('Reviewed observation.')
  expect(restored[1].reportId).toBe(report.id)
})

it('migrates old local records without inventing historical changes', () => {
  const original = createDemoBackend()
  let zones: Zone[] = []
  original.subscribeToZones(value => { zones = value })()
  localStorage.setItem('red-tide-ppc:demo:v1', JSON.stringify({ zones, reports: [] }))
  const migrated = createDemoBackend()
  let restoredZones: Zone[] = []
  let history: ZoneChange[] = []
  migrated.subscribeToZones(value => { restoredZones = value })()
  migrated.subscribeToZoneChanges!(value => { history = value })()
  expect(restoredZones).toEqual(zones)
  expect(history).toEqual([])
})
