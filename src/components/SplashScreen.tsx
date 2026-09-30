import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, AnimationEvent } from 'react'
import { createPortal } from 'react-dom'
import { Landing } from '../pages/Landing'
import { useReducedMotion, prefersReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import '../styles/tide-intro.css'

const SEEN_KEY = 'red-tide-ppc:splash:v1'
export const INTRO_EXIT_MS = MOTION.time.introExit * 1000
export const INTRO_TITLE_HANDOFF_MS = 700
export const INTRO_TITLE_HANDOFF_DELAY_MS = 80

type Phase = 'entrance' | 'idle' | 'leaving' | 'done'

function initialPhase(): Phase {
  if (prefersReducedMotion() || window.location.hash) return 'done'
  try { if (sessionStorage.getItem(SEEN_KEY)) return 'done' } catch { /* Storage is optional. */ }
  return 'playing'
}

/** Brand entrance -> looping idle -> explicit user-driven exit. Data fetching never controls it. */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const replaying = useRef(false)
  const dismissedRef = useRef(false)
  const phaseRef = useRef<Phase>(phase)
  const active = phase !== 'done' && !reduce

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const finish = useCallback(() => {
    phaseRef.current = 'done'
    try { sessionStorage.setItem(SEEN_KEY, 'seen') } catch { /* Private browsing still works. */ }
    setPhase('done')
  }, [])

  const dismiss = useCallback(() => {
    if (dismissedRef.current || phaseRef.current === 'leaving' || phaseRef.current === 'done') return
    dismissedRef.current = true
    overlayRef.current?.classList.remove('tide-intro--hidden')
    try { sessionStorage.setItem(SEEN_KEY, 'seen') } catch { /* Private browsing still works. */ }
    phaseRef.current = 'leaving'
    setPhase('leaving')
  }, [])

  const handleEntranceComplete = useCallback((event: AnimationEvent<HTMLParagraphElement>) => {
    if (event.animationName !== 'tide-copy-in') return
    setPhase((current) => {
      if (current !== 'entrance') return current
      phaseRef.current = 'idle'
      return 'idle'
    })
  }, [])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (!['Enter', 'Escape', ' ', 'Spacebar'].includes(event.key)) return
    event.preventDefault()
    dismiss()
  }, [dismiss])

  const handlePointerUp = useCallback((_event: PointerEvent<HTMLDivElement>) => {
    dismiss()
  }, [dismiss])

  useEffect(() => {
    if (reduce) finish()
  }, [reduce, finish])

  useEffect(() => {
    if (!active) return
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    overlayRef.current?.focus({ preventScroll: true })
    const visibility = () => {
      overlay?.classList.toggle('tide-intro--hidden', document.hidden)
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    return () => {
      document.body.style.overflow = oldOverflow
      overlay?.classList.remove('tide-intro--hidden')
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [active, finish])

  useEffect(() => {
    if (phase !== 'leaving' || reduce) return
    const scope = createMotionScope()
    const title = titleRef.current
    const heading = pageRef.current?.querySelector<HTMLElement>('h1[aria-label="Red Tide"]')
    // Measure the rendered headline span, not the full-width h1 container. TextPressure
    // keeps this selector stable without changing its accessible name.
    const destination = heading?.querySelector<HTMLElement>('[data-text-pressure-target]') ?? heading
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
          ], {
            duration: INTRO_TITLE_HANDOFF_MS,
            delay: INTRO_TITLE_HANDOFF_DELAY_MS,
            easing: `cubic-bezier(${MOTION.ease.tide.join(',')})`,
            fill: 'forwards',
          })
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
    dismissedRef.current = false
    phaseRef.current = 'entrance'
    window.scrollTo({ top: 0, behavior: 'instant' })
    setRun(value => value + 1)
    setPhase('entrance')
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
        <div
          ref={overlayRef}
          key={run}
          className={`tide-intro tide-intro--${phase}`}
          role="button"
          aria-label="Enter Red Tide PPC"
          tabIndex={0}
          onClick={dismiss}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <div className="tide-intro__curtain" data-intro-exit-duration={INTRO_EXIT_MS} aria-hidden="true">
            <svg className="tide-intro__curtain-edge" viewBox="0 0 1600 160" preserveAspectRatio="none">
              <path d="M0 82C320 150 540 10 820 62S1290 150 1600 50V160H0Z" fill="currentColor" />
            </svg>
            <div className="tide-intro__light" />
          </div>
          <div className="tide-intro__top tide-intro__chrome">
            <span className="tide-intro__location">PUERTO PRINCESA <span>/</span> PALAWAN</span>
          </div>
          <div className="tide-intro__center">
            <div className="tide-intro__depth tide-intro__depth--far" aria-hidden="true" />
            <div className="tide-intro__depth tide-intro__depth--near" aria-hidden="true" />
            <div className="tide-intro__surface" data-intro-exit-duration={INTRO_EXIT_MS} aria-hidden="true">
              <div className="tide-intro__horizon" />
              <div className="tide-intro__ripple"><span /></div>
              <div className="tide-intro__surface-glow" aria-hidden="true" />
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
                <p className="tide-intro__line" onAnimationEnd={handleEntranceComplete}>One coast. A shared watch.</p>
              </div>
              <div
                className="tide-intro__hint"
                data-hint-state={phase === 'idle' ? 'visible' : phase === 'leaving' ? 'exiting' : 'hidden'}
                aria-hidden="true"
              >
                TAP TO ENTER
              </div>
            </div>
          </div>
          <div className="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
