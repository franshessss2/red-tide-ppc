import type { ReportStatus, ZoneStatus } from '../types'

/**
 * Single source of truth for status → colour/label mapping.
 *
 * The hex values are duplicated in `src/index.css` under `@theme` so Tailwind
 * utility classes (`bg-advisory`, `text-safe`, …) stay in sync visually. If you
 * change a colour here, change it there too.
 */

export interface StatusMeta {
  /** Short label for badges and legends. */
  label: string
  /** Filipino phrasing, shown alongside the English label. */
  labelTl: string
  /** Hex colour used by Leaflet (SVG needs raw hex, not a CSS class). */
  hex: string
  /** Tailwind classes for the solid badge. */
  badgeClass: string
  /** Tailwind classes for a soft/tinted badge. */
  softClass: string
  /** Plain-English guidance shown to the public. */
  guidance: string
}

export const ZONE_STATUS_META: Record<ZoneStatus, StatusMeta> = {
  unknown: {
    label: 'Status unavailable',
    labelTl: 'Hindi alam ang katayuan',
    hex: '#9e9e9e',
    badgeClass: 'bg-slate-600 text-white',
    softClass: 'bg-slate-100 text-slate-800 ring-slate-300',
    guidance: 'The community status is missing or unrecognised. Check the official BFAR bulletin before making a food-safety decision.',
  },
  safe: {
    label: 'No alert recorded',
    labelTl: 'Walang naitalang babala',
    hex: '#16a34a',
    badgeClass: 'bg-green-600 text-white',
    softClass: 'bg-green-50 text-green-800 ring-green-200',
    guidance:
      'No community warning is recorded for this zone. This is not an official clearance; check BFAR bulletins.',
  },
  unconfirmed: {
    label: 'Under review',
    labelTl: 'Sinusuri pa',
    hex: '#f59e0b',
    badgeClass: 'bg-amber-500 text-white',
    softClass: 'bg-amber-50 text-amber-900 ring-amber-200',
    guidance:
      'Community reports are being reviewed. Check BFAR guidance before gathering or eating shellfish.',
  },
  advisory: {
    label: 'Community warning',
    labelTl: 'Babala ng komunidad',
    hex: '#dc2626',
    badgeClass: 'bg-red-600 text-white',
    softClass: 'bg-red-50 text-red-800 ring-red-200',
    guidance:
      'Community warning: avoid gathering, selling or eating shellfish or alamang from this zone; check the official BFAR bulletin.',
  },
}

export const REPORT_STATUS_META: Record<ReportStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    labelTl: 'Nakabinbin',
    hex: '#f59e0b',
    badgeClass: 'bg-amber-500 text-white',
    softClass: 'bg-amber-50 text-amber-900 ring-amber-200',
    guidance: 'Waiting for an admin to review.',
  },
  confirmed: {
    label: 'Reviewed',
    labelTl: 'Nasuri',
    hex: '#dc2626',
    badgeClass: 'bg-red-600 text-white',
    softClass: 'bg-red-50 text-red-800 ring-red-200',
    guidance: 'Reviewed by an admin; the zone has a community warning. This is not laboratory confirmation.',
  },
  rejected: {
    label: 'Rejected',
    labelTl: 'Tinanggihan',
    hex: '#64748b',
    badgeClass: 'bg-slate-500 text-white',
    softClass: 'bg-slate-100 text-slate-700 ring-slate-200',
    guidance: 'Dismissed by an admin; the zone status was left unchanged.',
  },
}

/** Ordered for legends: worst first. */
export const ZONE_STATUS_ORDER: ZoneStatus[] = ['advisory', 'unconfirmed', 'unknown', 'safe']

export function zoneStatusMeta(status: ZoneStatus): StatusMeta {
  return ZONE_STATUS_META[status] ?? ZONE_STATUS_META.unknown
}

export function reportStatusMeta(status: ReportStatus): StatusMeta {
  return REPORT_STATUS_META[status] ?? REPORT_STATUS_META.pending
}
