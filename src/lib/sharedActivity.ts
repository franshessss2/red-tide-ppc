import type { FeedState } from './feed'
import type { Report } from '../types'

export interface ActivityCursor { statuses: Map<string, Report['status']>; ready: boolean }
export interface ReportEvent { key: string; reportId: string; zoneId: string; kind: 'received' | 'reviewed' }
export const activityCursor = (): ActivityCursor => ({ statuses: new Map(), ready: false })

/** Observe acknowledged records only. Initial loads and reconnect replays stay quiet. */
export function observeReports(cursor: ActivityCursor, reports: Report[], feed: FeedState): ReportEvent[] {
  if (feed.phase !== 'synced') return []
  const events: ReportEvent[] = []
  for (const report of reports) {
    if (report.submittedAtPending) continue
    const previous = cursor.statuses.get(report.id)
    if (cursor.ready && previous !== report.status) events.push({
      key: `${report.id}:${report.status}`, reportId: report.id, zoneId: report.zoneId,
      kind: previous === undefined ? 'received' : 'reviewed',
    })
    cursor.statuses.set(report.id, report.status)
  }
  cursor.ready = true
  return events
}

export function connectionSummary(kind: 'demo' | 'firebase', online: boolean, zones: FeedState, reports: FeedState) {
  if (kind === 'demo') return { label: 'Sample · local only', detail: 'Sample records stay on this device. They are not shared with other apps.', live: false }
  if (!online) return { label: 'Offline', detail: 'Showing last received records. New changes need a server connection before they can be shared.', live: false }
  if ([zones, reports].some(feed => feed.phase === 'error')) return { label: 'Updates unavailable', detail: 'Some updates could not be received. Retry the connection; last received records may be out of date.', live: false }
  if ([zones, reports].some(feed => feed.phase === 'pending')) return { label: 'Waiting to sync', detail: 'Changes are awaiting server acknowledgement. Other apps may not have received them yet.', live: false }
  if ([zones, reports].some(feed => feed.phase === 'cached')) return { label: 'Cached copy', detail: 'Server connection is not verified. These records may be out of date.', live: false }
  if ([zones, reports].every(feed => feed.phase === 'synced')) return { label: 'Live feed', detail: 'Both server snapshots were received on this device. Connected website, Android and desktop apps read the same feed. This does not confirm delivery to another device.', live: true }
  return { label: 'Connecting', detail: 'Waiting for server snapshots. Shared updates are not verified yet.', live: false }
}
