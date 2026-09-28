import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import { Routes, useLocation, type Location } from 'react-router-dom'
import { useReducedMotion } from './preferences'
import { MOTION } from './tokens'

export type RoutePreparation = Record<string, () => Promise<unknown>>
const DISSOLVES = new Set(['/', '/map'])
const variants: Variants = {
  exit: (enabled?: boolean) => ({ opacity: 0, transition: { duration: enabled ? MOTION.time.routeOut : 0, ease: MOTION.ease.in } }),
}

/** One mounted route. Opacity only: fixed map/modal layers never acquire a transformed ancestor. */
export function RouteTransition({ children, prepare }: { children: ReactNode; prepare?: RoutePreparation }) {
  const location = useLocation()
  const reduce = useReducedMotion()
  const [previousPath, setPreviousPath] = useState(location.pathname)
  const [origin, setOrigin] = useState(location.pathname)
  if (previousPath !== location.pathname) { setOrigin(previousPath); setPreviousPath(location.pathname) }
  const dissolve = !reduce && DISSOLVES.has(origin) && DISSOLVES.has(location.pathname)
  return <AnimatePresence mode="wait" initial={false} custom={dissolve}>
    <RouteFrame key={location.pathname} location={location} dissolve={dissolve} prepare={prepare?.[location.pathname]}>{children}</RouteFrame>
  </AnimatePresence>
}
function RouteFrame({ location, dissolve, prepare, children }: {
  location: Location; dissolve: boolean; prepare?: () => Promise<unknown>; children: ReactNode
}) {
  const [prepared, setPrepared] = useState(() => !prepare)
  useLayoutEffect(() => {
    if (!prepare) return
    let active = true
    // A failed import must reach the error boundary, never leave an invisible route forever.
    const settled = () => { if (active) setPrepared(true) }
    Promise.resolve().then(prepare).then(settled, settled)
    return () => { active = false }
  }, [prepare])
  const ready = !dissolve || prepared
  return <motion.div data-route-frame="" className="min-h-full" variants={variants}
    initial={dissolve ? { opacity: 0 } : false} animate={{ opacity: ready ? 1 : 0 }}
    transition={{ duration: dissolve ? MOTION.time.routeIn : 0, ease: MOTION.ease.out }} exit="exit">
    <ScrollToTop /><Routes location={location}>{children}</Routes>
  </motion.div>
}
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [pathname])
  return null
}
