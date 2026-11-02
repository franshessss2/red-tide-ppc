export interface SavedReport {
  key: string
  scope: string
  id: string
  zoneId: string
  zoneName: string
  description: string
  photo: Blob | null
  photoName: string
  photoUrl: string | null
  createdAt: number
  receivedAt: number | null
  phase: 'saved' | 'sending' | 'retry' | 'sent'
  error: string | null
  owner?: string
  leaseUntil?: number
}

export interface OutboxStorage {
  list(scope: string): Promise<SavedReport[]>
  change(key: string, update: (record: SavedReport | undefined) => SavedReport | undefined): Promise<SavedReport | undefined>
  insert(record: SavedReport): Promise<void>
}

let opening: Promise<IDBDatabase> | undefined
function database(): Promise<IDBDatabase> {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Offline storage is unavailable on this device.')); return }
    let blocked = false
    const request = indexedDB.open('red-tide-ppc-report-outbox', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('reports', { keyPath: 'key' }).createIndex('scope', 'scope')
    request.onerror = () => reject(new Error('Could not open offline storage. Keep your report open and retry.'))
    request.onblocked = () => { blocked = true; reject(new Error('Close other RTP tabs before opening offline storage.')) }
    request.onsuccess = () => {
      const db = request.result
      if (blocked) { db.close(); return }
      db.onversionchange = () => { db.close(); opening = undefined }
      resolve(db)
    }
  }).catch(error => { opening = undefined; throw error })
  return opening!
}

export const outboxStorage: OutboxStorage = {
  async list(scope) {
    const db = await database()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', 'readonly')
      const request = transaction.objectStore('reports').index('scope').getAll(scope)
      transaction.oncomplete = () => resolve(request.result as SavedReport[])
      transaction.onerror = () => reject(new Error('Could not read saved reports.'))
    })
  },
  async insert(record) {
    const db = await database()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', 'readwrite')
      const store = transaction.objectStore('reports')
      const request = store.index('scope').getAll(record.scope)
      request.onsuccess = () => {
        const records = request.result as SavedReport[]
        const unsent = records.filter(item => item.phase !== 'sent')
        if (unsent.length >= 20 || unsent.reduce((sum, item) => sum + (item.photo?.size ?? 0), record.photo?.size ?? 0) > 50 * 1024 * 1024) {
          transaction.abort(); return
        }
        records.filter(item => item.phase === 'sent').sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0)).slice(29).forEach(item => store.delete(item.key))
        store.add(record)
      }
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(new Error('Could not save this report. The outbox may be full (20 unsent reports / 50 MB), or device storage is unavailable.'))
    })
  },
  async change(key, update) {
    const db = await database()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('reports', 'readwrite')
      const store = transaction.objectStore('reports')
      const request = store.get(key)
      let result: SavedReport | undefined
      let failure: unknown
      request.onsuccess = () => {
        try {
          result = update(request.result as SavedReport | undefined)
          if (result) {
            store.put(result)
            if (result.phase === 'sent') {
              const receipts = store.index('scope').getAll(result.scope)
              receipts.onsuccess = () => (receipts.result as SavedReport[]).filter(item => item.phase === 'sent')
                .sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0) || b.id.localeCompare(a.id)).slice(30).forEach(item => store.delete(item.key))
            }
          } else store.delete(key)
        }
        catch (error) { failure = error; transaction.abort() }
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = transaction.onerror = () => reject(failure ?? new Error('Could not update saved report storage.'))
    })
  },
}
