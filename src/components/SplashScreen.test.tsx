// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  INTRO_EXIT_MS,
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
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_: string, fn: () => void) => { listener = fn },
    removeEventListener: vi.fn(),
  }))
  window.scrollTo = vi.fn()
})

afterEach(() => {
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function splash() {
  render(<SplashScreen />)
  return screen.getByRole('button', { name: 'Enter Red Tide PPC' })
}

function enterIdle() {
  const button = splash()
  const line = document.querySelector<HTMLElement>('.tide-intro__line')!
  fireEvent.animationEnd(line, { animationName: 'tide-copy-in' })
  expect(document.querySelector('.tide-experience--idle')).toBeTruthy()
  expect(document.querySelector('[data-hint-state="visible"]')).toBeTruthy()
  return button
}

function triggerExitByEscape() {
  const button = screen.getByRole('button', { name: 'Enter Red Tide PPC' })
  fireEvent.keyDown(button, { key: 'Escape' })
  return button
}

describe('cinematic entrance', () => {
  it('does not auto-exit after 30s without input', () => {
    const button = splash()
    act(() => vi.advanceTimersByTime(30000))
    expect(document.querySelector('.tide-experience--entrance')).toBeTruthy()
    expect(button).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Enter Red Tide PPC' })).toBe(button)
  })

  it('click exits immediately and completes the existing 800ms exit', () => {
    const button = splash()
    fireEvent.click(button)
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('pointer/tap exits through the same handler', () => {
    const button = splash()
    fireEvent.pointerUp(button)
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
  })

  it('Enter, Space and Escape all dismiss', () => {
    for (const key of ['Enter', ' ', 'Escape']) {
      sessionStorage.clear()
      const button = splash()
      fireEvent.keyDown(button, { key })
      expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
      cleanup()
    }
  })

  it('Space prevents page scrolling while dismissing', () => {
    const button = splash()
    fireEvent.keyDown(button, { key: ' ' })
    expect(window.scrollTo).not.toHaveBeenCalled()
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
  })

  it('double trigger starts the exit only once', () => {
    const { unmount } = render(<SplashScreen />)
    const button = screen.getByRole('button', { name: 'Enter Red Tide PPC' })
    const title = document.querySelector<HTMLElement>('.tide-intro__title')!
    vi.spyOn(title, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 100, left: 100, top: 100, right: 700, bottom: 280, width: 600, height: 180, toJSON: () => ({})
    })
    const heading = document.querySelector('h1')!
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, left: 20, top: 20, right: 260, bottom: 92, width: 240, height: 72, toJSON: () => ({})
    })
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    title.animate = animate as unknown as typeof title.animate
    fireEvent.pointerUp(button)
    fireEvent.click(button)
    expect(animate).toHaveBeenCalledOnce()
    unmount()
  })

  it('preserves the Escape path and marks the session seen', () => {
    const button = splash()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    cleanup()
    render(<SplashScreen />)
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
  })

  it('bypasses the entrance entirely under reduced motion', () => {
    reduced = true
    const { container } = render(<SplashScreen />)
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Intro motion off' }).hasAttribute('disabled')).toBe(true)
  })

  it('immediately releases the page if motion preference changes during the intro', () => {
    const { container } = render(<SplashScreen />)
    act(() => { reduced = true; listener?.() })
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('keeps sessionStorage red-tide-ppc:splash:v1 from replaying', () => {
    sessionStorage.setItem('red-tide-ppc:splash:v1', 'seen')
    const { container } = render(<SplashScreen />)
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(container.querySelector('[inert]')).toBeNull()
  })

  it('still dismisses when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const button = splash()
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(document.querySelector('.tide-experience--leaving')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
  })

  it('cleans up the body scroll lock when unmounted during the entrance', () => {
    document.body.style.overflow = ''
    const { unmount } = render(<SplashScreen />)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('exposes a focused, focusable role=button with the expected accessible name', () => {
    const button = splash()
    expect(button.getAttribute('role')).toBe('button')
    expect(button.getAttribute('aria-label')).toBe('Enter Red Tide PPC')
    expect(button.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(button)
  })

  it('shows the hint after entrance and changes it to exiting on dismiss', () => {
    const button = enterIdle()
    expect(document.querySelector('[data-hint-state="visible"]')).toBeTruthy()
    fireEvent.click(button)
    expect(document.querySelector('[data-hint-state="exiting"]')).toBeTruthy()
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

  it('measures the wordmark and restores the underlying heading after Escape', () => {
    const { heading, animate, cancel } = measuredIntro()
    triggerExitByEscape()
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
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('uses an on-time dissolve when fonts are still loading', () => {
    Object.defineProperty(document, 'fonts', { configurable: true, value: { status: 'loading' } })
    const { heading, animate } = measuredIntro()
    triggerExitByEscape()
    expect(animate).not.toHaveBeenCalled()
    expect(heading.style.visibility).toBe('')
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
  })

  it('does not hide the landing heading if the animation API throws', () => {
    const { heading, animate } = measuredIntro()
    animate.mockImplementation(() => { throw new Error('unsupported') })
    triggerExitByEscape()
    expect(document.querySelector('[data-handoff="fade"]')).toBeTruthy()
    expect(heading.style.visibility).toBe('')
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
  })

  it('finishes immediately on resize during the measured handoff', () => {
    const { heading, cancel } = measuredIntro()
    triggerExitByEscape()
    fireEvent(window, new Event('resize'))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('cancels the measured handoff when reduced motion changes live', () => {
    const { heading, cancel } = measuredIntro()
    triggerExitByEscape()
    act(() => { reduced = true; listener?.() })
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(heading.style.visibility).toBe('')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('pauses loops on visibilitychange and resumes them when visible', () => {
    render(<SplashScreen />)
    const overlay = screen.getByRole('button', { name: 'Enter Red Tide PPC' })
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(overlay.classList.contains('tide-intro--hidden')).toBe(true)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(overlay.classList.contains('tide-intro--hidden')).toBe(false)
  })

  it('keeps repeated replay and Escape independent under StrictMode', () => {
    render(<StrictMode><SplashScreen /></StrictMode>)
    for (let i = 0; i < 3; i++) {
      const intro = screen.getByRole('button', { name: 'Enter Red Tide PPC' })
      intro.focus()
      fireEvent.keyDown(intro, { key: 'Escape' })
      act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
      fireEvent.click(screen.getByRole('button', { name: 'Replay intro' }))
      expect(screen.getAllByRole('button', { name: 'Enter Red Tide PPC' })).toHaveLength(1)
    }
    const intro = screen.getByRole('button', { name: 'Enter Red Tide PPC' })
    intro.focus()
    fireEvent.keyDown(intro, { key: 'Escape' })
    act(() => vi.advanceTimersByTime(INTRO_EXIT_MS))
    expect(screen.queryByRole('button', { name: 'Enter Red Tide PPC' })).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replay intro' }))
  })

  it('cancels and restores the title when unmounted during the handoff', () => {
    const { unmount, heading, cancel } = measuredIntro()
    triggerExitByEscape()
    unmount()
    expect(cancel).toHaveBeenCalledOnce()
    expect(heading.style.visibility).toBe('')
  })
})
