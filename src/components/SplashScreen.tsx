import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Landing } from '../pages/Landing'
import { useReducedMotion, prefersReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import '../styles/tide-intro.css'

const SEEN_KEY = 'red-tide:intro:v1'
export const INTRO_HOLD_MS = MOTION.time.introHold * 1000
export const INTRO_EXIT_MS = MOTION.time.introExit * 1000

type Phase = 'playing' | 'leaving' | 'done'

function initialPhase(): Phase {
  if (prefersReducedMotion() || window.location.hash) return 'done'
  try { if (sessionStorage.getItem(SEEN_KEY)) return 'done' } catch { /* Storage is optional. */ }
  return 'playing'
}

/** A finite brand entrance. Data fetching never controls its duration. */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const skipRef = useRef<HTMLButtonElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const replaying = useRef(false)
  const active = phase !== 'done' && !reduce

  const finish = useCallback(() => {
    try { sessionStorage.setItem(SEEN_KEY, 'seen') } catch { /* Private browsing still works. */ }
    setPhase('done')
  }, [])

  useEffect(() => {
    if (reduce) finish()
  }, [reduce, finish])

  useEffect(() => {
    if (!active) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    skipRef.current?.focus({ preventScroll: true })
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish() }
      // Only the skip control is reachable while the underlying page is inert.
      if (event.key === 'Tab') { event.preventDefault(); skipRef.current?.focus() }
    }
    const visibility = () => { if (document.hidden) finish() }
    window.addEventListener('keydown', keydown)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.body.style.overflow = oldOverflow
      window.removeEventListener('keydown', keydown)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [active, finish])

  useEffect(() => {
    if (phase !== 'playing' || reduce) return
    const scope = createMotionScope()
    scope.timeout(() => setPhase('leaving'), INTRO_HOLD_MS)
    return () => scope.dispose()
  }, [phase, run, reduce])

  useEffect(() => {
    if (phase !== 'leaving' || reduce) return
    const scope = createMotionScope()
    const title = titleRef.current
    const destination = pageRef.current?.querySelector<HTMLElement>('h1[aria-label="Red Tide"]')
    let animation: Animation | undefined
    if (title && destination) {
      const from = title.getBoundingClientRect()
      const to = destination.getBoundingClientRect()
      const scale = parseFloat(getComputedStyle(destination).fontSize) / parseFloat(getComputedStyle(title).fontSize)
      // Match the actual responsive headline, not a hard-coded screen position.
      animation = title.animate?.([
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${scale})` },
      ], { duration: INTRO_EXIT_MS, easing: `cubic-bezier(${MOTION.ease.tide.join(',')})`, fill: 'forwards' })
    }
    scope.timeout(finish, INTRO_EXIT_MS)
    // A resized viewport cannot leave the wordmark at a stale destination.
    window.addEventListener('resize', finish, { once: true })
    return () => {
      scope.dispose()
      animation?.cancel()
      window.removeEventListener('resize', finish)
    }
  }, [phase, finish, reduce])

  const wasActive = useRef(active)
  useEffect(() => {
    if (!active && wasActive.current) {
      const target = replaying.current ? replayRef.current : pageRef.current?.querySelector<HTMLElement>('.landing-map-cta')
      target?.focus({ preventScroll: true })
      replaying.current = false
    }
    wasActive.current = active
  }, [active])

  function replay() {
    if (prefersReducedMotion()) return
    replaying.current = true
    window.scrollTo({ top: 0, behavior: 'instant' })
    setRun(value => value + 1)
    setPhase('playing')
  }

  return (
    <div className={`tide-experience tide-experience--${phase}`}>
      <div ref={pageRef} inert={active} aria-hidden={active ? true : undefined}>
        <Landing />
        <div className="tide-replay-wrap">
          <button ref={replayRef} className="tide-replay" onClick={replay} disabled={reduce}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M4 6a7 7 0 1 1-1 7M4 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {reduce ? 'Intro motion off' : 'Replay intro'}
          </button>
        </div>
      </div>
      {active && createPortal(
        <div key={run} className={`tide-intro tide-intro--${phase}`} role="dialog" aria-modal="true" aria-labelledby="tide-intro-label">
          <div className="tide-intro__curtain" aria-hidden="true">
            <div className="tide-intro__light" />
            <div className="tide-intro__water">
              <svg viewBox="0 0 1600 640" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tide-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff5252" stopOpacity=".48"/><stop offset=".3" stopColor="#8c2424" stopOpacity=".28"/><stop offset="1" stopColor="#0a0a0a" stopOpacity="0"/></linearGradient>
                  <linearGradient id="tide-edge"><stop stopColor="#ff5252" stopOpacity="0"/><stop offset=".45" stopColor="#ff7770"/><stop offset=".8" stopColor="#f0a500" stopOpacity=".5"/><stop offset="1" stopColor="#ff5252" stopOpacity="0"/></linearGradient>
                </defs>
                <path className="tide-intro__body" d="M-100 215C230 50 440 360 810 205S1310 35 1710 180V740H-100Z" fill="url(#tide-fill)"/>
                <g fill="none" stroke="url(#tide-edge)" strokeWidth="1.2">
                  <path d="M-100 215C230 50 440 360 810 205S1310 35 1710 180"/>
                  <path opacity=".48" d="M-100 235C230 70 440 380 810 225S1310 55 1710 200"/>
                  <path opacity=".25" d="M-100 264C230 99 440 409 810 254S1310 84 1710 229"/>
                  <path opacity=".12" d="M-100 300C230 135 440 445 810 290S1310 120 1710 265"/>
                </g>
              </svg>
            </div>
            <div className="tide-intro__horizon" />
          </div>
          <div className="tide-intro__top tide-intro__chrome">
            <span className="tide-intro__location">PUERTO PRINCESA <span>/</span> PALAWAN</span>
            <button ref={skipRef} className="tide-intro__skip" onClick={finish}>Skip intro <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          </div>
          <div className="tide-intro__center">
            <p className="tide-intro__eyebrow tide-intro__chrome">COMMUNITY EARLY WARNING</p>
            <div ref={titleRef} id="tide-intro-label" className="tide-intro__title" aria-label="Red Tide"><span>RED TIDE</span></div>
            <p className="tide-intro__line tide-intro__chrome">One coast. A shared watch.</p>
          </div>
          <div className="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
