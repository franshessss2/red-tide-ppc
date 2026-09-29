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
  const overlayRef = useRef<HTMLDivElement>(null)
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
    const heading = pageRef.current?.querySelector<HTMLElement>('h1[aria-label="Red Tide"]')
    // Measure the text's own box, not the full-width h1 container.
    const destination = heading?.querySelector<HTMLElement>('[aria-label="RED TIDE"]') ?? heading
    const overlay = overlayRef.current
    let animation: Animation | undefined
    let hidingTwin = false
    const previousVisibility = heading?.style.visibility ?? ''
    // Do not wait for fonts: if metrics are unstable, dissolve on the same deadline.
    const fontsReady = !document.fonts || document.fonts.status === 'loaded'
    if (title && destination && heading && fontsReady && typeof title.animate === 'function') {
      const from = title.getBoundingClientRect()
      const to = destination.getBoundingClientRect()
      if (from.width > 0 && from.height > 0 && to.width > 0 && to.height > 0) {
        try {
          animation = title.animate([
            { transform: 'translate(0, 0) scale(1, 1)' },
            { transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})` },
          ], { duration: INTRO_EXIT_MS, easing: `cubic-bezier(${MOTION.ease.tide.join(',')})`, fill: 'forwards' })
          heading.style.visibility = 'hidden'
          hidingTwin = true
          overlay?.setAttribute('data-handoff', 'measured')
        } catch { /* Unsupported animation implementations use the dissolve. */ }
      }
    }
    if (!hidingTwin) overlay?.setAttribute('data-handoff', 'fade')
    scope.timeout(finish, INTRO_EXIT_MS)
    // A resized viewport cannot leave the wordmark at a stale destination.
    window.addEventListener('resize', finish, { once: true })
    return () => {
      scope.dispose()
      animation?.cancel()
      if (hidingTwin && heading) heading.style.visibility = previousVisibility
      overlay?.removeAttribute('data-handoff')
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
        <div ref={overlayRef} key={run} className={`tide-intro tide-intro--${phase}`} role="dialog" aria-modal="true" aria-labelledby="tide-intro-label">
          <div className="tide-intro__curtain" aria-hidden="true">
            <svg className="tide-intro__curtain-edge" viewBox="0 0 1600 160" preserveAspectRatio="none">
              <path d="M0 82C320 150 540 10 820 62S1290 150 1600 50V160H0Z" fill="currentColor" />
            </svg>
            <div className="tide-intro__light" />
          </div>
          <div className="tide-intro__top tide-intro__chrome">
            <span className="tide-intro__location">PUERTO PRINCESA <span>/</span> PALAWAN</span>
            <button ref={skipRef} className="tide-intro__skip" onClick={finish}>Skip intro <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
          </div>
          <div className="tide-intro__center">
            <div className="tide-intro__surface" aria-hidden="true">
              <div className="tide-intro__horizon" />
              <div className="tide-intro__ripple"><span /></div>
              <svg className="tide-intro__water" viewBox="0 0 1600 400" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="first-ripple-fill" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ff5252" stopOpacity=".09"/><stop offset="1" stopColor="#0a0a0a" stopOpacity="0"/></linearGradient>
                  <linearGradient id="first-ripple-edge"><stop stopColor="#f0a500" stopOpacity="0"/><stop offset=".48" stopColor="#f0a500" stopOpacity=".7"/><stop offset=".72" stopColor="#ff5252" stopOpacity=".38"/><stop offset="1" stopColor="#ff5252" stopOpacity="0"/></linearGradient>
                </defs>
                <path d="M0 0C320 68 540 -72 820 -20S1290 68 1600 -32V400H0Z" fill="url(#first-ripple-fill)" />
                <path d="M0 0C320 68 540 -72 820 -20S1290 68 1600 -32" fill="none" stroke="url(#first-ripple-edge)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
            <div className="tide-intro__title-clip">
              <div ref={titleRef} id="tide-intro-label" className="tide-intro__title" aria-label="Red Tide"><span aria-hidden="true">RED TIDE</span></div>
            </div>
            <div className="tide-intro__copy tide-intro__chrome">
              <p className="tide-intro__eyebrow">COMMUNITY EARLY WARNING</p>
              <p className="tide-intro__line">One coast. A shared watch.</p>
            </div>
          </div>
          <div className="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
