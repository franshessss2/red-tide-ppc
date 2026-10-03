import { useEffect, useRef } from 'react'
import { animate } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { MOTION, tween } from '../motion/tokens'
import type { ZoneStatus } from '../types'

/** Fixed symbols complement labels and the map's solid/dashed/dotted borders. */
export function ZoneStatusIcon({ status }: { status: ZoneStatus }) {
  const ref = useRef<SVGSVGElement>(null)
  const previous = useRef(status)
  const reduce = useReducedMotion()
  useEffect(() => {
    const changed = previous.current !== status
    previous.current = status
    if (!changed || reduce || !ref.current) return
    const node = ref.current
    const animation = animate(node, { opacity: [1, 0.9, 1] }, tween(false, MOTION.time.fast))
    return () => { animation.stop(); node.style.removeProperty('opacity') }
  }, [status, reduce])
  return (
    <svg ref={ref} aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {status === 'advisory' ? <><path d="M8 1.5 15 14H1Z" /><path d="M8 5v4m0 2v.5" /></>
        : status === 'unconfirmed' ? <><path d="m8 1 7 7-7 7-7-7Z" /><path d="M8 5v3l2 2" /></>
        : status === 'safe' ? <><circle cx="8" cy="8" r="6" /><path d="M5 8h6" /></>
        : <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M6 6a2 2 0 0 1 4 0c0 1-2 1-2 3m0 2v.2" /></>}
    </svg>
  )
}
