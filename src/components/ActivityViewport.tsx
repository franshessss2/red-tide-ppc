import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { MOTION, tween } from '../motion/tokens'

/** One interactive scene at a time; resize the window without scaling its text. */
export function ActivityViewport({ sceneKey, direction, children, onEntered }: {
  sceneKey: string; direction: number; children: ReactNode; onEntered: () => void
}) {
  const reduce = useReducedMotion()
  const measure = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  useLayoutEffect(() => {
    const node = measure.current
    if (reduce || !node || typeof ResizeObserver === 'undefined') { setHeight('auto'); return }
    const update = () => setHeight(node.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [reduce])
  return <motion.div className="report-activity-viewport" animate={{ height: reduce ? 'auto' : height }} transition={tween(reduce, MOTION.time.base)}>
    <div ref={measure} className="report-activity-measure">
      {reduce ? <div key={sceneKey} data-activity-scene={sceneKey}>{children}</div> :
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <ActivityScene key={sceneKey} direction={direction} onEntered={onEntered}>{children}</ActivityScene>
        </AnimatePresence>}
    </div>
  </motion.div>
}

function ActivityScene({ direction, children, onEntered }: { direction: number; children: ReactNode; onEntered: () => void }) {
  const present = useIsPresent()
  return <motion.div data-activity-scene="animated" inert={!present} aria-hidden={!present || undefined}
    custom={direction} initial={{ opacity: 0, x: direction * 10, y: 4 }}
    animate={{ opacity: 1, x: 0, y: 0, transition: tween(false, MOTION.time.base) }}
    variants={{ leave: (latestDirection: number) => ({ opacity: 0, x: -latestDirection * 6, y: 0, transition: tween(false, MOTION.time.fast) }) }} exit="leave"
    onAnimationComplete={() => { if (present) onEntered() }}>
    {children}
  </motion.div>
}
