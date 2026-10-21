import { describe, expect, it } from 'vitest'
import { activityCursor, connectionSummary, observeReports } from './sharedActivity'
import { emptyFeed, type FeedState } from './feed'
import type { Report } from '../types'
const feed = (phase: FeedState['phase']): FeedState => ({ ...emptyFeed(), phase })
const report = (id: string, status: Report['status'] = 'pending'): Report => ({ id, status, zoneId: 'bay', description: 'Synthetic record', submittedAt: 1, photoUrl: null })
describe('shared activity acknowledgements', () => {
  it('ignores initial cached/server records and announces each acknowledged report or review once', () => {
    const cursor = activityCursor()
    expect(observeReports(cursor, [report('old')], feed('cached'))).toEqual([])
    expect(observeReports(cursor, [report('old')], feed('synced'))).toEqual([])
    expect(observeReports(cursor, [report('old'), report('new')], feed('pending'))).toEqual([])
    expect(observeReports(cursor, [report('old'), report('new')], feed('synced'))).toEqual([
      { key: 'new:pending', reportId: 'new', zoneId: 'bay', kind: 'received' },
    ])
    expect(observeReports(cursor, [report('old'), report('new')], feed('synced'))).toEqual([])
    expect(observeReports(cursor, [report('new', 'confirmed')], feed('cached'))).toEqual([])
    expect(observeReports(cursor, [report('old'), report('new', 'confirmed')], feed('synced'))).toEqual([
      { key: 'new:confirmed', reportId: 'new', zoneId: 'bay', kind: 'reviewed' },
    ])
    expect(observeReports(cursor, [], feed('cached'))).toEqual([])
    expect(observeReports(cursor, [report('old'), report('new', 'confirmed')], feed('synced'))).toEqual([])
  })
  it('does not invent a submission date or mutate received records', () => {
    const cursor = activityCursor()
    observeReports(cursor, [], feed('synced'))
    const item = Object.freeze({ ...report('a'), submittedAt: null, submittedAtPending: true })
    expect(observeReports(cursor, [item], feed('synced'))).toEqual([])
    expect(item.submittedAt).toBeNull()
  })
})
describe('honest per-device connection labels', () => {
  it.each(['loading', 'cached', 'pending', 'error', 'sample'] as const)('does not call a %s feed live', phase => {
    expect(connectionSummary('firebase', true, feed('synced'), feed(phase)).live).toBe(false)
  })
  it('distinguishes offline, local demo and acknowledged snapshots without promising device delivery', () => {
    expect(connectionSummary('demo', true, feed('sample'), feed('sample')).label).toBe('Sample · local only')
    expect(connectionSummary('firebase', false, feed('synced'), feed('synced')).label).toBe('Offline')
    const live = connectionSummary('firebase', true, feed('synced'), feed('synced'))
    expect(live.live).toBe(true)
    expect(live.detail).toContain('does not confirm delivery to another device')
  })
})
