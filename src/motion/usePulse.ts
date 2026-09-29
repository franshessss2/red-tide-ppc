import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { useReducedMotion } from './preferences'
import { MOTION, tween } from './tokens'

/** One restrained pulse per changed value; cleanup restores its resting pose. */
export function usePulse<T extends HTMLElement>(trigger: unknown, amplitude = 1.16, enabled = true, duration: number = MOTION.time.pulse) {
  const ref = useRef<T>(null)
  const previous = useRef(trigger)
  const reduce = useReducedMotion()
  useEffect(() => {
    const changed = previous.current !== trigger
    previous.current = trigger
    const node = ref.current
    if (!node || !changed || !enabled || reduce) return
    const animation = animate(node, { scale: [1, amplitude, 1] }, tween(false, duration))
    return () => { animation.stop(); node.style.removeProperty('transform') }
  }, [trigger, amplitude, enabled, reduce, duration])
  return ref
}
