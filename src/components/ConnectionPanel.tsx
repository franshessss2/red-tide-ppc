import { Radio, WifiOff } from 'lucide-react'
import '../styles/community-tracking.css'
import { useAppStore } from '../store'
import { connectionSummary } from '../lib/sharedActivity'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import { feedLabel } from '../lib/feed'
import { formatRecordTime } from '../lib/format'

/** Receipt and network diagnostics only; retry resubscribes and never submits a report. */
export function ConnectionPanel({ compact = false }: { compact?: boolean }) {
  const kind = useAppStore(s => s.backendKind)
  const zones = useAppStore(s => s.zonesFeed)
  const reports = useAppStore(s => s.reportsFeed)
  const retry = useAppStore(s => s.retryFeeds)
  const online = useOnlineStatus()
  const summary = connectionSummary(kind, online, zones, reports)
  return <section className={`connection-card${compact ? ' connection-card--compact' : ''}`} data-live={summary.live} aria-label="Connection health">
    <div className="connection-card__heading">{online ? <Radio size={17} aria-hidden="true" /> : <WifiOff size={17} aria-hidden="true" />}<h3>{summary.label}</h3><span>{kind === 'demo' ? 'THIS DEVICE' : 'COMMUNITY FEED'}</span></div>
    <p>{summary.detail}</p>
    {!compact && kind === 'firebase' && <dl className="connection-card__feeds">{([['Zones', zones], ['Reports', reports]] as const).map(([name, feed]) => <div key={name}><dt>{name}</dt><dd>{feedLabel(feed)}<small>{feed.lastSyncedAt === null ? 'No server receipt recorded' : `Last server receipt: ${formatRecordTime(feed.lastSyncedAt)}`}</small></dd></div>)}</dl>}
    {kind === 'firebase' && !summary.live && !compact && <button type="button" disabled={!online} onClick={() => retry()}>Retry connection</button>}
    {kind === 'firebase' && !online && <p className="connection-card__hint">Reconnect to the internet before retrying. A saved local copy does not confirm that a report was delivered.</p>}
    {!compact && kind === 'firebase' && <p className="connection-card__hint">Receipt times describe delivery to this device, not water testing or delivery to another app.</p>}
  </section>
}
