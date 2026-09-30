// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INTRO_EXIT_MS,
  INTRO_HOLD_MS,
  INTRO_TITLE_HANDOFF_DELAY_MS,
  INTRO_TITLE_HANDOFF_MS,
  SplashScreen,
} from './SplashScreen'

vi.mock('../pages/Landing', () => ({ Landing: () => <main><h1 aria-label="Red Tide">RED TIDE</h1><a className="landing-map-cta" href="/map">Open the map</a></main> }))
const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
let reduced = false
let listener: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  reduced = false
  listener = undefined
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced }, addEventListener: (_: string, fn: () => void) => { listener = fn }, removeEventListener: vi.fn() }))
  window.scrollTo = vi.fn()
})
afterEach(() => {
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('cinematic entrance', () => {
  it('finishes on time without waiting for data and restores focus and scrolling', () => {
    document.body.style.overflow = 'auto'
    const { container } = render(<SplashScreen />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    expect(container.querySelector('[inert]')).toBeTruthy()
    // Landing stays mounted beneath the intro so the hero can warm up before reveal.
    expect(container.querySelector('[inert] main')).toBeTruthy()
    const curtain = document.querySelector<HTMLElement>('.tide-intro__curtain')!
    const surface = document.querySelector<HTMLElement>('.tide-intro__surface')!
    expect(curtain.dataset.introExitDuration).toBe(surface.dataset.introExitDuration)
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    expect(document.querySelector('.tide-intro--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Open the map' }))
    expect(document.body.style.overflow).toBe('auto')
  })
  it('Escape is immediate, cancels pending timers, and marks the session seen', () => {
    render(<SplashScreen />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    render(<SplashScreen />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('supports Escape and replay, with focus returned to replay afterward', () => {
    render(<SplashScreen />)
    fireEvent.keyDown(window, { key: 'Escape' })
    const replay = screen.getByRole('button', { name: 'Replay intro' })
    fireEvent.click(replay)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(replay)
  })
  it('bypasses the entrance entirely under reduced motion', () => {
    reduced = true
    const { container } = render(<SplashScreen />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Intro motion off' }).hasAttribute('disabled')).toBe(true)
  })
  it('immediately releases the page if motion preference changes during the intro', () => {
    const { container } = render(<SplashScreen />)
    act(() => { reduced = true; listener?.() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })
  it('still completes when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<SplashScreen />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('cleans up the body scroll lock when unmounted during playback', () => {
    document.body.style.overflow = ''
    const scheduled = vi.spyOn(window, 'setTimeout')
    const cancelled = vi.spyOn(window, 'clearTimeout')
    const { unmount } = render(<SplashScreen />)
    const introCall = scheduled.mock.calls.findIndex(call => call[1] === INTRO_HOLD_MS)
    const introTimer = scheduled.mock.results[introCall].value
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(cancelled).toHaveBeenCalledWith(introTimer)
  })
})


function measuredIntro() {
  const view = render(<SplashScreen />)
  const title = document.querySelector<HTMLElement>('.tide-intro__title')!
  const heading = view.container.querySelector('h1')!
  const rect = (x: number, y: number, width: number, height: number) =>
    ({ x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) })
  vi.spyOn(title, 'getBoundingClientRect').mockReturnValue(rect(300, 200, 600, 180))
  vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(rect(40, 120, 240, 72))
  const cancel = vi.fn()
  const animate = vi.fn(() => ({ cancel }))
  title.animate = animate as unknown as typeof title.animate
  return { ...view, title, heading, animate, cancel }
}

describe('First Ripple handoff', () => {
  it('starts the title handoff before the synchronized surface reveal completes', () => {
    expect(INTRO_TITLE_HANDOFF_DELAY_MS).toBeGreaterThanOrEqual(0)
    expect(INTRO_TITLE_HANDOFF_DELAY_MS + INTRO_TITLE_HANDOFF_MS).toBeLessThan(INTRO_EXIT_MS)
  })
  it('measures the wordmark and restores the underlying heading after skip', () => {
    const { heading, animate, cancel } = measuredIntro()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    expect(document.querySelector('[data-handoff="measured"]')).toBeTruthy()
    expect(animate.mock.calls[0]).toEqual([
      [{ transform: 'translate(0, 0) scale(1, 1)' }, { transform: 'translate(-260px, -80px) scale(0.4, 0.4)' }],
      expect.objectContaining({
        duration: INTRO_TITLE_HANDOFF_MS,
        delay: INTRO_TITLE_HANDOFF_DELAY_MS,
      }),
    ])
    expect(INTRO_TITLE_HANDOFF_MS + INTRO_TITLE_HANDOFF_DELAY_MS).toBeLessThan(INTRO_EXIT_MS)
    expect(heading.style.visibility).toBe('hidden')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('uses an on-time dissolve when fonts are still loading', () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { status: 'loading' } })
    const { heading, animate } = measuredIntro()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    expect(animate).not.toHaveBeenCalled()
    expect(heading.style.visibility).toBe('')
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not hide the landing heading if the animation API throws', () => {
    const { heading, animate } = measuredIntro()
    animate.mockImplementation(() => { throw new Error('unsupported') })
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    expect(heading.style.visibility).toBe('')
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('finishes immediately on resize during the measured handoff', () => {
    const { heading, cancel } = measuredIntro()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels the measured handoff when reduced motion changes live', () => {
    const { heading, cancel } = measuredIntro()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    act(() => { reduced = true; listener?.() })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('finishes instead of leaving paused animation when the tab is hidden', () => {
    render(<SplashScreen />)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[inert]')).toBeNull()
  })

  it('keeps repeated replay and Escape independent under StrictMode', () => {
    render(<StrictMode><SplashScreen /></StrictMode>)
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: 'Escape' })
      fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }))
      act(() => vi.advanceTimersByTime(200))
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    }
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay intro' }))
  })

  it('cancels and restores the title when unmounted during the handoff', () => {
    const { unmount, heading, cancel } = measuredIntro()
    act(() => vi.advanceTimersByTime(INTRO_HOLD_MS))
    unmount()
    expect(cancel).toHaveBeenCalledOnce()
    expect(heading.style.visibility).toBe('')
  })
})
