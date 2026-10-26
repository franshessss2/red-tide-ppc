import type { Report, Zone } from '../types'
import { zoneLabel } from '../styles/statusTheme'

export function recordTime(time: number | null | undefined): number | null {
  return typeof time === 'number' && Number.isFinite(time) && time > 0 && time <= 8.64e15 ? time : null
}
/** Do not backfill a decision date from the submission, zone or device clock. */
export function reviewTime(report: Report): number | null {
  const reviewed = recordTime(report.reviewedAt)
  const submitted = recordTime(report.submittedAt)
  return reviewed !== null && (submitted === null || reviewed >= submitted) ? reviewed : null
}
export interface RecordedChange {
  key: string; zoneId: string; reportId?: string; title: string
  at: number | null; pending: boolean; feed: 'reports' | 'zones'
}
/** A view of recorded timestamps, not a reconstructed full moderation audit. */
export function recordedChanges(reports: Report[], zones: Zone[]): RecordedChange[] {
  const changes: RecordedChange[] = []
  for (const report of reports) {
    changes.push({ key: `submitted:${report.id}`, reportId: report.id, zoneId: report.zoneId,
      title: 'Observation submitted', at: recordTime(report.submittedAt), pending: !!report.submittedAtPending, feed: 'reports' })
    if (report.status !== 'pending') changes.push({ key: `reviewed:${report.id}`, reportId: report.id, zoneId: report.zoneId,
      title: report.status === 'confirmed' ? 'Approved by admin' : 'Rejected by admin',
      at: reviewTime(report), pending: !!report.reviewedAtPending, feed: 'reports' })
  }
  for (const zone of zones) changes.push({ key: `zone:${zone.id}`, zoneId: zone.id,
    title: `Zone record · ${zoneLabel(zone.status)}`, at: recordTime(zone.lastUpdated), pending: !!zone.lastUpdatedPending, feed: 'zones' })
  return changes.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0) || (b.at ?? 0) - (a.at ?? 0) || a.key.localeCompare(b.key))
}
