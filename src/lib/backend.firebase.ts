import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  runTransaction,
  query, where, orderBy, documentId, limit, startAfter, getDocsFromServer, getDocFromServer,
  type QueryDocumentSnapshot,
  type Firestore,
} from 'firebase/firestore'
import type { NewReport, Report, ReportStatus, KnownZoneStatus } from '../types'
import type { Backend } from './backend'
import { firestore } from './firebase'
import { requireFirebaseAdmin } from './adminAuth'
import { mapReport, mapZone, mapZoneChange, normalizeZoneStatus } from './firestoreMapping'
import { prepareReportPhoto } from './lowDataPhoto'

const PAGE_SIZE = 30

/**
 * Production backend: Cloud Firestore for zones/reports and Cloudinary for
 * report photos. Moderation requires Firebase Auth and deployed admin rules.
 *
 * Document → domain mapping lives in `./firestoreMapping`, which is pure and
 * unit-tested; this file contains the Firestore and photo-upload plumbing.
 */

const DATASET = 'datasets/community-v1'
const ZONES_COLLECTION = `${DATASET}/zones`
const REPORTS_COLLECTION = `${DATASET}/reports`
const CHANGES_COLLECTION = `${DATASET}/zoneChanges`

interface CloudinaryUploadResponse {
  secure_url?: unknown
  error?: { message?: unknown }
}

const rawEnv = import.meta.env as Record<string, string | undefined>

/** Uploads a report photo using Cloudinary's browser-safe unsigned API. */
export async function uploadPhotoToCloudinary(file: File): Promise<string> {
  const cloudName = rawEnv.VITE_CLOUDINARY_CLOUD_NAME?.trim()
  const uploadPreset = rawEnv.VITE_CLOUDINARY_UPLOAD_PRESET?.trim()

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Photo upload is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.',
    )
  }

  const body = new FormData()
  body.append('file', (await prepareReportPhoto(file)).file)
  body.append('upload_preset', uploadPreset)

  let response: Response
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`,
      { method: 'POST', body, signal: AbortSignal.timeout(30000) },
    )
  } catch {
    throw new Error('Photo upload failed. Check your connection and try again.')
  }

  let result: CloudinaryUploadResponse
  try {
    result = (await response.json()) as CloudinaryUploadResponse
  } catch {
    throw new Error('Photo upload failed: Cloudinary returned an invalid response.')
  }

  if (!response.ok || typeof result.secure_url !== 'string') {
    const detail =
      typeof result.error?.message === 'string'
        ? `: ${result.error.message}`
        : '. Please try again.'
    throw new Error(`Photo upload failed${detail}`)
  }

  return result.secure_url
}

export function createFirebaseBackend(database: () => Firestore = firestore): Backend {
  return {
    kind: 'firebase',
    get outboxScope() { return `firebase:${rawEnv.VITE_FIREBASE_PROJECT_ID ?? 'unconfigured'}:community-v1` },

    subscribeToZones(onChange, onError) {
      // No orderBy here on purpose: a doc that is missing the ordered field is
      // dropped from the snapshot, which would hide freshly-seeded zones.
      // Sorting happens in the store instead.
      return onSnapshot(
        collection(database(), ZONES_COLLECTION),
        { includeMetadataChanges: true },
        (snapshot) => {
          onChange(snapshot.docs.map((d) => mapZone(d.id, d.data(), d.metadata.hasPendingWrites)), snapshot.metadata)
        },
        (error) => onError?.(error),
      )
    },

    subscribeToReports(onChange, onError) {
      const source = collection(database(), REPORTS_COLLECTION)
      const parts = new Map<string, { records: Report[]; metadata: { fromCache: boolean; hasPendingWrites: boolean }; cursor?: unknown; hasMore?: boolean }>()
      let alive = true
      const stops = [
        ['recent', query(source, orderBy('submittedAt', 'desc'), limit(PAGE_SIZE + 1))],
        ['pending', query(source, where('status', '==', 'pending'))],
      ].map(([key, target]) => onSnapshot(target as ReturnType<typeof query>, { includeMetadataChanges: true }, snapshot => {
        if (!alive) return
        const docs = key === 'recent' ? snapshot.docs.slice(0, PAGE_SIZE) : snapshot.docs
        parts.set(String(key), { records: docs.map(d => mapReport(d.id, d.data() as Record<string, unknown>, d.metadata.hasPendingWrites)), metadata: snapshot.metadata,
          cursor: docs.at(-1), hasMore: snapshot.docs.length > PAGE_SIZE })
        if (parts.size !== 2) return
        const recent = parts.get('recent')!, pending = parts.get('pending')!
        const records = new Map(recent.records.map(report => [report.id, report]))
        pending.records.forEach(report => records.set(report.id, report))
        onChange([...records.values()], { fromCache: recent.metadata.fromCache || pending.metadata.fromCache,
          hasPendingWrites: recent.metadata.hasPendingWrites || pending.metadata.hasPendingWrites,
          limited: true, cursor: recent.cursor, hasMore: recent.hasMore })
      }, error => { if (alive) onError?.(error) }))
      return () => { alive = false; stops.forEach(stop => stop()) }
    },

    async addReport(input: NewReport, requestId?: string): Promise<Report> {
      if (requestId) {
        if (!/^rtp-[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid report receipt ID.')
        const db = database()
        const reference = doc(db, REPORTS_COLLECTION, requestId)
        return runTransaction(db, async transaction => {
          const existing = await transaction.get(reference)
          if (existing.exists()) {
            const data = existing.data()
            if (data.zoneId !== input.zoneId || data.description !== input.description || data.photoUrl !== input.photoUrl) throw new Error('This receipt belongs to a different report.')
            return mapReport(existing.id, data)
          }
          transaction.set(reference, { ...input, status: 'pending', submittedAt: serverTimestamp() })
          return { ...input, id: requestId, status: 'pending' as const, submittedAt: null }
        })
      }
      const reference = await addDoc(
        collection(database(), REPORTS_COLLECTION),
        {
          zoneId: input.zoneId,
          description: input.description,
          photoUrl: input.photoUrl,
          status: 'pending',
          submittedAt: serverTimestamp(),
        },
      )
      return {
        id: reference.id,
        zoneId: input.zoneId,
        description: input.description,
        photoUrl: input.photoUrl,
        status: 'pending',
        submittedAt: null, // The server value arrives through the report feed.
      }
    },

    async getReport(id) {
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new Error('Invalid report ID.')
      const snapshot = await getDocFromServer(doc(database(), REPORTS_COLLECTION, id))
      return snapshot.exists() ? mapReport(snapshot.id, snapshot.data()) : null
    },

    async reportPage(cursor, allRecords = false) {
      const snapshot = await getDocsFromServer(query(collection(database(), REPORTS_COLLECTION),
        orderBy(allRecords ? documentId() : 'submittedAt', allRecords ? 'asc' : 'desc'), ...(cursor ? [startAfter(cursor as QueryDocumentSnapshot)] : []), limit(PAGE_SIZE + 1)))
      const docs = snapshot.docs.slice(0, PAGE_SIZE)
      return { records: docs.map(d => mapReport(d.id, d.data())), cursor: docs.at(-1), hasMore: snapshot.docs.length > PAGE_SIZE }
    },

    async zoneChangePage(cursor) {
      const snapshot = await getDocsFromServer(query(collection(database(), CHANGES_COLLECTION), orderBy('changedAt', 'desc'),
        ...(cursor ? [startAfter(cursor as QueryDocumentSnapshot)] : []), limit(PAGE_SIZE + 1)))
      const docs = snapshot.docs.slice(0, PAGE_SIZE)
      return { records: docs.flatMap(d => { const mapped = mapZoneChange(d.id, d.data()); return mapped ? [mapped] : [] }), cursor: docs.at(-1), hasMore: snapshot.docs.length > PAGE_SIZE }
    },

    async uploadReportPhoto(file: File, _key: string): Promise<string> {
      return uploadPhotoToCloudinary(file)
    },

    subscribeToZoneChanges(onChange, onError) {
      return onSnapshot(query(collection(database(), CHANGES_COLLECTION), orderBy('changedAt', 'desc'), limit(PAGE_SIZE + 1)), { includeMetadataChanges: true }, snapshot => {
        const docs = snapshot.docs.slice(0, PAGE_SIZE)
        const changes = docs.flatMap(d => { const change = mapZoneChange(d.id, d.data(), d.metadata.hasPendingWrites); return change ? [change] : [] })
        onChange(changes, { ...snapshot.metadata, cursor: docs.at(-1), hasMore: snapshot.docs.length > PAGE_SIZE })
      }, onError)
    },

    async setReportStatus(reportId: string, status: ReportStatus, note = '') {
      if (note.trim().length > 500) throw new Error('Review notes must be 500 characters or fewer.')
      await requireFirebaseAdmin()
      await updateDoc(doc(database(), REPORTS_COLLECTION, reportId), {
        status,
        reviewedAt: serverTimestamp(),
        reviewNote: note.trim(),
      })
    },

    async setZoneStatus(zoneId: string, status: KnownZoneStatus, context = {}) {
      const note = context.note?.trim() ?? ''
      if (note.length > 500) throw new Error('Status notes must be 500 characters or fewer.')
      await requireFirebaseAdmin()
      const db = database()
      const zoneRef = doc(db, ZONES_COLLECTION, zoneId)
      const changeRef = doc(collection(db, CHANGES_COLLECTION))
      await runTransaction(db, async transaction => {
        const zone = await transaction.get(zoneRef)
        if (!zone.exists()) throw new Error('That zone no longer exists.')
        const fromStatus = normalizeZoneStatus(zone.data().status)
        if (fromStatus === status) return
        transaction.set(changeRef, { zoneId, fromStatus, toStatus: status, note, reportId: context.reportId ?? null, changedAt: serverTimestamp() })
        transaction.update(zoneRef, { status, lastUpdated: serverTimestamp(), lastChangeId: changeRef.id })
      })
    },
  }
}
