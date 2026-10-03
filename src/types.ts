/**
 * Shared domain types for Red Tide PPC.
 *
 * Timestamps are normalised to epoch milliseconds (number) at the backend
 * boundary, so components never have to know whether they are looking at a
 * Firestore `Timestamp` or a plain JS date.
 *
 * Keep this file free of DOM and Firebase imports: `scripts/seed.ts` is
 * type-checked and executed in Node, and it pulls this file in.
 */

/** A [latitude, longitude] pair, in decimal degrees (WGS84). */
export type LatLng = [number, number]

/** Stored community statuses; none establishes official laboratory clearance. */
export type KnownZoneStatus = 'safe' | 'unconfirmed' | 'advisory'
/** Read-side status also preserves absent or malformed records as unknown. */
export type ZoneStatus = KnownZoneStatus | 'unknown'

/** Lifecycle of a community report. */
export type ReportStatus = 'pending' | 'confirmed' | 'rejected'

export interface Zone {
  id: string
  name: string
  /** One-line plain-English description shown in the popup and admin list. */
  description: string
  /** Approximate coastal polygon, [lat, lng] pairs. Not a survey boundary. */
  polygon: LatLng[]
  status: ZoneStatus
  /** Epoch ms of the last status change, or null when unavailable. */
  lastUpdated: number | null
  /** An unresolved server timestamp on a locally pending write. */
  lastUpdatedPending?: boolean
}

export interface Report {
  id: string
  zoneId: string
  description: string
  /** Cloudinary secure image URL, or null when no photo was attached. */
  photoUrl: string | null
  /** Epoch ms. */
  submittedAt: number | null
  submittedAtPending?: boolean
  status: ReportStatus
}

/** Payload used when writing a brand-new report. */
export interface NewReport {
  zoneId: string
  description: string
  photoUrl: string | null
}
