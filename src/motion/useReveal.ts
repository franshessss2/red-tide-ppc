import { useEffect, useRef, useState, type RefObject } from 'react'
import { useReducedMotion } from './preferences'
import { createMotionScope } from './scope'
import { MOTION } from './tokens'

/** Once-only reveal, shared by text and drawer cards. Closing cancels observation and pending reveals. */
export function useReveal<T extends HTMLElement>(ref: RefObject<T | null>, {
  enabled = true, root = null, threshold = 0.2, rootMargin = '0px 0px -10% 0px',
}: { enabled?: boolean; root?: Element | null; threshold?: number; rootMargin?: string } = {}) {
  const reduce = useReducedMotion()
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  const seenRef = useRef(seen)
  useEffect(() => {
    if (!enabled || seenRef.current || reduce) return
    const node = ref.current
    if (!node) return
    const scope = createMotionScope()
    let responded = false
    let observer: IntersectionObserver | undefined
    const reveal = scope.guard(() => { seenRef.current = true; setSeen(true); observer?.disconnect(); scope.dispose() })
    const onScreen = () => {
      if (responded || !scope.active) return
      const r = node.getBoundingClientRect()
      const box = root?.getBoundingClientRect() ?? { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth }
      if (r.width > 0 && r.height > 0 && r.top < box.bottom && r.bottom > box.top && r.left < box.right && r.right > box.left) reveal()
    }
    try {
      if (typeof IntersectionObserver === 'undefined') { reveal(); return }
      observer = new IntersectionObserver(scope.guard(entries => {
        responded = true
        if (entries.some(entry => entry.isIntersecting)) reveal()
      }), { root, threshold, rootMargin })
      observer.observe(node)
      scope.own(() => observer?.disconnect())
      scope.timeout(() => {
        if (responded) return
        onScreen()
        // No perpetual polling for off-screen blocks when an observer is broken.
        if (!scope.active) return
        const scrollTarget = root ?? window
        scrollTarget.addEventListener('scroll', onScreen, { passive: true })
        window.addEventListener('resize', onScreen)
        scope.own(() => { scrollTarget.removeEventListener('scroll', onScreen); window.removeEventListener('resize', onScreen) })
      }, MOTION.time.observerFallback * 1000)
    } catch { reveal() }
    return () => scope.dispose()
  }, [enabled, root, threshold, rootMargin, reduce, ref])
  return reduce || seen
}
