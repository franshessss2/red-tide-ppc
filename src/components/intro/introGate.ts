
/**
 * First-visit gate for the finite showroom intro.
 *
 * All gate logic lives here so the storage policy is a one-constant change:
 * PR57 gated per tab via `sessionStorage` ('red-tide-ppc:splash:v1'); PR59
 * gates per device per intro version via `localStorage`. To revert to
 * per-tab gating, point `INTRO_STORAGE_AREA` back at 'sessionStorage'.
 *
 * The gate FAILS OPEN: if storage cannot be read, the intro is skipped and
 * the visitor lands directly on the content. A broken intro must never stand
 * between someone and the map.
 */
export const INTRO_SEEN_KEY = 'red-tide-ppc:intro:v3'

/** The one constant to change when reverting to per-tab (session) gating. */
const INTRO_STORAGE_AREA: 'localStorage' | 'sessionStorage' = 'localStorage'

function storage(): Storage {
  return window[INTRO_STORAGE_AREA]
}

/** True when this device has already seen the intro — or when storage is unreadable (fail open). */
export function hasSeenIntro(): boolean {
  try {
    return storage().getItem(INTRO_SEEN_KEY) !== null
  } catch {
    return true
  }
}

/** Called on exit. Private browsing may refuse the write; the app continues. */
export function markIntroSeen(): void {
  try {
    storage().setItem(INTRO_SEEN_KEY, 'seen')
  } catch { /* Fail open: the intro simply shows again next time. */ }
}

/**
 * `?intro=1` forces the intro once without clearing storage — the same
 * contract as the existing header intro control.
 */
export function introReplayRequested(search: string = window.location.search): boolean {
  try {
    return new URLSearchParams(search).get('intro') === '1'
  } catch {
    return false
  }
}

/**
 * The intro renders only when:
 *  - the pathname is exactly "/" (never on /map or /admin),
 *  - there is no deep-link hash (PR57 behavior, preserved),
 *  - and the seen key is absent — or a replay was explicitly requested.
 */
export function shouldShowIntro(
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): boolean {
  if (location.pathname !== '/') return false
  if (location.hash) return false
  if (introReplayRequested(location.search)) return true
  return !hasSeenIntro()
}
