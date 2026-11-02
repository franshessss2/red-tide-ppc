import type {
  NewReport,
  Report,
  ReportStatus,
  Zone,
  KnownZoneStatus,
  ZoneChange,
} from '../types'
import { createDemoBackend } from './backend.demo'
import { createFirebaseBackend } from './backend.firebase'
import { hasFirebaseConfig } from './firebase'
import type { FeedMetadata } from './feed'

export interface ArchivePage<T> { records: T[]; cursor: unknown; hasMore: boolean }

/**
 * Everything the app knows how to do with a datastore.
 *
 * Components never touch Firestore or Cloudinary directly — they call store
 * actions, and the store talks to a `Backend`. There are two implementations:
 *
 *   - `backend.firebase.ts` — Firestore + Cloudinary (production)
 *   - `backend.demo.ts`     — in-memory + localStorage (no backend needed)
 *
 * Keeping the seam here means the store, the UI and the tests are all
 * datastore-agnostic.
 */
export interface Backend {
  /** Which implementation is active — surfaced in the source row. */
  readonly kind: 'firebase' | 'demo'

  /** Live zone feed. Returns an unsubscribe function. */
  subscribeToZones(
    onChange: (zones: Zone[], metadata: FeedMetadata) => void,
    onError?: (error: unknown) => void,
  ): () => void

  /** Live report feed. Returns an unsubscribe function. */
  subscribeToReports(
    onChange: (reports: Report[], metadata: FeedMetadata) => void,
    onError?: (error: unknown) => void,
  ): () => void

  /** Create a report with status `pending`. */
  addReport(input: NewReport, requestId?: string): Promise<Report>
  /** Stable ID retries return the existing matching report without rewriting it. */
  getReport?(id: string): Promise<Report | null>
  reportPage?(cursor?: unknown, allRecords?: boolean): Promise<ArchivePage<Report>>
  zoneChangePage?(cursor?: unknown): Promise<ArchivePage<ZoneChange>>
  readonly outboxScope?: string

  /** Upload a report photo and return a URL that can be stored on the report. */
  uploadReportPhoto(file: File, key: string): Promise<string>

  /** Admin: confirm or reject a report. */
  setReportStatus(reportId: string, status: ReportStatus, note?: string): Promise<void>

  /** Admin: change a zone's advisory status (and bump `lastUpdated`). */
  setZoneStatus(zoneId: string, status: KnownZoneStatus, context?: { note?: string; reportId?: string }): Promise<void>
  /** Append-only history, absent on older/test adapters. */
  subscribeToZoneChanges?(onChange: (changes: ZoneChange[], metadata?: FeedMetadata) => void, onError?: (error: unknown) => void): () => void
}

// ---------------------------------------------------------------------------
// Composition root: pick the active backend once, at startup.
//
//   Firebase keys present  → Firestore + Cloudinary
//   keys missing / forced  → in-memory demo backend
// ---------------------------------------------------------------------------

let instance: Backend | null = null

export function getBackend(): Backend {
  if (!instance) {
    instance = hasFirebaseConfig ? createFirebaseBackend() : createDemoBackend()
  }
  return instance
}

/** Test hook: inject a stub backend (pass null to reset). */
export function setBackendForTesting(backend: Backend | null): void {
  instance = backend
}

export function isDemoBackend(): boolean {
  return getBackend().kind === 'demo'
}
