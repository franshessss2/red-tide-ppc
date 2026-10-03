import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setBackendForTesting, type Backend } from './lib/backend'
import { emptyFeed, type FeedMetadata } from './lib/feed'
import { useAppStore } from './store'
import type { Report, Zone } from './types'

interface Subscription<T> {
  next: (records: T[], metadata: FeedMetadata) => void
  error?: (error: unknown) => void
  stop: ReturnType<typeof vi.fn>
}
const cached = { fromCache: true, hasPendingWrites: false }
const server = { fromCache: false, hasPendingWrites: false }
const warning: Zone = { id: 'bay', name: 'City Bay', description: '', polygon: [], status: 'advisory', lastUpdated: null }
const report: Report = { id: 'r', zoneId: 'bay', description: '', photoUrl: null, status: 'pending', submittedAt: null }
let zones: Subscription<Zone>[]
let reports: Subscription<Report>[]
let stop: () => void

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1700000000000)
  zones = []; reports = []
  const backend: Backend = {
    kind: 'firebase',
    subscribeToZones(next, error) {
      const subscription = { next, error, stop: vi.fn() }
      zones.push(subscription)
      return subscription.stop
    },
    subscribeToReports(next, error) {
      const subscription = { next, error, stop: vi.fn() }
      reports.push(subscription)
      return subscription.stop
    },
    addReport: vi.fn(), uploadReportPhoto: vi.fn(), setReportStatus: vi.fn(), setZoneStatus: vi.fn(),
  }
  setBackendForTesting(backend)
  useAppStore.setState({ zones: [], reports: [], backendKind: 'firebase', zonesReady: false, reportsReady: false, zonesFeed: emptyFeed(), reportsFeed: emptyFeed(), error: null })
  stop = useAppStore.getState().init()
})
afterEach(() => { stop(); setBackendForTesting(null); vi.useRealTimers() })

describe('independent snapshot feeds', () => {
  it('promotes cached data on a metadata-only server snapshot', () => {
    zones[0].next([warning], cached)
    expect(useAppStore.getState().zonesFeed).toMatchObject({ phase: 'cached', lastSyncedAt: null })
    zones[0].next([warning], server)
    expect(useAppStore.getState().zonesFeed).toMatchObject({ phase: 'synced', lastSyncedAt: 1700000000000 })
    expect(useAppStore.getState().zones[0].lastUpdated).toBeNull()
  })

  it('does not call pending writes synced or advance the last acknowledged receipt', () => {
    zones[0].next([warning], server)
    vi.setSystemTime(1700000010000)
    zones[0].next([warning], { fromCache: false, hasPendingWrites: true })
    expect(useAppStore.getState().zonesFeed).toMatchObject({ phase: 'pending', lastSyncedAt: 1700000000000 })
    zones[0].next([warning], server)
    expect(useAppStore.getState().zonesFeed.lastSyncedAt).toBe(1700000010000)
  })

  it('retains warnings and dates after an error, without clearing another feed error', () => {
    zones[0].next([warning], server)
    reports[0].next([report], server)
    zones[0].error?.(new Error('Zone permission denied'))
    reports[0].error?.(new Error('Report permission denied'))
    expect(useAppStore.getState().zones).toEqual([warning])
    expect(useAppStore.getState().zonesFeed.phase).toBe('error')
    expect(useAppStore.getState().error).toBeNull()
    zones[0].next([warning], server)
    expect(useAppStore.getState().zonesFeed.error).toBeNull()
    expect(useAppStore.getState().reportsFeed.phase).toBe('error')
    useAppStore.getState().dismissMessages()
    expect(useAppStore.getState().reportsFeed.error).toBe('Report permission denied')
  })

  it('retains received data on an empty cache but accepts an authoritative empty server feed', () => {
    zones[0].next([warning], server)
    reports[0].next([report], server)
    zones[0].next([], cached); reports[0].next([], cached)
    expect(useAppStore.getState().zones).toEqual([warning])
    expect(useAppStore.getState().reports).toEqual([report])
    expect(useAppStore.getState().zonesFeed.phase).toBe('cached')
    zones[0].next([], server); reports[0].next([], server)
    expect(useAppStore.getState().zones).toEqual([])
    expect(useAppStore.getState().reports).toEqual([])
  })

  it('retries only the requested feed and ignores callbacks from its old subscription', () => {
    zones[0].next([warning], server)
    zones[0].error?.(new Error('Disconnected'))
    reports[0].error?.(new Error('Reports unavailable'))
    useAppStore.getState().retryFeeds('zones')
    expect(zones[0].stop).toHaveBeenCalledOnce()
    expect(reports).toHaveLength(1)
    expect(useAppStore.getState().zones).toEqual([warning])
    zones[0].next([], server); zones[0].error?.(new Error('Obsolete error'))
    expect(useAppStore.getState().zonesFeed.phase).toBe('loading')
    zones[1].next([warning], server)
    expect(useAppStore.getState().zonesFeed.phase).toBe('synced')
    expect(useAppStore.getState().reportsFeed.phase).toBe('error')
    stop()
    expect(zones[1].stop).toHaveBeenCalledOnce()
    expect(reports[0].stop).toHaveBeenCalledOnce()
    zones[1].next([], server)
    expect(useAppStore.getState().zones).toEqual([warning])
  })

  it('does not let cleanup of a replaced owner stop a new subscription', () => {
    const newStop = useAppStore.getState().init()
    stop()
    expect(zones[0].stop).toHaveBeenCalledOnce()
    expect(zones[1].stop).not.toHaveBeenCalled()
    zones[0].next([warning], server)
    expect(useAppStore.getState().zonesReady).toBe(false)
    zones[1].next([warning], server)
    expect(useAppStore.getState().zonesReady).toBe(true)
    newStop()
  })

  it('sorts unavailable report dates last without manufacturing dates', () => {
    reports[0].next([report, { ...report, id: 'newer', submittedAt: 1700000000000 }], server)
    expect(useAppStore.getState().reports.map((r) => r.id)).toEqual(['newer', 'r'])
    expect(useAppStore.getState().reports[1].submittedAt).toBeNull()
  })
})
