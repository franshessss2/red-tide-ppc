// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDemoData, createDemoBackend } from './backend.demo'

afterEach(() => { clearDemoData(); vi.useRealTimers() })
describe('stored sample records', () => {
  it('does not turn missing status or dates into no-alert records or current timestamps on reload', () => {
    localStorage.setItem('red-tide-ppc:demo:v1', JSON.stringify({
      zones: [{ id: 'a', name: 'Bay', status: 'typo' }, { id: 'b', status: 'advisory', lastUpdated: null }],
      reports: [{ id: 'r', submittedAt: 'bad' }],
    }))
    vi.useFakeTimers()
    for (const now of [1700000000000, 1700005000000]) {
      vi.setSystemTime(now)
      const backend = createDemoBackend()
      const zones = vi.fn(); const reports = vi.fn()
      backend.subscribeToZones(zones)()
      backend.subscribeToReports(reports)()
      expect(zones.mock.calls[0][0]).toMatchObject([
        { status: 'unknown', lastUpdated: null }, { status: 'advisory', lastUpdated: null },
      ])
      expect(reports.mock.calls[0][0][0].submittedAt).toBeNull()
    }
  })
})
