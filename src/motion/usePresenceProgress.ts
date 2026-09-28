import { useEffect, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { useReducedMotion } from './preferences'
import { createMotionScope } from './scope'
import { MOTION, tween } from './tokens'

/** Reversible fade for renderers outside Motion (Leaflet). No unmount timer:
 * only the current animation's completion can release the mounted layer. */
export function usePresenceProgress(open: boolean) {
  const reduce = useReducedMotion()
  const value = useRef(open ? 1 : 0)
  const [progress, setProgress] = useState(value.current)
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    const scope = createMotionScope()
    const update = scope.guard((next: number) => { value.current = next; setProgress(next) })
    if (open) setMounted(true)
    if (reduce) { update(open ? 1 : 0); setMounted(open) }
    else {
      const animation = animate(value.current, open ? 1 : 0, {
        ...tween(false, open ? MOTION.time.base : MOTION.time.exit),
        onUpdate: update,
        onComplete: scope.guard(() => { if (!open) setMounted(false) }),
      })
      scope.own(() => animation.stop())
    }
    return () => scope.dispose()
  }, [open, reduce])
  return { mounted: open || mounted, progress: reduce ? (open ? 1 : 0) : progress }
}
