import { afterEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ onSnapshot: vi.fn(), collection: vi.fn((_db, name) => name),
  query: vi.fn((source, ...constraints) => ({ source, constraints })), where: vi.fn((...args) => args), orderBy: vi.fn((...args) => args), limit: vi.fn(value => value) }))
vi.mock('firebase/firestore', () => ({ ...sdk, doc: vi.fn(), addDoc: vi.fn(), serverTimestamp: vi.fn(), updateDoc: vi.fn() }))
vi.mock('./firebase', () => ({ firestore: () => ({}), hasFirebaseConfig: false }))
import { createFirebaseBackend } from './backend.firebase'

afterEach(() => vi.clearAllMocks())
describe('Firestore snapshot metadata', () => {
  it.each(['zones'] as const)('opts %s into metadata changes and forwards document pending timestamps', (name) => {
    const stop = vi.fn()
    sdk.onSnapshot.mockReturnValue(stop)
    const backend = createFirebaseBackend()
    const next = vi.fn(); const error = vi.fn()
    const unsubscribe = name === 'zones' ? backend.subscribeToZones(next, error) : backend.subscribeToReports(next, error)
    const [collection, options, receive, fail] = sdk.onSnapshot.mock.calls[0]
    expect(collection).toBe(`datasets/community-v1/${name}`)
    expect(options).toEqual({ includeMetadataChanges: true })
    const metadata = { fromCache: true, hasPendingWrites: true }
    receive({ metadata, docs: [{ id: 'a', data: () => ({ status: 'advisory', lastUpdated: null, submittedAt: null }), metadata: { hasPendingWrites: true } }] })
    expect(next.mock.calls[0][1]).toEqual(metadata)
    expect(next.mock.calls[0][0][0]).toMatchObject(name === 'zones'
      ? { status: 'advisory', lastUpdated: null, lastUpdatedPending: true }
      : { submittedAt: null, submittedAtPending: true })
    const failure = new Error('Offline')
    fail(failure)
    expect(error).toHaveBeenCalledWith(failure)
    unsubscribe()
    expect(stop).toHaveBeenCalledOnce()
  })
  it('waits for both bounded recent and complete pending snapshots, deduplicates them and combines metadata', () => {
    const stop = vi.fn(); sdk.onSnapshot.mockReturnValue(stop)
    const next = vi.fn(), error = vi.fn()
    const unsubscribe = createFirebaseBackend().subscribeToReports(next, error)
    expect(sdk.query.mock.calls).toEqual(expect.arrayContaining([
      ['datasets/community-v1/reports', ['submittedAt', 'desc'], 31],
      ['datasets/community-v1/reports', ['status', '==', 'pending']],
    ]))
    const report = (id: string, status: string) => ({ id, data: () => ({ status, submittedAt: null }), metadata: { hasPendingWrites: false } })
    sdk.onSnapshot.mock.calls[0][2]({ docs: [report('same', 'pending')], metadata: { fromCache: false, hasPendingWrites: false } })
    expect(next).not.toHaveBeenCalled()
    sdk.onSnapshot.mock.calls[1][2]({ docs: [report('same', 'pending'), report('old-pending', 'pending')], metadata: { fromCache: true, hasPendingWrites: true } })
    expect(next.mock.calls[0][0].map((item: {id: string}) => item.id)).toEqual(['same', 'old-pending'])
    expect(next.mock.calls[0][1]).toMatchObject({ fromCache: true, hasPendingWrites: true, limited: true })
    unsubscribe(); expect(stop).toHaveBeenCalledTimes(2)
  })
})
