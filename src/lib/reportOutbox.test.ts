import { afterEach, expect, it, vi } from 'vitest'
import type { Backend } from './backend'
import type { OutboxStorage, SavedReport } from './outboxStorage'
import { saveToOutbox, sendOutboxReport } from './reportOutbox'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
function fixture() {
  const data = new Map<string, SavedReport>()
  const storage: OutboxStorage = {
    list: async scope => [...data.values()].filter(record => record.scope === scope),
    insert: async record => { data.set(record.key, structuredClone(record)) },
    change: async (key, update) => { const record = update(data.get(key)); if (record) data.set(key, structuredClone(record)); else data.delete(key); return record },
  }
  const backend = { kind: 'demo', outboxScope: crypto.randomUUID(), addReport: vi.fn(), uploadReportPhoto: vi.fn() } as unknown as Backend
  const draft = { zoneId: 'pp-bay', zoneName: 'Bay', description: 'Synthetic offline observation.', photo: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }) }
  return { data, storage, backend, draft }
}
it('saves the prepared photo without sending and recovers the same ID and bytes from storage', async () => {
  const { storage, backend, draft } = fixture()
  const saved = await saveToOutbox(backend, draft, storage)
  expect(saved.id).toMatch(/^rtp-/)
  const restored = (await storage.list(backend.outboxScope!))[0]
  expect(await restored.photo!.text()).toBe('photo')
  expect(restored.phase).toBe('saved')
  expect(backend.addReport).not.toHaveBeenCalled()
  expect(backend.uploadReportPhoto).not.toHaveBeenCalled()
})
it('reuses the uploaded photo and stable ID after a lost acknowledgement without duplicating the server report', async () => {
  const { data, storage, backend, draft } = fixture()
  const server = new Set<string>()
  vi.mocked(backend.uploadReportPhoto).mockResolvedValue('https://example.test/prepared.jpg')
  vi.mocked(backend.addReport).mockImplementation(async (input, id) => {
    if (!server.has(id!)) { server.add(id!); throw new Error('Response lost after acceptance') }
    return { ...input, id: id!, status: 'confirmed', submittedAt: 5 }
  })
  const saved = await saveToOutbox(backend, draft, storage)
  await expect(sendOutboxReport(backend, saved.id, storage)).rejects.toThrow('Response lost')
  expect(data.get(saved.key)).toMatchObject({ phase: 'retry', photoUrl: 'https://example.test/prepared.jpg', receivedAt: null })
  const receipt = await sendOutboxReport(backend, saved.id, storage)
  expect(receipt).toMatchObject({ id: saved.id, phase: 'sent', photo: null })
  expect(receipt.receivedAt).toBeGreaterThan(0)
  expect(server.size).toBe(1)
  expect(backend.uploadReportPhoto).toHaveBeenCalledOnce()
  expect(vi.mocked(backend.addReport).mock.calls.map(call => call[1])).toEqual([saved.id, saved.id])
})
it('does not send while offline or steal another tab’s active lease', async () => {
  const { data, storage, backend, draft } = fixture()
  const saved = await saveToOutbox(backend, draft, storage)
  vi.stubGlobal('navigator', { onLine: false })
  await expect(sendOutboxReport(backend, saved.id, storage)).rejects.toThrow('offline')
  expect(data.get(saved.key)?.phase).toBe('saved')
  vi.stubGlobal('navigator', { onLine: true })
  data.set(saved.key, { ...saved, phase: 'sending', owner: 'other-tab', leaseUntil: Date.now() + 90000 })
  await expect(sendOutboxReport(backend, saved.id, storage)).rejects.toThrow('already sending')
  expect(backend.addReport).not.toHaveBeenCalled()
})
it('coalesces repeated Send clicks into one operation', async () => {
  const { storage, backend, draft } = fixture()
  let release!: () => void
  vi.mocked(backend.uploadReportPhoto).mockImplementation(() => new Promise(resolve => { release = () => resolve('https://example.test/photo.jpg') }))
  vi.mocked(backend.addReport).mockImplementation(async (input, id) => ({ ...input, id: id!, submittedAt: 1, status: 'pending' }))
  const saved = await saveToOutbox(backend, draft, storage)
  const first = sendOutboxReport(backend, saved.id, storage)
  const second = sendOutboxReport(backend, saved.id, storage)
  expect(first).toBe(second)
  await vi.waitFor(() => expect(release).toBeDefined())
  release(); await first
  expect(backend.addReport).toHaveBeenCalledOnce()
})
