import { create } from 'zustand'
import { getBackend } from './lib/backend'
import { emptyFeed, receivedFeed, type FeedName, type FeedState } from './lib/feed'
import { zoneStatusMeta } from './lib/status'
import { isImageFile, MAX_PHOTO_BYTES } from './lib/image'
import type { Report, Zone, KnownZoneStatus } from './types'

/**
 * The one and only place the app talks to the datastore.
 *
 * Components read state and call these actions; nothing outside this file (and
 * `src/lib/*`) imports Firestore or Storage.
 */

/** What the report form hands to `submitReport`. Lives here (not in
 * `types.ts`) because it references the DOM `File` type, and `types.ts` is
 * shared with the Node seed script. */
export interface ReportDraft {
  zoneId: string
  description: string
  photo: File | null
}

export const MIN_DESCRIPTION_LENGTH = 10
export const MAX_DESCRIPTION_LENGTH = 2000

// One subscription owner survives retries; obsolete callbacks cannot write state.
let stopActiveFeeds: (() => void) | null = null
let retryActiveFeed: ((feed?: FeedName) => void) | null = null

const ADMIN_SESSION_KEY = 'red-tide-ppc:admin-unlocked'

const rawEnv = import.meta.env as Record<string, string | undefined>

function sortByZoneName(zones: Zone[]): Zone[] {
  return [...zones].sort((a, b) => a.name.localeCompare(b.name))
}

function sortByNewest(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
}

function readAdminSession(): boolean {
  try {
    return globalThis.sessionStorage?.getItem(ADMIN_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeAdminSession(unlocked: boolean): void {
  try {
    if (unlocked) globalThis.sessionStorage?.setItem(ADMIN_SESSION_KEY, '1')
    else globalThis.sessionStorage?.removeItem(ADMIN_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export interface AppState {
  zones: Zone[]
  reports: Report[]
  backendKind: 'firebase' | 'demo'

  zonesReady: boolean
  reportsReady: boolean
  zonesFeed: FeedState
  reportsFeed: FeedState
  /** Global problem — surfaced as a toast by <Notice />. */
  error: string | null
  /** Problem with the form the user is filling in — shown inline, not as a
   * toast, so the message is not repeated twice on screen. */
  formError: string | null
  /** Success message — surfaced as a toast by <Notice />. */
  notice: string | null

  /** Zone currently highlighted on the map. */
  selectedZoneId: string | null
  /** Zone the report form is open for, or null when the form is closed. */
  reportZoneId: string | null

  submitting: boolean
  /** Report id currently being approved/rejected, to disable its buttons. */
  busyReportId: string | null
  /** Zone id currently being changed, to disable its buttons. */
  busyZoneId: string | null

  adminUnlocked: boolean

  /** Subscribe to both live feeds. Returns the unsubscribe function. */
  init: () => () => void
  retryFeeds: (feed?: FeedName) => void
  selectZone: (zoneId: string | null) => void
  openReportForm: (zoneId: string) => void
  closeReportForm: () => void
  submitReport: (draft: ReportDraft) => Promise<void>
  approveReport: (reportId: string) => Promise<void>
  rejectReport: (reportId: string) => Promise<void>
  setZoneStatus: (zoneId: string, status: KnownZoneStatus) => Promise<void>
  tryUnlockAdmin: (passcode: string) => boolean
  lockAdmin: () => void
  dismissMessages: () => void
}

export const useAppStore = create<AppState>()((set, get) => ({
  zones: [],
  reports: [],
  backendKind: getBackend().kind,

  zonesReady: false,
  reportsReady: false,
  zonesFeed: emptyFeed(),
  reportsFeed: emptyFeed(),
  error: null,
  formError: null,
  notice: null,

  selectedZoneId: null,
  reportZoneId: null,

  submitting: false,
  busyReportId: null,
  busyZoneId: null,

  adminUnlocked: readAdminSession(),

  init() {
    stopActiveFeeds?.()
    const backend = getBackend()
    const changedBackend = get().backendKind !== backend.kind
    set({
      backendKind: backend.kind,
      zonesFeed: emptyFeed(), reportsFeed: emptyFeed(),
      ...(changedBackend ? { zones: [], reports: [], zonesReady: false, reportsReady: false, selectedZoneId: null, reportZoneId: null } : {}),
    })
    let alive = true
    const generations = { zones: 0, reports: 0 }
    const unsubscribe: Record<FeedName, (() => void) | null> = { zones: null, reports: null }

    function connect(feed: FeedName) {
      const generation = ++generations[feed]
      unsubscribe[feed]?.()
      unsubscribe[feed] = null
      const key = feed === 'zones' ? 'zonesFeed' : 'reportsFeed'
      set((state) => ({ [key]: { ...state[key], phase: 'loading', error: null } }))
      const current = () => alive && generations[feed] === generation
      const onError = (error: unknown) => {
        if (!current()) return
        set((state) => ({
          [key]: { ...state[key], phase: 'error', error: describe(error, `Could not load ${feed}.`) },
        }))
      }
      try {
        unsubscribe[feed] = feed === 'zones'
          ? backend.subscribeToZones((zones, metadata) => {
              if (!current()) return
              set((state) => ({
                // An unverified empty cache cannot erase a received warning.
                zones: metadata?.fromCache && zones.length === 0 && state.zonesReady
                  ? state.zones : sortByZoneName(zones),
                zonesReady: true,
                zonesFeed: receivedFeed(state.zonesFeed, backend.kind, metadata),
              }))
            }, onError)
          : backend.subscribeToReports((reports, metadata) => {
              if (!current()) return
              set((state) => ({
                reports: metadata?.fromCache && reports.length === 0 && state.reportsReady
                  ? state.reports : sortByNewest(reports),
                reportsReady: true,
                reportsFeed: receivedFeed(state.reportsFeed, backend.kind, metadata),
              }))
            }, onError)
      } catch (error) {
        onError(error)
      }
    }
    const retry = (feed?: FeedName) => {
      if (!alive) return
      if (feed) connect(feed)
      else { connect('zones'); connect('reports') }
    }
    const stop = () => {
      if (!alive) return
      alive = false
      unsubscribe.zones?.()
      unsubscribe.reports?.()
      if (stopActiveFeeds === stop) {
        stopActiveFeeds = null
        retryActiveFeed = null
      }
    }
    stopActiveFeeds = stop
    retryActiveFeed = retry
    retry()
    return stop
  },

  retryFeeds(feed) {
    retryActiveFeed?.(feed)
  },

  selectZone(zoneId) {
    set({ selectedZoneId: zoneId })
  },

  openReportForm(zoneId) {
    set({
      reportZoneId: zoneId,
      selectedZoneId: zoneId,
      error: null,
      formError: null,
    })
  },

  closeReportForm() {
    set({ reportZoneId: null, submitting: false, error: null, formError: null })
  },

  async submitReport(draft) {
    const description = draft.description.trim()
    const zone = get().zones.find((z) => z.id === draft.zoneId)

    if (!zone) {
      set({ formError: 'Pick a zone on the map before submitting a report.' })
      throw new Error('Unknown zone')
    }
    if (description.length < MIN_DESCRIPTION_LENGTH) {
      set({
        formError: `Please describe what you saw in at least ${MIN_DESCRIPTION_LENGTH} characters.`,
      })
      throw new Error('Description too short')
    }
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      set({
        formError: `That description is too long (max ${MAX_DESCRIPTION_LENGTH} characters).`,
      })
      throw new Error('Description too long')
    }
    if (draft.photo && !isImageFile(draft.photo)) {
      set({ formError: 'The attachment has to be an image file.' })
      throw new Error('Not an image')
    }
    if (draft.photo && draft.photo.size > MAX_PHOTO_BYTES) {
      set({ formError: 'Photo is larger than 5 MB. Please pick a smaller image.' })
      throw new Error('Photo too large')
    }

    set({ submitting: true, formError: null })
    try {
      const backend = getBackend()

      // Photo first: if the upload fails we have not written a report that
      // points at a URL that does not exist.
      let photoUrl: string | null = null
      if (draft.photo) {
        photoUrl = await backend.uploadReportPhoto(
          draft.photo,
          `${zone.id}-${Date.now()}`,
        )
      }

      await backend.addReport({
        zoneId: zone.id,
        description,
        photoUrl,
      })

      set({
        submitting: false,
        reportZoneId: null,
        formError: null,
        notice: `Salamat! Your report for ${zone.name} was sent for review.`,
      })
    } catch (error) {
      set({
        submitting: false,
        formError: describe(
          error,
          'Could not send your report. Please try again.',
        ),
      })
      throw error
    }
  },

  async approveReport(reportId) {
    const report = get().reports.find((r) => r.id === reportId)
    if (!report) {
      set({ error: 'That report is no longer in the list.' })
      return
    }

    set({ busyReportId: reportId, error: null })
    try {
      const backend = getBackend()
      await backend.setReportStatus(reportId, 'confirmed')

      // The zone flip is a second write. If it fails we still keep the report
      // confirmed, but say so loudly.
      try {
        await backend.setZoneStatus(report.zoneId, 'advisory')
      } catch (zoneError) {
        set({
          busyReportId: null,
          error: describe(
            zoneError,
            'Report reviewed, but the zone warning could not be updated. Please retry the zone change.',
          ),
        })
        return
      }

      const zoneName = zoneNameFor(get().zones, report.zoneId)
      set({
        busyReportId: null,
        notice: `Approved. ${zoneName} now has a community warning.`,
      })
    } catch (error) {
      set({
        busyReportId: null,
        error: describe(error, 'Could not approve that report.'),
      })
    }
  },

  async rejectReport(reportId) {
    const report = get().reports.find((r) => r.id === reportId)
    if (!report) {
      set({ error: 'That report is no longer in the list.' })
      return
    }

    set({ busyReportId: reportId, error: null })
    try {
      await getBackend().setReportStatus(reportId, 'rejected')
      set({
        busyReportId: null,
        notice: `Rejected. ${zoneNameFor(get().zones, report.zoneId)} was left unchanged.`,
      })
    } catch (error) {
      set({
        busyReportId: null,
        error: describe(error, 'Could not reject that report.'),
      })
    }
  },

  async setZoneStatus(zoneId, status) {
    set({ busyZoneId: zoneId, error: null })
    try {
      await getBackend().setZoneStatus(zoneId, status)
      set({
        busyZoneId: null,
        notice: `${zoneNameFor(get().zones, zoneId)} set to ${zoneStatusMeta(status).label}.`,
      })
    } catch (error) {
      set({
        busyZoneId: null,
        error: describe(error, 'Could not update that zone.'),
      })
    }
  },

  tryUnlockAdmin(passcode) {
    const expected = rawEnv.VITE_ADMIN_PASSCODE?.trim()
    if (!expected) {
      set({
        formError:
          'No admin passcode is configured. Set VITE_ADMIN_PASSCODE in your .env file.',
      })
      return false
    }
    if (passcode !== expected) {
      set({ formError: 'That passcode is not correct.' })
      return false
    }
    writeAdminSession(true)
    set({ adminUnlocked: true, formError: null })
    return true
  },

  lockAdmin() {
    writeAdminSession(false)
    set({ adminUnlocked: false })
  },

  dismissMessages() {
    set({ error: null, formError: null, notice: null })
  },
}))

// ---------------------------------------------------------------------------
// Pure selectors — kept outside the store so components and tests can reuse
// them without subscribing to anything.
// ---------------------------------------------------------------------------

export function selectZoneById(zones: Zone[], zoneId: string | null): Zone | null {
  if (!zoneId) return null
  return zones.find((zone) => zone.id === zoneId) ?? null
}

export function zoneNameFor(zones: Zone[], zoneId: string): string {
  return zones.find((zone) => zone.id === zoneId)?.name ?? 'That zone'
}

export function selectPendingReports(reports: Report[]): Report[] {
  return reports.filter((report) => report.status === 'pending')
}

export function selectReviewedReports(reports: Report[]): Report[] {
  return reports.filter((report) => report.status !== 'pending')
}

/** `{ zoneId: pendingCount }` — used for the map popups and the admin badges. */
export function selectPendingCountByZone(
  reports: Report[],
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const report of reports) {
    if (report.status !== 'pending') continue
    counts[report.zoneId] = (counts[report.zoneId] ?? 0) + 1
  }
  return counts
}

export function describe(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}
