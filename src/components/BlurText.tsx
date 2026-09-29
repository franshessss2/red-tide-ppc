import { Fragment, useMemo, useRef, type ElementType } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { useReveal } from '../motion/useReveal'
import { MOTION, staggerDelay, tween } from '../motion/tokens'

type BlurTextProps = {
  text: string; delay?: number; className?: string; animateBy?: 'words' | 'letters'
  direction?: 'top' | 'bottom'; threshold?: number; rootMargin?: string
  stepDuration?: number; as?: ElementType; root?: Element | null
  /** Above-the-fold copy starts on mount instead of waiting for intersection. */
  trigger?: 'view' | 'mount'
}
/** Compatible text-reveal API, rebuilt without per-glyph blur or permanent will-change. */
export function BlurText({ text, delay = MOTION.time.stagger * 1000, className = '',
  animateBy = 'words', direction = 'top', threshold = 0.2, rootMargin = '0px 0px -10% 0px',
  stepDuration = MOTION.time.reveal / 2, as: Tag = 'span', root = null, trigger = 'view',
}: BlurTextProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const revealed = useReveal(ref, { root, threshold, rootMargin, enabled: trigger === 'view' })
  const visible = trigger === 'mount' || revealed
  const segments = useMemo(() => animateBy === 'words' ? text.split(' ') : Array.from(text), [text, animateBy])
  if (reduce) return <Tag className={className}>{text}</Tag>
  return <Tag ref={ref} className={className} aria-label={text}>
    {segments.map((segment, index) => <Fragment key={`${index}-${segment}`}>
      <motion.span aria-hidden="true" initial={{ opacity: 0, y: direction === 'top' ? -8 : 8 }}
        animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: direction === 'top' ? -8 : 8 }}
        transition={tween(false, stepDuration * 2, staggerDelay(index, false, delay / 1000))}
        style={{ display: 'inline-block' }}>
        {segment === ' ' ? '\u00a0' : segment}
      </motion.span>
      {animateBy === 'words' && index < segments.length - 1 ? ' ' : null}
    </Fragment>)}
  </Tag>
}
