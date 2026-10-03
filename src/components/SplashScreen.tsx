import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Landing } from '../pages/Landing'
import { useReducedMotion, prefersReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import { INTRO_COAST_PATH } from '../data/introCoast'
import '../styles/tide-intro.css'

const SEEN_KEY = 'red-tide-ppc:splash:v1'
export const INTRO_ENTRANCE_MS = 1100
export const INTRO_EXIT_MS = 650
export const INTRO_TITLE_HANDOFF_MS = 550
export const INTRO_TITLE_HANDOFF_DELAY_MS = 40

type Phase = 'entrance' | 'idle' | 'leaving' | 'done'

function initialPhase(): Phase {
  if (prefersReducedMotion() || window.location.hash) return 'done'
  try { if (sessionStorage.getItem(SEEN_KEY)) return 'done' } catch { /* Storage is optional. */ }
  return 'entrance'
}

/** Finite coastal reveal -> still composition -> user-driven title handoff. */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)
  const pageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const entryRef = useRef<HTMLButtonElement>(null)
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
    if (event.key !== 'Escape' && (event.target as HTMLElement).closest('a')) return
    if (!['Enter', 'Escape', ' ', 'Spacebar'].includes(event.key)) return
    event.preventDefault()
    dismiss()
  }, [dismiss])

  const handlePointerUp = useCallback((_event: PointerEvent<HTMLButtonElement>) => {
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
    entryRef.current?.focus({ preventScroll: true })
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
      // Finish the child reveal before measuring: early input must not hand off
      // a partly hidden title. Resize during flight uses the dissolve fallback.
      title.classList.add('tide-intro__title--ready')
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
    const resize = () => {
      animation?.cancel()
      if (hidingTwin && heading) heading.style.visibility = previousVisibility
      hidingTwin = false
      overlay?.setAttribute('data-handoff', 'fade')
    }
    window.addEventListener('resize', resize)
    scope.timeout(finish, INTRO_EXIT_MS)
    return () => {
      scope.dispose()
      window.removeEventListener('resize', resize)
      title?.classList.remove('tide-intro__title--ready')
      animation?.cancel()
      if (hidingTwin && heading) heading.style.visibility = previousVisibility
      overlay?.removeAttribute('data-handoff')
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
          onClick={dismiss}
          onKeyDown={handleKeyDown}
        >
          <div className="tide-intro__curtain" data-intro-exit-duration={INTRO_EXIT_MS} aria-hidden="true">
            <div className="tide-intro__light" />
          </div>
          <div className="tide-intro__top tide-intro__chrome">
            <span className="tide-intro__location">PUERTO PRINCESA <span>/</span> PALAWAN</span>
          </div>
          <div className="tide-intro__center">
            <svg className="tide-intro__coast" viewBox="0 0 800 420" aria-hidden="true">
              <path d={INTRO_COAST_PATH} pathLength="1" />
            </svg>
            <div className="tide-intro__waterline" aria-hidden="true" />
            <div className="tide-intro__title-clip">
              <div ref={titleRef} id="tide-intro-label" className="tide-intro__title" role="heading" aria-level={1} aria-label="Red Tide">
                <span aria-hidden="true">RED TIDE</span>
              </div>
            </div>
            <div className="tide-intro__copy tide-intro__chrome">
              <p className="tide-intro__eyebrow">COMMUNITY COASTAL MONITORING</p>
            </div>
            <button
              ref={entryRef}
              type="button"
              className="tide-intro__hint"
              aria-label="Enter Red Tide PPC"
              data-hint-state={phase === 'leaving' ? 'exiting' : 'visible'}
              onPointerUp={handlePointerUp}
              onClick={dismiss}
            >
              <span className="tide-intro__enter-desktop">ENTER SITE</span>
              <span className="tide-intro__enter-touch">TAP TO ENTER</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div className="tide-intro__bottom tide-intro__chrome"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>© OpenStreetMap contributors</a><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
