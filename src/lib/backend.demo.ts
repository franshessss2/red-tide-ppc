import type {
  NewReport,
  Report,
  ReportStatus,
  Zone,
  KnownZoneStatus,
  ZoneChange,
} from '../types'
import type { Backend } from './backend'
import { mapReport, mapZone, mapZoneChange } from './firestoreMapping'
import { SEED_ZONES } from '../data/zones'
import { fileToCompressedDataUrl, MAX_PHOTO_BYTES } from './image'

/**
 * Offline demo backend: same contract as the Firebase one, but keeps everything
 * in memory and mirrors it to localStorage so a page refresh survives.
 *
 * Used automatically when no Firebase keys are configured, or on demand via
 * `VITE_USE_DEMO_BACKEND=true`. It exists so that `npm run dev` always produces
 * a working, demoable app — including with no network and no Firebase project.
 */

const STORAGE_KEY = 'red-tide-ppc:demo:v1'

type Listener = () => void

interface DemoData {
  zones: Zone[]
  reports: Report[]
  zoneChanges: ZoneChange[]
}

function freshData(): DemoData {
  const now = Date.now()
  return {
    zones: SEED_ZONES.map((zone) => ({
      id: zone.id,
      name: zone.name,
      description: zone.description,
      polygon: [...zone.polygon],
      status: zone.status,
      lastUpdated: now,
    })),
    reports: [],
    zoneChanges: [],
  }
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T)
}

function readStorage(): DemoData | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<DemoData>
    if (!Array.isArray(parsed.zones) || !Array.isArray(parsed.reports)) {
      return null
    }
    return {
      zones: parsed.zones.filter((zone) => zone && typeof zone.id === 'string')
        .map((zone) => mapZone(zone.id, zone as unknown as Record<string, unknown>)),
      reports: parsed.reports.filter((report) => report && typeof report.id === 'string')
        .map((report) => mapReport(report.id, report as unknown as Record<string, unknown>)),
      zoneChanges: (Array.isArray(parsed.zoneChanges) ? parsed.zoneChanges : []).flatMap(change => {
        const mapped = change && typeof change.id === 'string' ? mapZoneChange(change.id, change as unknown as Record<string, unknown>) : null
        return mapped ? [mapped] : []
      }),
    }
  } catch {
    return null
  }
}

function writeStorage(data: DemoData): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // localStorage unavailable (private mode / node) — memory-only is fine.
  }
}

export function clearDemoData(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function createDemoBackend(): Backend {
  let data: DemoData = readStorage() ?? freshData()
  const zoneListeners = new Set<Listener>()
  const reportListeners = new Set<Listener>()
  const changeListeners = new Set<Listener>()

  function persist(): void {
    writeStorage(data)
  }

  function emit(listeners: Set<Listener>): void {
    for (const listener of listeners) listener()
  }

  function emitZones(): void {
    persist()
    emit(zoneListeners)
  }

  function emitReports(): void {
    persist()
    emit(reportListeners)
  }

  return {
    kind: 'demo',
    outboxScope: 'demo:community-v1',

    subscribeToZones(onChange) {
      const listener: Listener = () => onChange(clone(data.zones), { fromCache: false, hasPendingWrites: false })
      zoneListeners.add(listener)
      listener()
      return () => {
        zoneListeners.delete(listener)
      }
    },

    subscribeToReports(onChange) {
      const listener: Listener = () => {
        const sorted = [...data.reports].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0) || b.id.localeCompare(a.id))
        const records = new Map(sorted.slice(0, 30).map(report => [report.id, report]))
        sorted.filter(report => report.status === 'pending').forEach(report => records.set(report.id, report))
        onChange(clone([...records.values()]), { fromCache: false, hasPendingWrites: false, limited: sorted.length > 30, cursor: 30, hasMore: sorted.length > 30 })
      }
      reportListeners.add(listener)
      listener()
      return () => {
        reportListeners.delete(listener)
      }
    },

    async addReport(input: NewReport, requestId?: string): Promise<Report> {
      const existing = requestId && data.reports.find(report => report.id === requestId)
      if (existing) {
        if (existing.zoneId !== input.zoneId || existing.description !== input.description || existing.photoUrl !== input.photoUrl) throw new Error('This receipt belongs to a different report.')
        return clone(existing)
      }
      const report: Report = {
        id: requestId ?? `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        zoneId: input.zoneId,
        description: input.description,
        photoUrl: input.photoUrl,
        submittedAt: Date.now(),
        status: 'pending',
      }
      data = { ...data, reports: [report, ...data.reports] }
      emitReports()
      return clone(report)
    },

    async getReport(id) { return clone(data.reports.find(report => report.id === id) ?? null) },
    async reportPage(cursor, allRecords = false) {
      const sorted = [...data.reports].sort((a, b) => allRecords ? a.id.localeCompare(b.id) : (b.submittedAt ?? 0) - (a.submittedAt ?? 0) || b.id.localeCompare(a.id))
      const start = typeof cursor === 'number' ? cursor : 0
      return { records: clone(sorted.slice(start, start + 30)), cursor: start + 30, hasMore: sorted.length > start + 30 }
    },
    async zoneChangePage(cursor) {
      const start = typeof cursor === 'number' ? cursor : 0
      return { records: clone(data.zoneChanges.slice(start, start + 30)), cursor: start + 30, hasMore: data.zoneChanges.length > start + 30 }
    },

    async uploadReportPhoto(file: File): Promise<string> {
      if (file.size > MAX_PHOTO_BYTES) {
        throw new Error('Photo is larger than 5 MB. Please pick a smaller image.')
      }
      return fileToCompressedDataUrl(file)
    },

    subscribeToZoneChanges(onChange) {
      const listener = () => onChange(clone(data.zoneChanges.slice(0, 30)), { fromCache: false, hasPendingWrites: false, cursor: 30, hasMore: data.zoneChanges.length > 30 })
      changeListeners.add(listener); listener()
      return () => { changeListeners.delete(listener) }
    },

    async setReportStatus(reportId: string, status: ReportStatus, note = ''): Promise<void> {
      if (note.trim().length > 500) throw new Error('Review notes must be 500 characters or fewer.')
      const found = data.reports.some((report) => report.id === reportId)
      if (!found) throw new Error(`No report with id "${reportId}".`)
      data = {
        ...data,
        reports: data.reports.map((report) =>
          report.id === reportId ? { ...report, status, reviewedAt: Date.now(), reviewNote: note.trim() } : report,
        ),
      }
      emitReports()
    },

    async setZoneStatus(zoneId: string, status: KnownZoneStatus, context = {}): Promise<void> {
      const note = context.note?.trim() ?? ''
      if (note.length > 500) throw new Error('Status notes must be 500 characters or fewer.')
      const found = data.zones.find((zone) => zone.id === zoneId)
      if (!found) throw new Error(`No zone with id "${zoneId}".`)
      if (found.status === status) return
      const now = Date.now()
      data = {
        ...data,
        zoneChanges: [{ id: `demo-change-${crypto.randomUUID()}`, zoneId, fromStatus: found.status, toStatus: status, note, reportId: context.reportId ?? null, changedAt: now }, ...data.zoneChanges],
        zones: data.zones.map((zone) =>
          zone.id === zoneId
            ? { ...zone, status, lastUpdated: now }
            : zone,
        ),
      }
      emitZones()
      emit(changeListeners)
    },
  }
}
