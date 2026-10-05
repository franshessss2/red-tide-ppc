import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Landing } from '../pages/Landing'
import { useReducedMotion } from '../motion/preferences'
import { markIntroSeen, shouldShowIntro } from './intro/introGate'
import { ReelStage } from './intro/ReelStage'
import '../styles/showroom.css'

export const INTRO_EXIT_MS = 650
export const INTRO_SCENE_MS = 3000
export const INTRO_TRANSITION_MS = 600
export const INTRO_SCENE_COUNT = 5
type Phase = 'playing' | 'leaving' | 'done'

/** Looping showroom sequence. Every activation exits; timers never navigate. */
export function SplashScreen() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => shouldShowIntro() ? 'playing' : 'done')
  const [scene, setScene] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [run, setRun] = useState(0)
  const [hidden, setHidden] = useState(() => document.hidden)
  const phaseRef = useRef(phase)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const replaying = useRef(false)
  const active = phase !== 'done'

  const dismiss = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'leaving'
    markIntroSeen()
    setPhase('leaving')
  }, [])

  useEffect(() => {
    if (!active) return
    const visibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [active])

  // One visible-time clock owns both the reading interval and fade. Hidden
  // tabs pause either phase; replay, dismissal and StrictMode clean it up.
  useEffect(() => {
    if (phase !== 'playing' || reduce) return
    let remaining = transitioning ? INTRO_TRANSITION_MS : INTRO_SCENE_MS
    let started = performance.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      started = performance.now()
      timer = setTimeout(() => {
        if (phaseRef.current !== 'playing') return
        if (transitioning) {
          setScene(value => (value + 1) % INTRO_SCENE_COUNT)
          setTransitioning(false)
        } else setTransitioning(true)
      }, remaining)
    }
    const visibility = () => {
      clearTimeout(timer)
      if (document.hidden) remaining = Math.max(0, remaining - (performance.now() - started))
      else start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', visibility)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [phase, scene, reduce, run, transitioning])

  useEffect(() => {
    if (reduce) setTransitioning(false)
  }, [reduce])

  useEffect(() => {
    if (phase !== 'leaving') return
    const timer = setTimeout(() => {
      phaseRef.current = 'done'
      setPhase('done')
    }, reduce ? 120 : INTRO_EXIT_MS)
    return () => clearTimeout(timer)
  }, [phase, reduce])

  useEffect(() => {
    if (!active) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    buttonRef.current?.focus({ preventScroll: true })
    return () => { document.body.style.overflow = previous }
  }, [active, run])

  const wasActive = useRef(active)
  useEffect(() => {
    if (!active && wasActive.current) {
      pageRef.current?.querySelector<HTMLElement>(replaying.current ? '[data-intro-replay]' : '.landing-map-cta')?.focus({ preventScroll: true })
      replaying.current = false
    }
    wasActive.current = active
  }, [active])

  const replay = () => {
    replaying.current = true
    phaseRef.current = 'playing'
    setScene(0)
    setTransitioning(false)
    setRun(value => value + 1)
    setPhase('playing')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return <div className={`showroom-experience showroom-experience--${phase}`}>
    <div ref={pageRef} className="showroom-landing" inert={active} aria-hidden={active ? true : undefined}>
      <Landing onReplay={replay} />
    </div>
    {active && createPortal(<motion.div key={run} role="dialog" aria-modal="true" aria-label="Introduction"
      className={`showroom showroom--${phase}${reduce ? ' showroom--reduced' : ''}${hidden ? ' showroom--paused' : ''}`} data-scene={scene}
      initial={false} animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
      transition={{ duration: reduce ? 0.12 : 0.65 }}
      onKeyDown={event => {
        if (['Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault()
          if (!event.repeat) dismiss()
        }
        if (event.key === 'Tab') { event.preventDefault(); buttonRef.current?.focus() }
      }}>
      <div className="showroom-top">PUERTO PRINCESA <span>/</span> PALAWAN <span className="showroom-prototype">SCHOOL PROTOTYPE</span></div>
      <div className="reel-ambient" aria-hidden="true"><span /><span /></div>
      <div className={`showroom-stage${transitioning && !reduce ? ' showroom-stage--out' : ''}`}>
        <ReelStage scene={scene} reduced={reduce} />
      </div>
      <div className="showroom-footer" aria-hidden="true">
        <div className="showroom-progress">{Array.from({ length: INTRO_SCENE_COUNT }, (_, index) => <span key={index} className={scene >= index ? 'is-complete' : ''} />)}</div>
        <span>Click anywhere to explore <span className="showroom-enter">↵</span></span>
      </div>
      <button ref={buttonRef} type="button" className="showroom-enter-surface" aria-label="Explore Red Tide" onClick={dismiss} disabled={phase === 'leaving'} />
    </motion.div>, document.body)}
  </div>
}
