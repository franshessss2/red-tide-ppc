import { useSyncExternalStore } from 'react'

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
/** Read synchronously so the first frame never animates against the OS preference. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches)
}
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia?.(REDUCED_MOTION_QUERY)
  if (!media) return () => {}
  if (media.addEventListener) {
    media.addEventListener('change', notify)
    return () => media.removeEventListener('change', notify)
  }
  media.addListener?.(notify)
  return () => media.removeListener?.(notify)
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribeMotion, prefersReducedMotion, () => true)
}
function subscribeVisibility(notify: () => void) {
  document.addEventListener('visibilitychange', notify)
  return () => document.removeEventListener('visibilitychange', notify)
}
export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => false)
}
