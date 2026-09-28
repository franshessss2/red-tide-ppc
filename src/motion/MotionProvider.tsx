import { useLayoutEffect, type ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { usePageVisible, useReducedMotion } from './preferences'
import { motionCSSVariables, tween } from './tokens'
import '../styles/motion-policy.css'

export function MotionProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  const visible = usePageVisible()
  useLayoutEffect(() => {
    const root = document.documentElement
    for (const [name, value] of Object.entries(motionCSSVariables)) root.style.setProperty(name, value)
    root.dataset.motion = reduce ? 'reduced' : 'full'
    root.dataset.motionPaused = String(!visible)
    return () => {
      for (const name of Object.keys(motionCSSVariables)) root.style.removeProperty(name)
      delete root.dataset.motion
      delete root.dataset.motionPaused
    }
  }, [reduce, visible])
  return <MotionConfig reducedMotion={reduce ? 'always' : 'never'} transition={tween(reduce)}>{children}</MotionConfig>
}
