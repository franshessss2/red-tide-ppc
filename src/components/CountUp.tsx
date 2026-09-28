import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION, easeOut } from '../motion/tokens'
import { useReveal } from '../motion/useReveal'

export function CountUp({ to, from = 0, duration = MOTION.time.count, decimals = 0,
  prefix = '', suffix = '', className = '', onComplete,
}: { to: number; from?: number; duration?: number; decimals?: number; prefix?: string; suffix?: string; className?: string; onComplete?: () => void }) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useReveal(ref, { threshold: 0.3 })
  const target = Number.isFinite(to) ? to : 0
  const [value, setValue] = useState(Number.isFinite(from) ? from : 0)
  const shown = useRef(value)
  const started = useRef(false)
  const completed = useRef<number | null>(null)
  const callback = useRef(onComplete)
  callback.current = onComplete
  useEffect(() => {
    if (!inView && !reduce) return
    const scope = createMotionScope()
    const startValue = shown.current
    const ms = Math.max(0, Number.isFinite(duration) ? duration : 0) * 1000
    const length = started.current ? Math.min(ms, MOTION.time.countUpdate * 1000) : ms
    started.current = true
    const finish = () => {
      shown.current = target
      setValue(target)
      if (completed.current !== target) { completed.current = target; callback.current?.() }
    }
    if (reduce || length === 0 || startValue === target) { finish(); return }
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / length))
      shown.current = startValue + (target - startValue) * easeOut(progress)
      setValue(shown.current)
      if (progress < 1) scope.frame(tick)
      else finish()
    }
    scope.frame(tick)
    return () => scope.dispose()
  }, [target, duration, inView, reduce])
  const format = (v: number) => prefix + v.toLocaleString('en-US', {
    minimumFractionDigits: Math.max(0, Math.min(20, decimals)), maximumFractionDigits: Math.max(0, Math.min(20, decimals)),
  }) + suffix
  return <span ref={ref} className={`tabular-nums ${className}`}>
    <span aria-hidden="true">{format(reduce ? target : value)}</span><span className="sr-only">{format(target)}</span>
  </span>
}
