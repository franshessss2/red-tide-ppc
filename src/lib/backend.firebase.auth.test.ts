import { beforeEach, expect, it, vi } from 'vitest'
import { createFirebaseBackend } from './backend.firebase'
const sdk = vi.hoisted(() => ({ guard: vi.fn(), update: vi.fn() }))
vi.mock('./adminAuth', () => ({ requireFirebaseAdmin: () => sdk.guard() }))
vi.mock('./firebase', () => ({ firestore: () => ({}) }))
vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(), collection: vi.fn(), onSnapshot: vi.fn(),
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  serverTimestamp: () => 'synthetic-server-time', updateDoc: (...args: unknown[]) => sdk.update(...args),
}))
beforeEach(() => { vi.clearAllMocks() })
it('never sends moderation writes when Firebase authorization rejects', async () => {
  sdk.guard.mockRejectedValue(new Error('Not authorized'))
  const backend = createFirebaseBackend()
  await expect(backend.setZoneStatus('pp-bay', 'advisory')).rejects.toThrow('Not authorized')
  await expect(backend.setReportStatus('synthetic-report', 'confirmed')).rejects.toThrow('Not authorized')
  expect(sdk.update).not.toHaveBeenCalled()
})
it('allows moderation through the SDK after the claim check succeeds', async () => {
  sdk.guard.mockResolvedValue(undefined)
  const backend = createFirebaseBackend()
  await backend.setZoneStatus('pp-bay', 'advisory')
  await backend.setReportStatus('synthetic-report', 'rejected')
  expect(sdk.update).toHaveBeenCalledWith('datasets/community-v1/zones/pp-bay', { status: 'advisory', lastUpdated: 'synthetic-server-time' })
  expect(sdk.update).toHaveBeenCalledWith('datasets/community-v1/reports/synthetic-report', { status: 'rejected', reviewedAt: 'synthetic-server-time' })
})
