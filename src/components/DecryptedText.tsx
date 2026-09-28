import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import { isBelowSm } from '../lib/breakpoints'

const GLYPHS = '!<>-_/[{}]=+*^?#01·'
const scramble = (text: string) => Array.from(text).map(c => c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('')
/** One bounded reveal per text; replacement text cannot inherit a completed run. */
export function DecryptedText({ text, delay = 0, className = '', onComplete }: {
  text: string; delay?: number; className?: string; onComplete?: () => void
}) {
  const reduce = useReducedMotion()
  const skip = reduce || isBelowSm()
  const [display, setDisplay] = useState(() => skip ? text : scramble(text))
  const complete = useRef<string | null>(null)
  const callback = useRef(onComplete)
  callback.current = onComplete
  useEffect(() => {
    const scope = createMotionScope()
    const finish = () => { setDisplay(text); if (complete.current !== text) { complete.current = text; callback.current?.() } }
    if (skip || complete.current === text) { finish(); return }
    setDisplay(scramble(text))
    scope.timeout(() => {
      const start = performance.now()
      let painted = -Infinity
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / (MOTION.time.reveal * 1000))
        if (progress >= 1) { finish(); return }
        if (now - painted >= 33) {
          painted = now
          const locked = Math.floor(progress * text.length)
          setDisplay(Array.from(text).map((c, i) => i < locked || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join(''))
        }
        scope.frame(tick)
      }
      scope.frame(tick)
    }, Math.max(0, delay))
    return () => scope.dispose()
  }, [text, delay, skip])
  return <span className={`relative inline-block ${className}`} aria-label={text}>
    <span aria-hidden="true" className="invisible">{text}</span>
    <span aria-hidden="true" className="absolute inset-0">{skip ? text : display}</span>
  </span>
}
