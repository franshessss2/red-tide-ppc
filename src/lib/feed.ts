export interface FeedMetadata {
  fromCache: boolean
  hasPendingWrites: boolean
}

export type FeedName = 'zones' | 'reports'
export interface FeedState {
  phase: 'loading' | 'cached' | 'pending' | 'synced' | 'error' | 'sample'
  /** Receipt time of an acknowledged server snapshot, never a coast test date. */
  lastSyncedAt: number | null
  error: string | null
}

export function emptyFeed(): FeedState {
  return { phase: 'loading', lastSyncedAt: null, error: null }
}

export function receivedFeed(
  previous: FeedState,
  kind: 'firebase' | 'demo',
  metadata?: FeedMetadata,
): FeedState {
  if (kind === 'demo') return { phase: 'sample', lastSyncedAt: null, error: null }
  const phase = metadata?.hasPendingWrites ? 'pending'
    : metadata?.fromCache === false ? 'synced' : 'cached'
  return {
    phase,
    lastSyncedAt: phase === 'synced' ? Date.now() : previous.lastSyncedAt,
    error: null,
  }
}

/** Stable wording also used by the single, coalesced announcement region. */
export function feedLabel(feed: FeedState): string {
  switch (feed.phase) {
    case 'loading': return 'Connecting'
    case 'cached': return 'Cached copy · server not verified'
    case 'pending': return 'Changes awaiting server acknowledgement'
    case 'synced': return 'Server snapshot received'
    case 'error': return 'Updates unavailable'
    case 'sample': return 'Sample data · local records'
  }
}
