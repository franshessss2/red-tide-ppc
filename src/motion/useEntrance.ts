import { useEffect, useRef, type RefObject } from 'react'
import { useAnimationControls } from 'motion/react'
import { useReducedMotion } from './preferences'
import { useReveal } from './useReveal'
import { MOTION, tween } from './tokens'

/** Closing a surface cancels pending child staggers before its spring exits. */
export function useEntrance(ref: RefObject<HTMLElement | null>, enabled: boolean, root: Element | null, delay = 0) {
  const reduce = useReducedMotion()
  const visible = useReveal(ref, { enabled, root, threshold: 0.15 })
  const controls = useAnimationControls()
  const wasEnabled = useRef(enabled)
  useEffect(() => {
    controls.stop()
    const closing = wasEnabled.current && !enabled
    wasEnabled.current = enabled
    if (!enabled) {
      const hidden = { opacity: 0, y: reduce ? 0 : 8 }
      if (closing && !reduce) void controls.start({ ...hidden, transition: tween(false, MOTION.time.exit) })
      else controls.set(hidden)
    }
    else if (reduce) controls.set({ opacity: 1, y: 0 })
    else if (visible) void controls.start({ opacity: 1, y: 0, transition: tween(false, MOTION.time.reveal, delay) })
    else controls.set({ opacity: 0, y: 8 })
    return () => controls.stop()
  }, [controls, enabled, reduce, visible, delay])
  return controls
}
