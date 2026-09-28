import { MOTION, staggerDelay } from './tokens'

export const APP_SPRING = MOTION.spring
export const ZONE_LOAD_DURATION_MS = MOTION.time.reveal * 1000
export const ZONE_LOAD_STAGGER_MS = MOTION.time.stagger * 1000
export const FOCUS_FLIGHT_SECONDS = MOTION.time.camera
export const ADVISORY_PULSE_SECONDS = MOTION.time.advisoryLoop
export const zoneLoadDelayMs = (index: number) => staggerDelay(Math.floor(index)) * 1000

/** Padding (px) applied around a focused zone's flyToBounds. */
export interface FocusPadding {
  paddingTopLeft: [number, number]
  paddingBottomRight: [number, number]
}

/**
 * Right-hand reserve (px) for the open zone drawer on desktop: panel
 * (`min(100vw - 5rem, 23.75rem)` → 380px) + tab (44px) + column margins.
 */
export const DRAWER_RESERVE_OPEN = 420

/** Right-hand reserve when the drawer is collapsed: tab + margins only. */
export const DRAWER_RESERVE_COLLAPSED = 64

/** The drawer breakpoint, mirrored from `MapPage.initialZoneDrawerState`. */
export const DRAWER_BREAKPOINT_PX = 768

/**
 * Padding so a focused zone clears the floating chrome.
 *
 * There is no bottom sheet anymore — the drawers own the right edge instead —
 * so the reservation is horizontal at ≥768px (the drawer panel) and only the
 * header/pills strip on top plus the attribution pill at the bottom on every
 * width. The reservation is passed in (MapPage knows the drawer state); this
 * function just turns it into Leaflet's padding shape.
 */
export function focusPaddingFor(
  mapWidthPx: number,
  reserveRightPx: number,
): FocusPadding {
  const width = Number.isFinite(mapWidthPx) && mapWidthPx > 0 ? mapWidthPx : 0
  const reserve =
    Number.isFinite(reserveRightPx) && reserveRightPx > 0 ? reserveRightPx : 0

  // Top: header (~56px) + the fixed pills row; bottom: the OSM credit pill.
  const TOP_CLEARANCE = 72
  const BOTTOM_CLEARANCE = 56

  if (width < DRAWER_BREAKPOINT_PX) {
    // Phone: the drawer tucks itself when a zone is focused (see MapPage),
    // so nothing overlaps the map — small symmetric gutters only.
    return {
      paddingTopLeft: [16, TOP_CLEARANCE],
      paddingBottomRight: [16, BOTTOM_CLEARANCE],
    }
  }

  return {
    paddingTopLeft: [24, TOP_CLEARANCE],
    paddingBottomRight: [24 + reserve, BOTTOM_CLEARANCE],
  }
}
