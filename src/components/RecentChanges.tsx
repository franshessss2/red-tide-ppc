import { useMemo } from 'react'
import type { Report, Zone } from '../types'
import type { FeedState } from '../lib/feed'
import { feedLabel } from '../lib/feed'
import { formatRecordTime } from '../lib/format'
import { recordedChanges } from '../lib/reportJourney'

export function RecentChanges({ reports, zones, source, reportsFeed, zonesFeed, onReport }: {
  reports: Report[]; zones: Zone[]; source: 'demo' | 'firebase'; reportsFeed: FeedState; zonesFeed: FeedState; onReport: (id: string) => void
}) {
  const changes = useMemo(() => recordedChanges(reports, zones), [reports, zones])
  return <section className="recent-changes" aria-label="Recent community changes">
    <div className="report-sync-list-heading"><h3>What changed?</h3><span>Latest records</span></div>
    <p className="report-sync-note">Submissions, recorded reviews and the latest status of each zone. Older zone changes are not retained in this view. Missing dates stay unavailable.</p>
    {changes.length === 0 ? <p className="report-sync-empty">No recorded changes available yet.</p> : <ol className="recent-changes__list">{changes.slice(0, 50).map(change => <li key={change.key}>
      <span className="recent-changes__dot" aria-hidden="true" />
      <div><p className="recent-changes__kind">{change.title}</p><strong>{zones.find(zone => zone.id === change.zoneId)?.name ?? 'Zone unavailable'}</strong><time dateTime={change.at !== null && !change.pending ? new Date(change.at).toISOString() : undefined}>{formatRecordTime(change.at, change.pending)}</time><small>{source === 'demo' ? 'Sample · this device' : feedLabel(change.feed === 'reports' ? reportsFeed : zonesFeed)}</small>{change.reportId && <button type="button" onClick={() => onReport(change.reportId!)}>View report →</button>}</div>
    </li>)}</ol>}
    {changes.length > 50 && <p className="report-sync-note">Showing the latest 50 recorded entries.</p>}
  </section>
}
