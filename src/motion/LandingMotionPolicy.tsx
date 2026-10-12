import { createContext, useContext, useSyncExternalStore } from 'react'
import { useReducedMotion } from './preferences'

type Connection = EventTarget & { saveData?: boolean }
function connection(): Connection | undefined {
  return typeof navigator === 'undefined' ? undefined
    : (navigator as Navigator & { connection?: Connection }).connection
}
function subscribe(notify: () => void) {
  const network = connection()
  network?.addEventListener?.('change', notify)
  return () => network?.removeEventListener?.('change', notify)
}
export function useSaveData() {
  return useSyncExternalStore(subscribe, () => Boolean(connection()?.saveData), () => true)
}

// Only Landing provides this override. The intro reel's TextReveal remains
// outside the provider and keeps its existing timing and behavior.
export const LandingMotionPolicy = createContext(false)
export function useDecorativeMotionDisabled() {
  const reduced = useReducedMotion()
  const saveData = useContext(LandingMotionPolicy)
  return reduced || saveData
}
