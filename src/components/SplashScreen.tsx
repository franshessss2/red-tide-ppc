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