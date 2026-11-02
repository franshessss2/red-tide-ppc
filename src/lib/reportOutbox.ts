import type { Backend } from './backend'
import { outboxStorage, type OutboxStorage, type SavedReport } from './outboxStorage'

export const OUTBOX_EVENT = 'rtp:outbox-changed'
export const OPEN_RECEIPTS_EVENT = 'rtp:open-receipts'
const owner = crypto.randomUUID()
const running = new Map<string, Promise<SavedReport>>()
export const outboxScope = (backend: Backend) => backend.outboxScope ?? backend.kind
const message = (error: unknown) => error instanceof Error ? error.message : 'Sending failed. Your report stays on this device.'

export function notifyOutbox() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OUTBOX_EVENT))
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel(OUTBOX_EVENT)
    channel.postMessage('changed'); channel.close()
  }
}

export async function saveToOutbox(backend: Backend, draft: { zoneId: string; zoneName: string; description: string; photo: File | null }, storage: OutboxStorage = outboxStorage): Promise<SavedReport> {
  const id = `rtp-${crypto.randomUUID()}`
  const scope = outboxScope(backend)
  const record: SavedReport = { key: `${scope}:${id}`, scope, id, zoneId: draft.zoneId, zoneName: draft.zoneName, description: draft.description,
    photo: draft.photo, photoName: draft.photo?.name ?? '', photoUrl: null, createdAt: Date.now(), receivedAt: null, phase: 'saved', error: null }
  await storage.insert(record)
  notifyOutbox()
  return record
}

/** Never auto-sends. The storage lease also serializes sends from different tabs. */
export function sendOutboxReport(backend: Backend, id: string, storage: OutboxStorage = outboxStorage): Promise<SavedReport> {
  const key = `${outboxScope(backend)}:${id}`
  const existing = running.get(key)
  if (existing) return existing
  const task = (async () => {
    let record = await storage.change(key, item => {
      if (!item) throw new Error('That saved report is no longer on this device.')
      if (item.phase === 'sent') return item
      if (item.leaseUntil && item.leaseUntil > Date.now()) throw new Error('This report is already sending. Wait before retrying.')
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('You are offline. This report has not been sent.')
      return { ...item, phase: 'sending', error: null, owner, leaseUntil: Date.now() + 90000 }
    })
    notifyOutbox()
    if (!record || record.phase === 'sent') return record!
    try {
      if (record.photo && !record.photoUrl) {
        const file = new File([record.photo], record.photoName || 'report-photo.jpg', { type: record.photo.type })
        const photoUrl = await backend.uploadReportPhoto(file, record.id)
        record = await storage.change(key, item => {
          if (!item || item.owner !== owner || item.phase !== 'sending') throw new Error('Another tab is handling this report. Check My reports.')
          return { ...item, photoUrl }
        })
        if (!record) throw new Error('Saved report is unavailable.')
      }
      // A retry uses the same ID and the same persisted payload, even after a
      // response is lost. The backend checks existing data without overwriting it.
      let timeout: ReturnType<typeof setTimeout> | undefined
      try {
        await Promise.race([
          backend.addReport({ zoneId: record.zoneId, description: record.description, photoUrl: record.photoUrl }, record.id),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Receipt not confirmed yet. Retry to check the same report ID.')), 60000) }),
        ])
      } finally { clearTimeout(timeout) }
      record = await storage.change(key, item => {
        if (!item || item.owner !== owner) throw new Error('Report received; reopen My reports to check its receipt.')
        return { ...item, phase: 'sent', photo: null, receivedAt: Date.now(), leaseUntil: 0, error: null }
      })
      return record!
    } catch (error) {
      await storage.change(key, item => item?.owner === owner && item.phase !== 'sent' ? { ...item, phase: 'retry', leaseUntil: 0, error: message(error) } : item)
      throw error
    } finally { notifyOutbox() }
  })().finally(() => running.delete(key))
  running.set(key, task)
  return task
}

export async function removeOutboxReport(backend: Backend, id: string) {
  await outboxStorage.change(`${outboxScope(backend)}:${id}`, item => {
    if (item?.leaseUntil && item.leaseUntil > Date.now()) throw new Error('Wait for this send attempt before removing its local copy.')
    return undefined
  })
  notifyOutbox()
}

/** Stop holding the form open without cancelling or falsely acknowledging a send. */
export async function waitForOutboxSend(task: Promise<SavedReport>): Promise<SavedReport | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([task.catch(() => null), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 12000) })]) }
  finally { clearTimeout(timer) }
}
