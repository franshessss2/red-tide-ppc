// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createDemoBackend } from './backend.demo'
import type { Report } from '../types'
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })
it('records a real local review time and preserves it across a sample reload', async () => {
  localStorage.clear()
  const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
  const backend = createDemoBackend()
  const created = await backend.addReport({ zoneId: 'pp-bay', description: 'Synthetic review timing check.', photoUrl: null })
  now.mockReturnValue(1700003600000)
  await backend.setReportStatus(created.id, 'confirmed')
  let received: Report[] = []
  const stop = createDemoBackend().subscribeToReports(items => { received = items })
  expect(received.find(item => item.id === created.id)).toMatchObject({ submittedAt: 1700000000000, reviewedAt: 1700003600000, status: 'confirmed' })
  stop()
})
