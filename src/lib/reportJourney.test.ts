import { describe, expect, it } from 'vitest'
import { recordedChanges, reviewTime } from './reportJourney'
import { mapReport } from './firestoreMapping'
import type { Report, Zone } from '../types'
const report: Report = { id: 'r1', zoneId: 'bay', status: 'confirmed', submittedAt: 1000, reviewedAt: 2000, description: 'Synthetic observation', photoUrl: null }
const zone: Zone = { id: 'bay', name: 'The bay', status: 'safe', lastUpdated: 3000, description: '', polygon: [] }
describe('recorded report journey', () => {
  it('preserves real review timestamps and unresolved review acknowledgements at the backend boundary', () => {
    expect(mapReport('r', { reviewedAt: { seconds: 2 }, status: 'confirmed' }).reviewedAt).toBe(2000)
    expect(mapReport('r', { reviewedAt: null, status: 'confirmed' }, true)).toMatchObject({ reviewedAt: null, reviewedAtPending: true })
    expect(mapReport('r', {}).reviewedAt).toBeUndefined()
    expect(mapReport('r', {}, true).reviewedAtPending).toBeUndefined()
  })
  it('sorts actual recorded events without inventing a review date or mutating source records', () => {
    const frozen = Object.freeze({ ...report })
    const events = recordedChanges([frozen], [zone])
    expect(events.map(event => [event.key, event.at])).toEqual([['zone:bay', 3000], ['reviewed:r1', 2000], ['submitted:r1', 1000]])
    expect(recordedChanges([{ ...report, reviewedAt: undefined }], [])[1].at).toBeNull()
    expect(frozen.reviewedAt).toBe(2000)
  })
  it('does not show an impossible review time or an admin decision for a pending report', () => {
    expect(reviewTime({ ...report, reviewedAt: 500 })).toBeNull()
    expect(reviewTime({ ...report, reviewedAt: NaN })).toBeNull()
    expect(recordedChanges([{ ...report, status: 'pending' }], []).map(event => event.key)).toEqual(['submitted:r1'])
  })
})
