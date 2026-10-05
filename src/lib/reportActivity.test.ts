import { expect, it } from 'vitest'
import type { Report } from '../types'
import { activityWeeks, manilaDate, reportActivity } from './reportActivity'
const report = (time: number | null, extra: Partial<Report> = {}): Report => ({ id: 'r', zoneId: 'z', description: 'Observation', photoUrl: null, submittedAt: time, status: 'pending', ...extra })
it('groups actual submissions by Philippine date across the UTC midnight boundary', () => {
  const time = Date.parse('2026-10-05T16:01:00Z')
  expect(manilaDate(time)).toBe('2026-10-06')
  expect(reportActivity([report(time), report(time - 120000)], time)).toEqual({ data: [{ date: '2026-10-06', count: 1 }, { date: '2026-10-05', count: 1 }], undated: 0 })
})
it('does not assign unresolved dates to today or count future records', () => {
  const now = Date.parse('2026-10-06T01:00:00Z')
  expect(reportActivity([report(null), report(now, { submittedAtPending: true }), report(NaN), report(-1e20), report(now + 1)], now)).toEqual({ data: [], undated: 4 })
})
it('aligns real consecutive dates to Sunday columns across leap days and months', () => {
  const weeks = activityWeeks('2024-03-02', 2)
  expect(weeks).toHaveLength(2)
  expect(weeks[0][0]).toBe('2024-02-18')
  expect(weeks[1]).toEqual(['2024-02-25','2024-02-26','2024-02-27','2024-02-28','2024-02-29','2024-03-01','2024-03-02'])
})
