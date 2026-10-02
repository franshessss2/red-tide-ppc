import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Landing } from '../pages/Landing'
import { useReducedMotion, prefersReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION } from '../motion/tokens'
import { markIntroSeen, shouldShowIntro } from './intro/introGate'
import { INTRO_SCENE_COUNT, IntroScene, sceneAnnouncement } from './intro/IntroScenes'
import '../styles/tide-intro.css'

export const INTRO_ENTRANCE_MS = 1900
export const INTRO_EXIT_MS = MOTION.time.introExit * 1000
export const INTRO_TITLE_HANDOFF_MS = 700
export const INTRO_TITLE_HANDOFF_DELAY_MS = 80
export const INTRO_SCENE_OUT_MS = MOTION.time.introSceneOut * 1000
export { INTRO_SCENE_COUNT }

type Phase = 'entrance' | 'idle' | 'leaving' | 'done'

/** All gating lives in intro/introGate.ts: versioned localStorage, "/" only, reduced motion off, fail open. */
function initialPhase(): Phase {
  return shouldShowIntro() ? 'entrance' : 'done'
}

/**
 * Brand entrance -> looping idle (scene 0) -> five tap-to-advance scenes ->
 * the explicit user-driven PR57 exit. Data fetching never controls it, no
 * timer ever changes the scene, and Skip is one action away on every screen.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>(initialPhase)
  const reduce = useReducedMotion()
  const [run, setRun] = useState(0)
  const [scene, setScene] = useState(0)
  // The 220ms ghost of the outgoing scene. A tap mid-transition drops it
  // immediately (the transition "completes") and advances exactly once.
  const [ghostScene, setGhostScene] = useState<number | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const advanceRef = useRef<HTMLButtonElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const replaying = useRef(false)
  const dismissedRef = useRef(false)
  const phaseRef = useRef<Phase>(phase)
  const sceneRef = useRef(0)
  const active = phase !== 'done' && !reduce

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const finish = useCallback(() => {
    phaseRef.current = 'done'
    markIntroSeen()
    setPhase('done')
  }, [])

  const dismiss = useCallback(() => {
    if (dismissedRef.current || phaseRef.current === 'leaving' || phaseRef.current === 'done') return
    dismissedRef.current = true
    overlayRef.current?.classList.remove('tide-intro--hidden')
    markIntroSeen()
    phaseRef.current = 'leaving'
    setPhase('leaving')
  }, [])

  /** One tap, one scene. The sixth tap (on the final scene) runs the PR57 exit. */
  const advance = useCallback(() => {
    const current = phaseRef.current
    if (current === 'leaving' || current === 'done') return
    if (sceneRef.current >= INTRO_SCENE_COUNT) {
      dismiss()
      return
    }
    if (current === 'entrance') {
      phaseRef.current = 'idle'
      setPhase('idle')
    }
    setGhostScene(sceneRef.current > 0 ? sceneRef.current : null)
    sceneRef.current += 1
    setScene(sceneRef.current)
  }, [dismiss])

  const handleAdvanceKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['Enter', ' ', 'Spacebar', 'ArrowRight'].includes(event.key)) return
    // preventDefault stops the browser's own keyboard "click" on the button,
    // so Enter and Space advance exactly once — and Space never scrolls.
    event.preventDefault()
    advance()
  }, [advance])

  const handleOverlayKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    dismiss()
  }, [dismiss])

  useEffect(() => {
    if (reduce) finish()
  }, [reduce, finish])

  useEffect(() => {
    if (ghostScene === null) return
    const scope = createMotionScope()
    scope.timeout(() => setGhostScene(null), INTRO_SCENE_OUT_MS)
    return () => scope.dispose()
  }, [ghostScene, scene])

  useEffect(() => {
    if (!active) return
    const oldOverflow = document.body.style.overflow
    const overlay = overlayRef.current
    document.body.style.overflow = 'hidden'
    advanceRef.current?.focus({ preventScroll: true })
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
    // The wordmark is only on screen during scene 0 and the final scene; a
    // Skip from scenes 1–4 exits on the dissolve so an invisible title is
    // never flown over the landing heading.
    const titleVisible = sceneRef.current === 0 || sceneRef.current >= INTRO_SCENE_COUNT
    // Do not wait for fonts: if metrics are unstable, dissolve on the same deadline.
    const fontsReady = !document.fonts || document.fonts.status === 'loaded'
    if (titleVisible && title && destination && heading && fontsReady && typeof title.animate === 'function') {
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
    return () => {
      scope.dispose()
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
    sceneRef.current = 0
    setScene(0)
    setGhostScene(null)
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
          data-scene={scene}
          role="dialog"
          aria-modal="true"
          aria-label="Introduction"
          onKeyDown={handleOverlayKeyDown}
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
              TAP TO BEGIN
            </div>
          </div>
          {scene > 0 && (
            <div className="tide-scenes">
              {ghostScene !== null && ghostScene !== scene && (
                <IntroScene key={`out-${ghostScene}`} scene={ghostScene} state="out" />
              )}
              <IntroScene key={scene} scene={scene} state="in" />
            </div>
          )}
          <div className="sr-only" aria-live="polite">{sceneAnnouncement(scene)}</div>
          <button
            ref={advanceRef}
            type="button"
            className="tide-intro__advance"
            aria-label={scene === 0 ? 'TAP TO BEGIN' : scene === INTRO_SCENE_COUNT ? 'TAP TO ENTER' : `Step ${scene} of ${INTRO_SCENE_COUNT}`}
            onClick={advance}
            onKeyDown={handleAdvanceKeyDown}
          />
          <button type="button" className="tide-intro__skip" aria-label="Skip introduction" onClick={dismiss}>
            Skip
          </button>
          <div className="tide-intro__bottom tide-intro__chrome"><span>WATCH THE WATER.</span><span>PROTECT THE COAST.</span></div>
        </div>
      , document.body)}
    </div>
  )
}
