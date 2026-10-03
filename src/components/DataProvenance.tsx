import { useAppStore } from '../store'
import { feedLabel, type FeedName } from '../lib/feed'
import { formatRecordTime } from '../lib/format'

const BFAR_BULLETINS = 'https://www.bfar-frmdhabmonitoring.com.ph/shellfishBulletinFile'

export function CommunitySource() {
  const sample = useAppStore((state) => state.backendKind === 'demo')
  return (
    <p className="text-xs leading-relaxed text-muted" data-testid="community-source">
      Community records{sample && <span className="ml-2 inline-block rounded border border-line px-1.5 text-paper">Sample data</span>}
      {' · '}<a className="underline decoration-muted/50 underline-offset-2 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
        href={BFAR_BULLETINS} target="_blank" rel="noreferrer">BFAR bulletins ↗</a>
      <span className="block">Not an official clearance.</span>
    </p>
  )
}

function FeedDetail({ name, compact = false }: { name: FeedName; compact?: boolean }) {
  const feed = useAppStore((state) => name === 'zones' ? state.zonesFeed : state.reportsFeed)
  const ready = useAppStore((state) => name === 'zones' ? state.zonesReady : state.reportsReady)
  const retry = useAppStore((state) => state.retryFeeds)
  return (
    <div className="text-xs leading-relaxed text-muted" data-testid={`${name}-feed-state`}>
      <span className="font-medium text-paper/85">{name === 'zones' ? 'Zones' : 'Reports'}:</span> {feedLabel(feed)}.
      {feed.phase === 'error' && <>
        {' '}{ready ? 'Showing last received records.' : 'No records received yet.'}
        <button type="button" onClick={() => retry(name)} className="ml-2 inline-flex min-h-11 items-center px-1 text-accent underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-accent">
          Retry {name}
        </button>
      </>}
      {!compact && feed.lastSyncedAt !== null && <span className="block text-muted">
        Last server sync: {formatRecordTime(feed.lastSyncedAt)}
      </span>}
    </div>
  )
}

export function DataProvenance({ reports = true }: { reports?: boolean }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-line bg-ink-2/60 p-3" aria-label="Data source and connection">
      <CommunitySource />
      <FeedDetail name="zones" />
      {reports && <FeedDetail name="reports" />}
      <p className="text-xs leading-relaxed text-muted">Server sync describes delivery, not when the coast was tested.</p>
    </div>
  )
}

/** Remains visible when the zone drawer is closed. No duplicate live region. */
export function MapFeedStatus() {
  const phase = useAppStore((state) => state.zonesFeed.phase)
  const reportsPhase = useAppStore((state) => state.reportsFeed.phase)
  if (phase === 'synced' && reportsPhase !== 'error') return null
  return <div className="pointer-events-auto max-w-[calc(100vw-5rem)] rounded-lg border border-line bg-ink-2/95 px-3 py-1.5">
    {phase !== 'synced' && <FeedDetail name="zones" compact />}
    {reportsPhase === 'error' && <FeedDetail name="reports" compact />}
  </div>
}
