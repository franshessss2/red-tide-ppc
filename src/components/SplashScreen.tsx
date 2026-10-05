import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Landing } from '../pages/Landing'
import { useReducedMotion } from '../motion/preferences'
import { markIntroSeen, shouldShowIntro } from './intro/introGate'
import { PhoneMock } from './intro/PhoneMock'
import { INTRO_COAST_PATH } from '../data/introCoast'
import '../styles/tide-intro.css'
import '../styles/showroom.css'

export const INTRO_EXIT_MS = 650
export const INTRO_SCENE_MS = 3600
export const INTRO_TRANSITION_MS = 600
export const INTRO_SCENE_COUNT = 4
const FEATURES = [
  { title: 'Explore coastal zones.', copy: 'Seven coastal areas. Community records in one view.', tag: '01 / EXPLORE' },
  { title: 'Report observations.', copy: 'Share what you see. Each report waits for admin review.', tag: '02 / REPORT' },
  { title: 'Review community warnings.', copy: 'Stay informed. Check BFAR bulletins for official advisories.', tag: '03 / REVIEW' },
]
type Phase = 'playing' | 'leaving' | 'done'

/** Finite showroom sequence. Every activation exits; timers never navigate. */
export function SplashScreen() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(() => shouldShowIntro() ? 'playing' : 'done')
  const [scene, setScene] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [run, setRun] = useState(0)
  const phaseRef = useRef(phase)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const replaying = useRef(false)
  const active = phase !== 'done'
  const feature = FEATURES[scene - 1]

  const dismiss = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    phaseRef.current = 'leaving'
    markIntroSeen()
    setPhase('leaving')
  }, [])

  // Pause the remaining scene time when hidden instead of returning to a
  // finished sequence after switching tabs. StrictMode owns one timer only.
  useEffect(() => {
    if (phase !== 'playing' || scene >= INTRO_SCENE_COUNT - 1 || reduce || transitioning) return
    let remaining = INTRO_SCENE_MS
    let started = performance.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      started = performance.now()
      timer = setTimeout(() => {
        if (phaseRef.current === 'playing') setTransitioning(true)
      }, remaining)
    }
    const visibility = () => {
      if (document.hidden) {
        clearTimeout(timer)
        remaining = Math.max(0, remaining - (performance.now() - started))
      } else start()
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', visibility)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [phase, scene, reduce, run, transitioning])

  // Keep the outgoing layout intact until its fade completes. Changing the
  // grid or typography while it is visible makes the title snap sideways.
  useEffect(() => {
    if (!transitioning || phase !== 'playing') return
    const timer = setTimeout(() => {
      setScene(value => Math.min(value + 1, INTRO_SCENE_COUNT - 1))
      setTransitioning(false)
    }, reduce ? 0 : INTRO_TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [transitioning, phase, reduce])

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
      className={`showroom showroom--${phase}${reduce ? ' showroom--reduced' : ''}`} data-scene={scene}
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
      <svg className="showroom-coast" viewBox="0 0 800 420" aria-hidden="true">
        <motion.path d={INTRO_COAST_PATH} fill="none" stroke="currentColor" strokeWidth="1.5"
          initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 2, ease: 'easeInOut' }} />
      </svg>
      <div className={`showroom-stage${feature && !reduce ? ' showroom-stage--feature' : ''}${transitioning ? ' showroom-stage--out' : ''}`}>
        <div className="showroom-copy">
          <div key={reduce ? 'static' : scene} className="showroom-copy-in">
            <p className="showroom-eyebrow">{feature && !reduce ? feature.tag : 'COMMUNITY COASTAL MONITORING'}</p>
            <h1>{feature && !reduce ? feature.title : 'RED TIDE'}</h1>
            <p className="showroom-description">{feature && !reduce ? feature.copy : 'Explore the coast. Share observations. Follow community warnings.'}</p>
            {reduce && <p className="showroom-disclaimer">Reports are reviewed by an admin. Check BFAR for official advisories.</p>}
          </div>
        </div>
        <div className={`showroom-device${feature && !reduce ? ' showroom-device--visible' : ''}`} aria-hidden="true">
          <PhoneMock variant={scene === 2 ? 'report' : 'zones'} persistent />
          <span className="showroom-device-caption">{scene === 2 ? 'OBSERVATION → REVIEW' : scene === 3 ? 'COMMUNITY RECORDS' : 'SEVEN COASTAL ZONES'}</span>
        </div>
      </div>
      <div className="showroom-footer" aria-hidden="true">
        <div className="showroom-progress">{Array.from({ length: INTRO_SCENE_COUNT }, (_, index) => <span key={index} className={scene >= index ? 'is-complete' : ''} />)}</div>
        <span>Click to explore <span className="showroom-enter">↵</span></span>
      </div>
      <button ref={buttonRef} type="button" className="showroom-enter-surface" aria-label="Explore Red Tide" onClick={dismiss} disabled={phase === 'leaving'} />
    </motion.div>, document.body)}
  </div>
}
