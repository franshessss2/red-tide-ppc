import type { Report } from '../types'

const DAY = 86400000
const MANILA_OFFSET = 8 * 3600000
export function manilaDate(timestamp: number): string {
  return new Date(timestamp + MANILA_OFFSET).toISOString().slice(0, 10)
}
export function activityWeeks(today: string, weeks: number) {
  const end = Date.parse(`${today}T00:00:00Z`)
  const sunday = end - new Date(end).getUTCDay() * DAY
  return Array.from({ length: weeks }, (_, index) => {
    const start = sunday - (weeks - 1 - index) * 7 * DAY
    return Array.from({ length: 7 }, (_, day) => new Date(start + day * DAY).toISOString().slice(0, 10))
  })
}
/** Available submissions only; unresolved/missing timestamps never become today. */
export function reportActivity(reports: Report[], now: number) {
  const counts = new Map<string, number>()
  let undated = 0
  for (const report of reports) {
    const time = report.submittedAt
    if (report.submittedAtPending || time === null || !Number.isFinite(time) || Number.isNaN(new Date(time + MANILA_OFFSET).getTime())) { undated++; continue }
    if (time > now) continue
    const key = manilaDate(time)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return { data: Array.from(counts, ([date, count]) => ({ date, count })), undated }
}
