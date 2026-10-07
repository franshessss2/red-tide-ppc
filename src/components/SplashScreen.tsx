import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Landing } from '../pages/Landing'
import { useReducedMotion } from '../motion/preferences'
import { markIntroSeen, shouldShowIntro } from './intro/introGate'
import { OpeningFilm } from './intro/OpeningFilm'
import { ReelStage } from './intro/ReelStage'
import { REEL_SCENES, REEL_CLOSING_SCENE } from './intro/reelScenes'
import '../styles/showroom.css'

export const INTRO_EXIT_MS = 650
export const INTRO_SCENE_MS = REEL_SCENES[0].duration
export const INTRO_TRANSITION_MS = 450
export const INTRO_SCENE_COUNT = REEL_SCENES.length
type Phase = 'opening' | 'playing' | 'leaving' | 'done'

/** Looping showroom sequence. Every activation exits; timers never navigate. */
export function SplashScreen() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => shouldShowIntro() ? 'opening' : 'done')
  const [scene, setScene] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [run, setRun] = useState(0)
  const [hidden, setHidden] = useState(() => document.hidden)
  const phaseRef = useRef(phase)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const replaying = useRef(false)
  const active = phase !== 'done'

  const completeOpening = useCallback(() => {
    if (phaseRef.current !== 'opening') return
    phaseRef.current = 'playing'
    setPhase('playing')
  }, [])

  useEffect(() => { if (reduce) completeOpening() }, [reduce, completeOpening])

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
    let remaining = transitioning ? INTRO_TRANSITION_MS : REEL_SCENES[scene].duration
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
    if (phaseRef.current === 'playing') buttonRef.current?.focus({ preventScroll: true })
    return () => { document.body.style.overflow = previous }
  }, [active, run])

  useEffect(() => {
    if (phase === 'playing') buttonRef.current?.focus({ preventScroll: true })
  }, [phase])

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
    const nextPhase = reduce ? 'playing' : 'opening'
    phaseRef.current = nextPhase
    setScene(0)
    setTransitioning(false)
    setRun(value => value + 1)
    setPhase(nextPhase)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return <div className={`showroom-experience showroom-experience--${phase}`}>
    <div ref={pageRef} className="showroom-landing" inert={active} aria-hidden={active ? true : undefined}>
      <Landing onReplay={replay} covered={active} />
    </div>
    {active && createPortal(<motion.div key={run} role="dialog" aria-modal="true" aria-label="Introduction"
      className={`showroom showroom--${phase}${reduce ? ' showroom--reduced' : ''}${hidden ? ' showroom--paused' : ''}`} data-scene={scene}
      initial={false} animate={{ opacity: phase === 'leaving' ? 0 : 1 }}
      transition={{ duration: reduce ? 0.12 : 0.65 }}
      onKeyDown={event => {
        if (phaseRef.current === 'opening') return
        if (['Enter', ' ', 'Escape'].includes(event.key)) {
          event.preventDefault()
          if (!event.repeat) dismiss()
        }
        if (event.key === 'Tab') { event.preventDefault(); buttonRef.current?.focus() }
      }}>
      {phase === 'opening' && !reduce && <OpeningFilm onComplete={completeOpening} />}
      {phase !== 'opening' && <div key="showroom">
      <div className="showroom-top">PUERTO PRINCESA <span>/</span> PALAWAN <span className="showroom-prototype">SCHOOL PROTOTYPE</span></div>
      <div className="reel-ambient" aria-hidden="true"><span /><span /></div>
      {(transitioning && !reduce ? [scene, (scene + 1) % INTRO_SCENE_COUNT] : [scene]).map(index => <div key={index}
        className={`showroom-stage${transitioning && !reduce ? index === scene ? ' showroom-stage--out' : ' showroom-stage--incoming' : ''}`}
        aria-hidden={index !== scene ? true : undefined}>
        <ReelStage scene={index} reduced={reduce} />
      </div>)}
      <div className="showroom-footer" aria-hidden="true">
        <div className="showroom-progress-group"><span className="showroom-chapter">{String((reduce ? REEL_CLOSING_SCENE : scene) + 1).padStart(2, '0')} / {String(INTRO_SCENE_COUNT).padStart(2, '0')} · {REEL_SCENES[reduce ? REEL_CLOSING_SCENE : scene].chapter}</span><div className="showroom-progress">{Array.from({ length: INTRO_SCENE_COUNT }, (_, index) => <span key={index} className={(reduce ? REEL_CLOSING_SCENE : scene) >= index ? 'is-complete' : ''} />)}</div></div>
        <span><span className="showroom-hint-mouse">Click anywhere to explore</span><span className="showroom-hint-touch">Tap to explore</span> <span className="showroom-enter">↵</span></span>
      </div>
      <button ref={buttonRef} type="button" className="showroom-enter-surface" aria-label="Explore Red Tide" onClick={dismiss} disabled={phase !== 'playing'} />
      </div>}
    </motion.div>, document.body)}
  </div>
}
