import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Landing } from '../pages/Landing'
import { useReducedMotion, prefersReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import '../styles/tide-intro.css'

const SEEN_KEY = 'red-tide-ppc:splash:v1'
export const INTRO_ENTRANCE_MS = 1900
export const INTRO_EXIT_MS = MOTION.time.introExit * 1000
export const INTRO_TITLE_HANDOFF_MS = 700
export const INTRO_TITLE_HANDOFF_DELAY_MS = 80

type Phase = 'entrance' | 'idle' | 'leaving' | 'done'

function initialPhase(): Phase {
  if (prefersReducedMotion() || window.location.hash) return 'done'
  try { if (sessionStorage.getItem(SEEN_KEY)) return 'done' } catch { /* Storage is optional. */ }
  return 'entrance'
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
    const overlay = overlayRef.current
    document.body.style.overflow = 'hidden'
    overlay?.focus({ preventScroll: true })
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
    if (phase !== 'entrance' || reduce) return
    const scope = createMotionScope()
    scope.timeout(() => {
      if (phaseRef.current !== 'entrance') return
      phaseRef.current = 'idle'
      setPhase('idle')
    }, INTRO_ENTRANCE_MS)
    return () => scope.dispose()
  }, [phase, reduce])

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
            <div className="tide-intro__loop-ripple" aria-hidden="true" />
            <div className="tide-intro__surface" data-intro-exit-duration={INTRO_EXIT_MS} aria-hidden="true">
              <div className="tide-intro__horizon" />
              <div className="tide-intro__ripple"><span /></div>
              <div className="tide-intro__surface-glow" />
              <div className="tide-intro__wave-stack" aria-hidden="true">
                <div className="tide-intro__wave-layer tide-intro__wave-layer--back">
                  <div className="tide-intro__wave-bob tide-intro__wave-bob--back">
                    <svg viewBox="0 0 2000 360" preserveAspectRatio="none">
                      <path d="M0 130 C125 70 250 190 375 130 S625 70 750 130 S875 190 1000 130 C1125 70 1250 190 1375 130 S1625 70 1750 130 S1875 190 2000 130 L2000 360 L0 360 Z" fill="#ff525209" />
                    </svg>
                  </div>
                </div>
                <div className="tide-intro__wave-layer tide-intro__wave-layer--mid">
                  <div className="tide-intro__wave-bob tide-intro__wave-bob--mid">
                    <svg viewBox="0 0 2000 360" preserveAspectRatio="none">
                      <path d="M0 110 C125 42 250 178 375 110 S625 42 750 110 S875 178 1000 110 C1125 42 1250 178 1375 110 S1625 42 1750 110 S1875 178 2000 110 L2000 360 L0 360 Z" fill="#ff525213" />
                    </svg>
                  </div>
                </div>
                <div className="tide-intro__wave-layer tide-intro__wave-layer--front">
                  <div className="tide-intro__wave-bob tide-intro__wave-bob--front">
                    <svg viewBox="0 0 2000 360" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="tide-front-crest" x1="0" x2="1000" gradientUnits="userSpaceOnUse" spreadMethod="repeat">
                          <stop offset="0" stopColor="#f0a50000" />
                          <stop offset=".46" stopColor="#f0a500" stopOpacity=".88" />
                          <stop offset=".72" stopColor="#ff5252" stopOpacity=".74" />
                          <stop offset="1" stopColor="#ff525200" />
                        </linearGradient>
                      </defs>
                      <path d="M0 92 C125 48 250 136 375 92 S625 48 750 92 S875 136 1000 92 C1125 48 1250 136 1375 92 S1625 48 1750 92 S1875 136 2000 92 L2000 360 L0 360 Z" fill="#f0a5000f" />
                      <path d="M0 92 C125 48 250 136 375 92 S625 48 750 92 S875 136 1000 92 C1125 48 1250 136 1375 92 S1625 48 1750 92 S1875 136 2000 92" fill="none" stroke="url(#tide-front-crest)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="tide-intro__title-clip">
              <div ref={titleRef} id="tide-intro-label" className="tide-intro__title" aria-label="Red Tide">
                <span aria-hidden="true">RED TIDE</span>
              </div>
            </div>
            <div className="tide-intro__copy tide-intro__chrome">
              <p className="tide-intro__eyebrow">COMMUNITY EARLY WARNING</p>
              <p className="tide-intro__line">One coast. A shared watch.</p>
            </div>
            <div
              className="tide-intro__hint"
              data-hint-state={phase === 'idle' ? 'visible' : phase === 'leaving' ? 'exiting' : 'hidden'}
              aria-hidden="true"
            >
              TAP TO ENTER
            </div>
          </div>
          <div className="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
