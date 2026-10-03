import { afterEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ onSnapshot: vi.fn(), collection: vi.fn((_db, name) => name) }))
vi.mock('firebase/firestore', () => ({ ...sdk, doc: vi.fn(), addDoc: vi.fn(), serverTimestamp: vi.fn(), updateDoc: vi.fn() }))
vi.mock('./firebase', () => ({ firestore: () => ({}), hasFirebaseConfig: false }))
import { createFirebaseBackend } from './backend.firebase'

afterEach(() => vi.clearAllMocks())
describe('Firestore snapshot metadata', () => {
  it.each(['zones', 'reports'] as const)('opts %s into metadata changes and forwards document pending timestamps', (name) => {
    const stop = vi.fn()
    sdk.onSnapshot.mockReturnValue(stop)
    const backend = createFirebaseBackend()
    const next = vi.fn(); const error = vi.fn()
    const unsubscribe = name === 'zones' ? backend.subscribeToZones(next, error) : backend.subscribeToReports(next, error)
    const [collection, options, receive, fail] = sdk.onSnapshot.mock.calls[0]
    expect(collection).toBe(name)
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
})
