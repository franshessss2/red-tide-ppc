import { Fragment, useRef, type ElementType } from 'react'
import { motion } from 'motion/react'
import { useReducedMotion } from '../motion/preferences'
import { useReveal } from '../motion/useReveal'

// Portable enter contracts from pixel-point/animate-text. Existing scene
// crossfades own exits; ordinary headings reveal once, never loop or swap.
const effects = {
  words: { duration: 0.7, stagger: 0.07, ease: [0.16, 1, 0.3, 1] as const, from: { opacity: 0, y: 8 } },
  micro: { duration: 0.6, stagger: 0, ease: [0.32, 0.72, 0, 1] as const, from: { opacity: 0, scale: 0.96 } },
}

export function TextReveal({ text, as: Tag = 'span', className = '', effect = 'micro', trigger = 'view' }: {
  text: string; as?: ElementType; className?: string
  effect?: keyof typeof effects; trigger?: 'view' | 'mount'
}) {
  const ref = useRef<HTMLElement>(null)
  const reduce = useReducedMotion()
  const seen = useReveal(ref, { enabled: trigger === 'view', rootMargin: '0px' })
  const visible = trigger === 'mount' || seen
  const recipe = effects[effect]
  const parts = effect === 'words' ? text.split(' ') : [text]
  if (reduce) return <Tag className={className}>{text}</Tag>
  return <Tag ref={ref} className={className} aria-label={text}>
    {parts.map((part, index) => <Fragment key={index}>
      <motion.span aria-hidden="true" style={{ display: 'inline-block', transformOrigin: 'center' }}
        initial={recipe.from} animate={visible ? { opacity: 1, y: 0, scale: 1 } : recipe.from}
        transition={{ duration: recipe.duration, delay: index * recipe.stagger, ease: recipe.ease }}>
        {part}
      </motion.span>{index < parts.length - 1 ? ' ' : null}
    </Fragment>)}
  </Tag>
}
